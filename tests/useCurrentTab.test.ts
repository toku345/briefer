/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// chrome.tabs.onActivated リスナーを追跡
let activatedListeners: ((info: chrome.tabs.OnActivatedInfo) => void)[] = [];

const mockChromeTabs = {
  query: vi.fn(),
  onActivated: {
    addListener: vi.fn((cb: (info: chrome.tabs.OnActivatedInfo) => void) => {
      activatedListeners.push(cb);
    }),
    removeListener: vi.fn((cb: (info: chrome.tabs.OnActivatedInfo) => void) => {
      activatedListeners = activatedListeners.filter((l) => l !== cb);
    }),
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome = {
  tabs: mockChromeTabs,
} as typeof chrome;

const { useCurrentTab } = await import('../src/sidepanel/hooks/useCurrentTab');

describe('useCurrentTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activatedListeners = [];
  });

  it('初回マウント時に現在のタブIDを取得する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 123 }]);

    const { result } = renderHook(() => useCurrentTab());

    await vi.waitFor(() => {
      expect(result.current.tabId).toBe(123);
    });

    expect(mockChromeTabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(result.current.error).toBeNull();
  });

  it('タブ切り替え時にtabIdが更新される', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 100 }]);

    const { result } = renderHook(() => useCurrentTab());

    await vi.waitFor(() => {
      expect(result.current.tabId).toBe(100);
    });

    expect(activatedListeners).toHaveLength(1);

    act(() => {
      activatedListeners[0]({ tabId: 200, windowId: 1 });
    });

    expect(result.current.tabId).toBe(200);
    expect(result.current.error).toBeNull();
  });

  it('アンマウント時にリスナーが解除される', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 123 }]);

    const { unmount } = renderHook(() => useCurrentTab());

    await vi.waitFor(() => {
      expect(activatedListeners).toHaveLength(1);
    });

    unmount();

    expect(mockChromeTabs.onActivated.removeListener).toHaveBeenCalled();
  });

  it('タブが見つからない場合にエラーを設定する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useCurrentTab());

    await vi.waitFor(() => {
      expect(result.current.error).toBe('タブが見つかりません');
    });

    expect(result.current.tabId).toBeNull();
  });

  it('タブにIDがない場合にエラーを設定する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ url: 'https://example.com' }]);

    const { result } = renderHook(() => useCurrentTab());

    await vi.waitFor(() => {
      expect(result.current.error).toBe('タブが見つかりません');
    });

    expect(result.current.tabId).toBeNull();
  });

  it('クエリ失敗時にエラーを設定する', async () => {
    mockChromeTabs.query.mockRejectedValueOnce(new Error('Query failed'));

    const { result } = renderHook(() => useCurrentTab());

    await vi.waitFor(() => {
      expect(result.current.error).toBe('タブ情報の取得に失敗しました');
    });

    expect(result.current.tabId).toBeNull();
  });

  it('タブ切り替え時にエラーがクリアされる', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useCurrentTab());

    await vi.waitFor(() => {
      expect(result.current.error).toBe('タブが見つかりません');
    });

    act(() => {
      activatedListeners[0]({ tabId: 300, windowId: 1 });
    });

    expect(result.current.tabId).toBe(300);
    expect(result.current.error).toBeNull();
  });
});
