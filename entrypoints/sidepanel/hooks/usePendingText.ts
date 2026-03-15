import { useCallback, useEffect, useState } from 'react';
import type { BrieferMessage } from '@/lib/types';

const PREFIX = '以下のテキストについて質問:\n\n';

export function usePendingText(tabId: number | null) {
  const [pendingText, setPendingText] = useState<string | null>(null);

  useEffect(() => {
    if (tabId === null) return;
    let mounted = true;
    let receivedDirectMessage = false;

    // PANEL_READY を BG に送信し、保留テキストを受信
    chrome.runtime
      .sendMessage({ type: 'PANEL_READY', tabId })
      .then((response?: BrieferMessage) => {
        // 直送メッセージを既に受信済みなら、古い PANEL_READY 応答は無視
        if (
          mounted &&
          !receivedDirectMessage &&
          response?.type === 'PENDING_TEXT' &&
          response.text
        ) {
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
      if (mounted && message.type === 'PENDING_TEXT' && message.tabId === tabId && message.text) {
        receivedDirectMessage = true;
        setPendingText(PREFIX + message.text);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      mounted = false;
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [tabId]);

  const consume = useCallback(() => {
    setPendingText(null);
  }, []);

  return { pendingText, consume };
}
