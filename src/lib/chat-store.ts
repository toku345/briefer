import type { ChatMessage, ChatState, ExtractedContent } from './types';

// chrome.storage.session のクォータ制限（1MB）を超えないよう、古いメッセージを削除
const MAX_MESSAGES = 20;

function getStorageKey(tabId: number): string {
  return `chat_${tabId}`;
}

function isChatState(value: unknown): value is ChatState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'messages' in value &&
    'pageContent' in value
  );
}

export async function getChatState(tabId: number): Promise<ChatState> {
  const key = getStorageKey(tabId);
  try {
    const result = await chrome.storage.session.get(key);
    const stored = result[key];
    if (isChatState(stored)) {
      return stored;
    }
    return { messages: [], pageContent: null };
  } catch (error) {
    console.error('[Briefer] Failed to get chat state:', error);
    return { messages: [], pageContent: null };
  }
}

export async function saveChatState(tabId: number, state: ChatState): Promise<void> {
  const key = getStorageKey(tabId);
  const trimmedState: ChatState = {
    ...state,
    messages: state.messages.slice(-MAX_MESSAGES),
  };
  try {
    await chrome.storage.session.set({ [key]: trimmedState });
  } catch (error) {
    console.error('[Briefer] Failed to save chat state:', error);
    throw new Error('会話履歴の保存に失敗しました');
  }
}

export async function addMessage(tabId: number, message: ChatMessage): Promise<ChatState> {
  const state = await getChatState(tabId);
  state.messages.push(message);
  await saveChatState(tabId, state);
  return state;
}

export async function setPageContent(tabId: number, content: ExtractedContent): Promise<void> {
  const state = await getChatState(tabId);
  state.pageContent = content;
  await saveChatState(tabId, state);
}

export async function clearChat(tabId: number): Promise<void> {
  const key = getStorageKey(tabId);
  try {
    await chrome.storage.session.remove(key);
  } catch (error) {
    console.error('[Briefer] Failed to clear chat:', error);
    throw new Error('会話履歴の削除に失敗しました');
  }
}
