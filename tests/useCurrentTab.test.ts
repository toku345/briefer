/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockOnActivated = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
const mockOnUpdated = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
const mockChromeTabs = {
  query: vi.fn(),
  onActivated: mockOnActivated,
  onUpdated: mockOnUpdated,
};

(globalThis as unknown as { chrome: typeof chrome }).chrome = {
  tabs: mockChromeTabs,
} as unknown as typeof chrome;

let useCurrentTab: typeof import('../entrypoints/sidepanel/hooks/useCurrentTab').useCurrentTab;

describe('useCurrentTab', () => {
  beforeAll(async () => {
    const module = await import('../entrypoints/sidepanel/hooks/useCurrentTab');
    useCurrentTab = module.useCurrentTab;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初回マウント時に現在のタブIDを取得する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 123 }]);

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.tabId).toBe(123);
    });

    expect(mockChromeTabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(result.current.error).toBeNull();
  });

  it('title と url を返す', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([
      { id: 123, title: 'Example Page', url: 'https://example.com/path' },
    ]);

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.tabId).toBe(123);
      expect(result.current.title).toBe('Example Page');
      expect(result.current.url).toBe('https://example.com/path');
    });
  });

  it('title/url が undefined の場合は空文字を返す', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 123 }]);

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.tabId).toBe(123);
      expect(result.current.title).toBe('');
      expect(result.current.url).toBe('');
    });
  });

  it('タブが見つからない場合にエラーを設定する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.error).toBe('タブが見つかりません');
    });

    expect(result.current.tabId).toBeNull();
  });

  it('タブにIDがない場合にエラーを設定する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ url: 'https://example.com' }]);

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.error).toBe('タブが見つかりません');
    });

    expect(result.current.tabId).toBeNull();
  });

  it('クエリ失敗時にエラーを設定する', async () => {
    mockChromeTabs.query.mockRejectedValueOnce(new Error('Query failed'));

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.error).toBe('タブ情報の取得に失敗しました');
    });

    expect(result.current.tabId).toBeNull();
  });

  it('onActivated リスナーを登録・解除する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 1 }]);

    const { unmount } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(mockOnActivated.addListener).toHaveBeenCalledTimes(1);
    });

    unmount();
    expect(mockOnActivated.removeListener).toHaveBeenCalledTimes(1);
  });

  it('onUpdated リスナーを登録・解除する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 1 }]);

    const { unmount } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(mockOnUpdated.addListener).toHaveBeenCalledTimes(1);
    });

    unmount();
    expect(mockOnUpdated.removeListener).toHaveBeenCalledTimes(1);
  });

  it('onActivated でタブ切り替えを検知して再取得する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([
      { id: 1, title: 'Page 1', url: 'https://one.com' },
    ]);

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.tabId).toBe(1);
    });

    // onActivated コールバックを取得して呼び出す
    const onActivatedCallback = mockOnActivated.addListener.mock.calls[0][0];
    mockChromeTabs.query.mockResolvedValueOnce([
      { id: 2, title: 'Page 2', url: 'https://two.com' },
    ]);

    await act(async () => {
      onActivatedCallback({ tabId: 2, windowId: 1 });
    });

    await waitFor(() => {
      expect(result.current.tabId).toBe(2);
      expect(result.current.title).toBe('Page 2');
      expect(result.current.url).toBe('https://two.com');
    });
  });

  it('onUpdated で title 変更時に再取得する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([
      { id: 1, title: 'Old Title', url: 'https://example.com' },
    ]);

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.title).toBe('Old Title');
    });

    const onUpdatedCallback = mockOnUpdated.addListener.mock.calls[0][0];
    mockChromeTabs.query.mockResolvedValueOnce([
      { id: 1, title: 'New Title', url: 'https://example.com' },
    ]);

    await act(async () => {
      onUpdatedCallback(1, { title: 'New Title' });
    });

    await waitFor(() => {
      expect(result.current.title).toBe('New Title');
    });
  });

  it('エラー後にタブ取得成功するとエラーがクリアされる', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(result.current.error).toBe('タブが見つかりません');
    });

    // onActivated でタブ切り替え → 成功
    const onActivatedCallback = mockOnActivated.addListener.mock.calls[0][0];
    mockChromeTabs.query.mockResolvedValueOnce([
      { id: 1, title: 'Page', url: 'https://example.com' },
    ]);

    await act(async () => {
      onActivatedCallback({ tabId: 1, windowId: 1 });
    });

    await waitFor(() => {
      expect(result.current.tabId).toBe(1);
      expect(result.current.error).toBeNull();
    });
  });

  it('onUpdated でアクティブタブ以外の更新は無視する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([
      { id: 1, title: 'Active Tab', url: 'https://example.com' },
    ]);

    renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(mockChromeTabs.query).toHaveBeenCalledTimes(1);
    });

    const onUpdatedCallback = mockOnUpdated.addListener.mock.calls[0][0];

    // 別タブ(id=999)の title 変更 → 無視される
    await act(async () => {
      onUpdatedCallback(999, { title: 'Other Tab Updated' });
    });

    expect(mockChromeTabs.query).toHaveBeenCalledTimes(1);
  });

  it('onUpdated で title が空文字に変更された場合も再取得する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([
      { id: 1, title: 'Some Title', url: 'https://example.com' },
    ]);

    renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(mockChromeTabs.query).toHaveBeenCalledTimes(1);
    });

    const onUpdatedCallback = mockOnUpdated.addListener.mock.calls[0][0];
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 1, title: '', url: 'https://example.com' }]);

    await act(async () => {
      onUpdatedCallback(1, { title: '' });
    });

    expect(mockChromeTabs.query).toHaveBeenCalledTimes(2);
  });

  it('onUpdated で関係ない変更は無視する', async () => {
    mockChromeTabs.query.mockResolvedValueOnce([{ id: 1, title: 'Title' }]);

    renderHook(() => useCurrentTab());

    await waitFor(() => {
      expect(mockChromeTabs.query).toHaveBeenCalledTimes(1);
    });

    const onUpdatedCallback = mockOnUpdated.addListener.mock.calls[0][0];

    await act(async () => {
      onUpdatedCallback(1, { favIconUrl: 'https://example.com/favicon.ico' });
    });

    // query は初回の1回のみ（再取得されない）
    expect(mockChromeTabs.query).toHaveBeenCalledTimes(1);
  });
});
