import { useCallback, useRef } from 'react';
import { KEEPALIVE_PORT_NAME, type PortMessage } from '@/lib/types';

const PING_INTERVAL_MS = 20_000;

export function useKeepalive() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopKeepalive = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (portRef.current) {
      try {
        portRef.current.disconnect();
      } catch {
        // 既に切断されている場合は無視
      }
      portRef.current = null;
    }
  }, []);

  const startKeepalive = useCallback(() => {
    if (portRef.current) return;

    try {
      const port = chrome.runtime.connect({ name: KEEPALIVE_PORT_NAME });
      portRef.current = port;

      port.postMessage({ type: 'KEEPALIVE_PING' } satisfies PortMessage);

      intervalRef.current = setInterval(() => {
        try {
          port.postMessage({ type: 'KEEPALIVE_PING' } satisfies PortMessage);
        } catch {
          stopKeepalive();
        }
      }, PING_INTERVAL_MS);

      port.onDisconnect.addListener(() => {
        stopKeepalive();
      });
    } catch {
      stopKeepalive();
    }
  }, [stopKeepalive]);

  return { startKeepalive, stopKeepalive };
}
