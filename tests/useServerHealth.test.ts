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

type StorageChangeListener = (
  changes: { [key: string]: chrome.storage.StorageChange },
  area: string,
) => void;

const storageListeners: StorageChangeListener[] = [];

const mockChrome = {
  storage: {
    onChanged: {
      addListener: vi.fn((listener: StorageChangeListener) => {
        storageListeners.push(listener);
      }),
      removeListener: vi.fn((listener: StorageChangeListener) => {
        const idx = storageListeners.indexOf(listener);
        if (idx >= 0) storageListeners.splice(idx, 1);
      }),
    },
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome =
  mockChrome as unknown as typeof chrome;

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
    storageListeners.length = 0;
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

  it('chrome.storage.onChanged で設定変更時にヘルスチェックを再実行する', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    const callCountBefore = fetchSpy.mock.calls.length;

    // 設定変更イベントを発火
    await act(async () => {
      for (const listener of storageListeners) {
        listener(
          { briefer_settings: { oldValue: {}, newValue: { serverUrl: 'http://new:8000/v1' } } },
          'local',
        );
      }
    });

    expect(fetchSpy.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('chrome.storage.onChanged で関係ないキーの変更は無視する', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      for (const listener of storageListeners) {
        listener({ other_key: { oldValue: null, newValue: 'val' } }, 'local');
      }
    });

    // 初回チェック以外に呼ばれていない
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('unmount 時に chrome.storage.onChanged リスナーが解除される', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { unmount } = renderHook(() => useServerHealth());

    await waitFor(() => {
      expect(storageListeners.length).toBe(1);
    });

    unmount();

    expect(storageListeners.length).toBe(0);
  });

  describe('paused パラメータ', () => {
    it('paused=true の場合 fetch を呼ばない', async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useServerHealth({ paused: true }));

      await act(async () => {});

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.current.status).toBe('checking');
    });

    it('paused=true の場合 interval も登録されない', async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      renderHook(() => useServerHealth({ paused: true }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('paused=true の場合 storage listener も登録されない', async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      renderHook(() => useServerHealth({ paused: true }));

      await act(async () => {});

      expect(storageListeners.length).toBe(0);
    });

    it('paused が false に切り替わると即座にヘルスチェックを再開する', async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      const { result, rerender } = renderHook(({ paused }) => useServerHealth({ paused }), {
        initialProps: { paused: true },
      });

      await act(async () => {});
      expect(fetchSpy).not.toHaveBeenCalled();

      rerender({ paused: false });

      await waitFor(() => {
        expect(result.current.status).toBe('connected');
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('connected → paused で status が connected を維持する', async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      const { result, rerender } = renderHook(({ paused }) => useServerHealth({ paused }), {
        initialProps: { paused: false },
      });

      await waitFor(() => {
        expect(result.current.status).toBe('connected');
      });

      rerender({ paused: true });

      // paused 後も直前の status が保持される
      expect(result.current.status).toBe('connected');
    });

    it('paused が true に切り替わると interval が停止する', async () => {
      fetchSpy.mockResolvedValue({ ok: true });
      const { result, rerender } = renderHook(({ paused }) => useServerHealth({ paused }), {
        initialProps: { paused: false },
      });

      await waitFor(() => {
        expect(result.current.status).toBe('connected');
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      rerender({ paused: true });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      // paused 前の 1 回のみ
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
