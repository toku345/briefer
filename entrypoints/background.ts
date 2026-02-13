// Side Panel 開閉のみを担当する軽量 Service Worker

export function setupBackground() {
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
          path: 'sidepanel.html',
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

      chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true }).catch((err) => {
        console.error(`[Briefer] Failed to setOptions for context menu tab ${tabId}:`, err);
      });

      chrome.sidePanel.open({ tabId }).catch((err) => {
        console.error(`[Briefer] Failed to open Side Panel for context menu:`, err);
      });

      // Side Panel が起動時に読み取れるよう storage に保存
      if (info.selectionText) {
        chrome.storage.session
          .set({ [`pending_text_${tabId}`]: info.selectionText })
          .catch((err) => {
            console.error(`[Briefer] Failed to save selected text for tab ${tabId}:`, err);
          });
      }
    }
  });

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create(
      {
        id: 'briefer-ask',
        title: 'Briefer で質問する',
        contexts: ['selection'],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            '[Briefer] Failed to create context menu:',
            chrome.runtime.lastError.message,
          );
        }
      },
    );
  });
}

export default defineBackground(() => {
  setupBackground();
});
