/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/settings-store', () => ({
  getSettings: vi.fn().mockResolvedValue({
    serverUrl: 'http://localhost:8000/v1',
    selectedModel: null,
    temperature: 0.3,
    maxTokens: 2048,
  }),
}));

const fetchSpy = vi.fn();
globalThis.fetch = fetchSpy;

let useServerHealth: typeof import('../entrypoints/sidepanel/hooks/useServerHealth').useServerHealth;

describe('useServerHealth', () => {
  beforeAll(async () => {
    const module = await import('../entrypoints/sidepanel/hooks/useServerHealth');
    useServerHealth = module.useServerHealth;
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期状態は checking', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { result, unmount } = renderHook(() => useServerHealth());

    expect(result.current.status).toBe('checking');
    expect(result.current.isConnected).toBeNull();

    // effect 内の非同期更新を完了させてから unmount
    await act(async () => {});
    unmount();
  });

  it('サーバー応答成功時に connected を返す', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('サーバー応答が非 OK の場合に disconnected を返す', async () => {
    fetchSpy.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('fetch 失敗時に disconnected を返す', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('30秒ごとにヘルスチェックを再実行する', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
