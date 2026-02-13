/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockChromeTabs = {
  query: vi.fn(),
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
});
