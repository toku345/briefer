import type { ChatMessage, ChatState, ExtractedContent } from './types';

const MAX_MESSAGES = 20;

function getStorageKey(tabId: number): string {
  return `chat_${tabId}`;
}

export async function getChatState(tabId: number): Promise<ChatState> {
  const key = getStorageKey(tabId);
  const result = await chrome.storage.session.get(key);
  return (
    result[key] || {
      messages: [],
      pageContent: null,
    }
  );
}

export async function saveChatState(
  tabId: number,
  state: ChatState
): Promise<void> {
  const key = getStorageKey(tabId);
  // メッセージ数を制限
  const trimmedState: ChatState = {
    ...state,
    messages: state.messages.slice(-MAX_MESSAGES),
  };
  await chrome.storage.session.set({ [key]: trimmedState });
}

export async function addMessage(
  tabId: number,
  message: ChatMessage
): Promise<ChatState> {
  const state = await getChatState(tabId);
  state.messages.push(message);
  await saveChatState(tabId, state);
  return state;
}

export async function setPageContent(
  tabId: number,
  content: ExtractedContent
): Promise<void> {
  const state = await getChatState(tabId);
  state.pageContent = content;
  await saveChatState(tabId, state);
}

export async function clearChat(tabId: number): Promise<void> {
  const key = getStorageKey(tabId);
  await chrome.storage.session.remove(key);
}
