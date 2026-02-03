import { addMessage, getChatState, setPageContent } from '../lib/chat-store';
import { fetchModels, streamChat } from '../lib/llm-client';
import { getSelectedModel } from '../lib/settings-store';
import type { ChatMessage, StreamChunk, SummarizeRequest } from '../lib/types';

// 送信元が自拡張機能であることを検証（他の拡張機能からの不正なメッセージを拒否）
function isValidSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 送信元検証: 自拡張機能からのメッセージのみ受け付け
  if (!isValidSender(sender)) {
    return false;
  }

  if (message.type === 'CHAT') {
    // tabId検証: sender.tab?.id を優先（Side Panelからは undefined）
    const tabId = sender.tab?.id ?? message.tabId;
    if (typeof tabId !== 'number' || tabId < 0) {
      sendResponse({ success: false, error: 'Invalid tabId' });
      return true;
    }
    handleChat(message.payload, tabId).catch((error) => {
      console.error('[Briefer] handleChat failed:', error);
      sendToSidePanel(tabId, {
        type: 'error',
        error: error instanceof Error ? error.message : 'チャット処理に失敗しました',
      });
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_CHAT_STATE') {
    const tabId = message.tabId;
    if (typeof tabId !== 'number' || tabId < 0) {
      sendResponse({ success: false, error: 'Invalid tabId' });
      return true;
    }
    getChatState(tabId).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_MODELS') {
    fetchModels()
      .then((models) => sendResponse({ success: true, models }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch models',
        }),
      );
    return true;
  }

  return false;
});

async function handleChat(request: SummarizeRequest, tabId: number): Promise<void> {
  await setPageContent(tabId, request.pageContent);
  const model = await getSelectedModel();

  let fullResponse = '';

  try {
    for await (const chunk of streamChat(request.messages, request.pageContent, model)) {
      await sendToSidePanel(tabId, chunk);

      if (chunk.type === 'chunk' && chunk.content) {
        fullResponse += chunk.content;
      }
    }

    if (fullResponse) {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
      };
      await addMessage(tabId, assistantMessage);
    }
  } catch (error) {
    const errorChunk: StreamChunk = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await sendToSidePanel(tabId, errorChunk);
  }
}

async function sendToSidePanel(tabId: number, chunk: StreamChunk): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: 'STREAM_CHUNK',
      tabId,
      payload: chunk,
    });
  } catch (error) {
    // サイドパネルが閉じている場合は期待される動作
    if (
      error instanceof Error &&
      (error.message.includes('Could not establish connection') ||
        error.message.includes('Receiving end does not exist'))
    ) {
      return;
    }
    console.error('[Briefer] Failed to send to side panel:', error);
  }
}
