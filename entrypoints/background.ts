// Side Panel 開閉 + PANEL_READY/PENDING_TEXT メッセージングを担当する Service Worker
import type { BrieferMessage } from '@/lib/types';

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

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'briefer-ask' && tab?.id) {
      const tabId = tab.id;

      // storage 書込を await してから open（PANEL_READY とのレースコンディション排除）
      if (info.selectionText) {
        await chrome.storage.session
          .set({ [`pending_text_${tabId}`]: info.selectionText })
          .catch((err) => {
            console.error(`[Briefer] Failed to save selected text for tab ${tabId}:`, err);
          });
      }

      chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true }).catch((err) => {
        console.error(`[Briefer] Failed to setOptions for context menu tab ${tabId}:`, err);
      });

      chrome.sidePanel.open({ tabId }).catch((err) => {
        console.error(`[Briefer] Failed to open Side Panel for context menu:`, err);
      });

      // SP 起動済みの場合に直接テキストを送信（失敗は無視 → PANEL_READY フローにフォールバック）
      if (info.selectionText) {
        chrome.runtime
          .sendMessage({
            type: 'PENDING_TEXT',
            tabId,
            text: info.selectionText,
          } satisfies BrieferMessage)
          .catch(() => {});
      }
    }
  });

  // PANEL_READY: SP 起動時に保留テキストを返却
  chrome.runtime.onMessage.addListener(
    (message: BrieferMessage, _sender, sendResponse: (response?: BrieferMessage) => void) => {
      if (message.type === 'PANEL_READY') {
        const key = `pending_text_${message.tabId}`;
        chrome.storage.session.get(key).then((result) => {
          const text = (result[key] as string) ?? '';
          sendResponse({ type: 'PENDING_TEXT', tabId: message.tabId, text });
          if (text) {
            chrome.storage.session.remove(key).catch((err) => {
              console.error(
                `[Briefer] Failed to remove pending text for tab ${message.tabId}:`,
                err,
              );
            });
          }
        });
        // 非同期 sendResponse のため true を返す
        return true;
      }
    },
  );

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
