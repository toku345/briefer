import { useEffect, useState } from 'react';

export function useCurrentTab() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (tab?.id) {
          setTabId(tab.id);
        } else {
          setError('タブが見つかりません');
        }
      })
      .catch((err) => {
        console.error('[Briefer] Failed to query tabs:', err);
        setError('タブ情報の取得に失敗しました');
      });

    const handleActivated = (activeInfo: chrome.tabs.OnActivatedInfo) => {
      setTabId(activeInfo.tabId);
      setError(null);
    };

    chrome.tabs.onActivated.addListener(handleActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
    };
  }, []);

  return { tabId, error };
}
