import { useEffect, useRef, useState } from 'react';

interface TabInfo {
  tabId: number;
  title: string;
  url: string;
}

export function useCurrentTab() {
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabInfoRef = useRef<TabInfo | null>(null);

  useEffect(() => {
    let isMounted = true;

    function updateTab() {
      chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(([tab]) => {
          if (!isMounted) return;
          if (tab?.id) {
            setError(null);
            const info = {
              tabId: tab.id,
              title: tab.title ?? '',
              url: tab.url ?? '',
            };
            tabInfoRef.current = info;
            setTabInfo(info);
          } else {
            setError('タブが見つかりません');
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('[Briefer] Failed to query tabs:', err);
          setError('タブ情報の取得に失敗しました');
        });
    }

    updateTab();

    chrome.tabs.onActivated.addListener(updateTab);

    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (tabInfoRef.current && updatedTabId !== tabInfoRef.current.tabId) return;
      if ('title' in changeInfo || 'url' in changeInfo || changeInfo.status === 'complete') {
        updateTab();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    return () => {
      isMounted = false;
      chrome.tabs.onActivated.removeListener(updateTab);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return {
    tabId: tabInfo?.tabId ?? null,
    title: tabInfo?.title ?? null,
    url: tabInfo?.url ?? null,
    error,
  };
}
