import { useEffect, useState } from 'react';
import { getSettings } from '@/lib/settings-store';

export type ConnectionStatus = 'connected' | 'checking' | 'disconnected';

const HEALTH_CHECK_INTERVAL_MS = 30_000;

export function useServerHealth() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  useEffect(() => {
    let isMounted = true;

    async function check() {
      let serverUrl: string;
      try {
        ({ serverUrl } = await getSettings());
      } catch (error) {
        // Extension storage failure (e.g. context invalidated) is not a server issue
        console.debug('[useServerHealth] Failed to read settings:', error);
        if (isMounted) setStatus('disconnected');
        return;
      }

      try {
        const response = await fetch(`${serverUrl}/models`, {
          signal: AbortSignal.timeout(5000),
        });
        if (isMounted) setStatus(response.ok ? 'connected' : 'disconnected');
      } catch (error) {
        if (isMounted) setStatus('disconnected');
        console.debug('[useServerHealth] Health check failed:', error);
      }
    }

    check();
    const id = setInterval(check, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, []);

  return { status };
}
