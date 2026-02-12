import { useEffect, useState } from 'react';
import { getSettings } from '@/lib/settings-store';

const HEALTH_CHECK_INTERVAL_MS = 30_000;

export function useServerHealth() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      try {
        const { serverUrl } = await getSettings();
        const response = await fetch(`${serverUrl}/models`, {
          signal: AbortSignal.timeout(5000),
        });
        if (isMounted) setIsConnected(response.ok);
      } catch {
        if (isMounted) setIsConnected(false);
      }
    }

    check();
    const id = setInterval(check, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, []);

  return { isConnected };
}
