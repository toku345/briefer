import { useCallback, useEffect, useState } from 'react';
import { getSettings } from '@/lib/settings-store';
import { SETTINGS_KEY } from '@/lib/types';

export type ConnectionStatus = 'connected' | 'checking' | 'disconnected';

const HEALTH_CHECK_INTERVAL_MS = 30_000;

export function useServerHealth() {
  // 初回ヘルスチェック完了まで黄色ドット表示（赤のフラッシュを回避）
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  const check = useCallback(async (mounted: { current: boolean }) => {
    let serverUrl: string;
    try {
      ({ serverUrl } = await getSettings());
    } catch (error) {
      console.debug('[useServerHealth] Failed to read settings:', error);
      if (mounted.current) setStatus('disconnected');
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (mounted.current) {
        if (response.ok) {
          setStatus('connected');
        } else {
          console.debug(`[useServerHealth] Server responded with status ${response.status}`);
          setStatus('disconnected');
        }
      }
    } catch (error) {
      if (mounted.current) setStatus('disconnected');
      console.debug('[useServerHealth] Health check failed:', error);
    }
  }, []);

  useEffect(() => {
    const mounted = { current: true };

    check(mounted);
    const id = setInterval(() => check(mounted), HEALTH_CHECK_INTERVAL_MS);

    // serverUrl 変更時に即座にヘルスチェックを再実行
    const onChanged = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes[SETTINGS_KEY]) {
        check(mounted);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);

    return () => {
      mounted.current = false;
      clearInterval(id);
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, [check]);

  return { status };
}
