/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let mockPort: {
  name: string;
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onDisconnect: { addListener: ReturnType<typeof vi.fn> };
};

const mockConnect = vi.fn();

(globalThis as unknown as { chrome: typeof chrome }).chrome = {
  runtime: {
    connect: mockConnect,
  },
} as unknown as typeof chrome;

let useKeepalive: typeof import('../src/sidepanel/hooks/useKeepalive').useKeepalive;

describe('useKeepalive', () => {
  beforeAll(async () => {
    const module = await import('../src/sidepanel/hooks/useKeepalive');
    useKeepalive = module.useKeepalive;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockPort = {
      name: 'briefer-keepalive',
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onDisconnect: { addListener: vi.fn() },
    };
    mockConnect.mockReturnValue(mockPort);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startKeepalive がポートを接続し即座に ping を送信する', () => {
    const { result } = renderHook(() => useKeepalive());

    act(() => {
      result.current.startKeepalive();
    });

    expect(mockConnect).toHaveBeenCalledWith({ name: 'briefer-keepalive' });
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'KEEPALIVE_PING' });
  });

  it('20秒間隔で追加の ping を送信する', () => {
    const { result } = renderHook(() => useKeepalive());

    act(() => {
      result.current.startKeepalive();
    });

    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(mockPort.postMessage).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(mockPort.postMessage).toHaveBeenCalledTimes(3);
  });

  it('stopKeepalive がポートを切断し interval をクリアする', () => {
    const { result } = renderHook(() => useKeepalive());

    act(() => {
      result.current.startKeepalive();
    });

    act(() => {
      result.current.stopKeepalive();
    });

    expect(mockPort.disconnect).toHaveBeenCalled();

    // 停止後は ping が送信されない
    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
  });

  it('二重接続を防止する', () => {
    const { result } = renderHook(() => useKeepalive());

    act(() => {
      result.current.startKeepalive();
      result.current.startKeepalive();
    });

    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('onDisconnect 時に自動クリーンアップする', () => {
    const { result } = renderHook(() => useKeepalive());

    act(() => {
      result.current.startKeepalive();
    });

    const onDisconnectCallback = mockPort.onDisconnect.addListener.mock.calls[0][0];

    act(() => {
      onDisconnectCallback();
    });

    // クリーンアップ後は ping が送信されない
    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
  });
});
