// Side Panel 開閉のみを担当する軽量 Service Worker

chrome.sidePanel.setOptions({ enabled: false }).catch((err) => {
  console.error('[Briefer] Failed to set default Side Panel options:', err);
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    const tabId = tab.id;

    // setOptions と open を同期的に呼び出す（await するとユーザージェスチャーが失われる）
    chrome.sidePanel
      .setOptions({
        tabId,
        path: 'sidepanel/index.html',
        enabled: true,
      })
      .catch((err) => {
        console.error(`[Briefer] Failed to setOptions for tab ${tabId}:`, err);
      });

    chrome.sidePanel.open({ tabId }).catch((err) => {
      console.error(`[Briefer] Failed to open Side Panel for tab ${tabId}:`, err);
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'briefer-ask' && tab?.id) {
    const tabId = tab.id;

    chrome.sidePanel
      .setOptions({ tabId, path: 'sidepanel/index.html', enabled: true })
      .catch((err) => {
        console.error(`[Briefer] Failed to setOptions for context menu tab ${tabId}:`, err);
      });

    chrome.sidePanel.open({ tabId }).catch((err) => {
      console.error(`[Briefer] Failed to open Side Panel for context menu:`, err);
    });

    // Side Panel が起動時に読み取れるよう storage に保存（読み取り側は Phase 2 で実装）
    if (info.selectionText) {
      chrome.storage.session.set({ [`pending_text_${tabId}`]: info.selectionText });
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'briefer-ask',
    title: 'Briefer で質問する',
    contexts: ['selection'],
  });
});
