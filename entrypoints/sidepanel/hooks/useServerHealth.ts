import { useEffect, useState } from 'react';
import { getSettings } from '@/lib/settings-store';

export type ConnectionStatus = 'connected' | 'checking' | 'disconnected';

const HEALTH_CHECK_INTERVAL_MS = 30_000;

export function useServerHealth() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  useEffect(() => {
    let isMounted = true;

    async function check() {
      try {
        const { serverUrl } = await getSettings();
        const response = await fetch(`${serverUrl}/models`, {
          signal: AbortSignal.timeout(5000),
        });
        if (isMounted) setStatus(response.ok ? 'connected' : 'disconnected');
      } catch {
        if (isMounted) setStatus('disconnected');
      }
    }

    check();
    const id = setInterval(check, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, []);

  const isConnected = status === 'connected' ? true : status === 'disconnected' ? false : null;

  return { isConnected, status };
}
