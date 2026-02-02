import { addMessage, getChatState, setPageContent } from '../lib/chat-store';
import { streamChat } from '../lib/llm-client';
import type { ChatMessage, StreamChunk, SummarizeRequest } from '../lib/types';

// 送信元が自拡張機能であることを検証（他の拡張機能からの不正なメッセージを拒否）
function isValidSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

// サイドパネルを開く
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// メッセージハンドラ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type);

  // 送信元検証: 自拡張機能からのメッセージのみ受け付け
  if (!isValidSender(sender)) {
    console.warn('[Background] Rejected message from unknown sender:', sender.id);
    return false;
  }

  if (message.type === 'CHAT') {
    // tabId検証: sender.tab?.id を優先（Side Panelからは undefined）
    const tabId = sender.tab?.id ?? message.tabId;
    if (typeof tabId !== 'number' || tabId < 0) {
      console.error('[Background] Invalid tabId:', tabId);
      sendResponse({ success: false, error: 'Invalid tabId' });
      return true;
    }
    console.log('[Background] Starting chat with tabId:', tabId);
    console.log('[Background] Payload:', message.payload);
    handleChat(message.payload, tabId).catch((e) => {
      console.error('[Background] Chat error:', e);
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

  return false;
});

async function handleChat(request: SummarizeRequest, tabId: number | undefined): Promise<void> {
  console.log('[Background] handleChat called with tabId:', tabId);
  if (!tabId) {
    console.error('[Background] tabId is undefined, aborting');
    return;
  }

  // ページコンテンツを保存
  await setPageContent(tabId, request.pageContent);

  // ユーザーメッセージを追加
  const userMessage = request.messages[request.messages.length - 1];
  await addMessage(tabId, userMessage);

  // ストリーミングでチャット
  let fullResponse = '';

  try {
    console.log('[Background] Starting stream chat...');
    for await (const chunk of streamChat(request.messages, request.pageContent)) {
      console.log('[Background] Received chunk:', chunk);
      // サイドパネルにチャンクを送信
      await sendToSidePanel(tabId, chunk);

      if (chunk.type === 'chunk' && chunk.content) {
        fullResponse += chunk.content;
      }
    }
    console.log('[Background] Stream complete, fullResponse length:', fullResponse.length);

    // アシスタントメッセージを保存
    if (fullResponse) {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
      };
      await addMessage(tabId, assistantMessage);
    }
  } catch (error) {
    console.error('[Background] Stream error:', error);
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
  } catch {
    // サイドパネルが閉じている場合は無視
  }
}
