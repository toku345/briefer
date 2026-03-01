import { useCallback, useEffect, useState } from 'react';
import type { BrieferMessage } from '@/lib/types';

const PREFIX = '以下のテキストについて質問:\n\n';

export function usePendingText(tabId: number | null) {
  const [pendingText, setPendingText] = useState<string | null>(null);

  useEffect(() => {
    if (tabId === null) return;

    // PANEL_READY を BG に送信し、保留テキストを受信
    chrome.runtime
      .sendMessage({ type: 'PANEL_READY', tabId })
      .then((response?: BrieferMessage) => {
        if (response?.type === 'PENDING_TEXT' && response.text) {
          setPendingText(PREFIX + response.text);
        }
      })
      .catch((err) => {
        console.error('[Briefer] Failed to send PANEL_READY:', err);
      });

    // SP 起動済みの場合の PENDING_TEXT リスナー
    const listener = (
      message: BrieferMessage,
      _sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: unknown) => void,
    ) => {
      if (message.type === 'PENDING_TEXT' && message.tabId === tabId && message.text) {
        setPendingText(PREFIX + message.text);
        chrome.storage.session.remove(`pending_text_${tabId}`).catch((err) => {
          console.error('[Briefer] Failed to remove pending text:', err);
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [tabId]);

  const consume = useCallback(() => {
    setPendingText(null);
  }, []);

  return { pendingText, consume };
}
