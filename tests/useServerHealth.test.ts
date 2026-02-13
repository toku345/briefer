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
vi.stubGlobal('fetch', fetchSpy);

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
  });

  it('サーバー応答が非 OK の場合に disconnected を返す', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });
    const { result } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });
  });

  it('fetch 失敗時に disconnected を返す', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });
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

  it('unmount 後に fetch が解決しても状態を更新しない', async () => {
    let resolveFetch: ((value: { ok: boolean }) => void) | undefined;
    fetchSpy.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useServerHealth());
    expect(result.current.status).toBe('checking');

    unmount();

    await act(async () => {
      resolveFetch?.({ ok: true });
    });

    expect(result.current.status).toBe('checking');
  });

  it('unmount 時にインターバルが停止する', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { unmount } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('インターバル中にサーバーがダウンした場合 disconnected に遷移する', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    fetchSpy.mockRejectedValue(new Error('Connection refused'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current.status).toBe('disconnected');
  });
});
