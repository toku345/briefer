/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
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
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期状態は checking', () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useServerHealth());

    expect(result.current.status).toBe('checking');
    expect(result.current.isConnected).toBeNull();
  });

  it('サーバー応答成功時に connected を返す', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useServerHealth());

    await vi.waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('サーバー応答が非 OK の場合に disconnected を返す', async () => {
    fetchSpy.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useServerHealth());

    await vi.waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('fetch 失敗時に disconnected を返す', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useServerHealth());

    await vi.waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('30秒ごとにヘルスチェックを再実行する', async () => {
    fetchSpy.mockResolvedValue({ ok: true });
    renderHook(() => useServerHealth());

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
