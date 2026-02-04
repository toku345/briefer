import { useEffect, useState } from 'react';

export function useCurrentTab() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!isMounted) return;
        if (tab?.id) {
          setTabId(tab.id);
        } else {
          setError('タブが見つかりません');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('[Briefer] Failed to query tabs:', err);
        setError('タブ情報の取得に失敗しました');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { tabId, error };
}
