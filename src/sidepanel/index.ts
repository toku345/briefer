import type {
  ChatMessage,
  ChatState,
  ContentResponse,
  ExtractedContent,
  StreamChunk,
} from '../lib/types';

const chatContainer = document.getElementById(
  'chat-container'
) as HTMLDivElement;
const messageInput = document.getElementById(
  'message-input'
) as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

let currentTabId: number | null = null;
let pageContent: ExtractedContent | null = null;
let messages: ChatMessage[] = [];
let isStreaming = false;
let currentStreamingMessage: HTMLDivElement | null = null;

async function init(): Promise<void> {
  // 現在のタブIDを取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id ?? null;

  if (!currentTabId) {
    showError('タブが見つかりません');
    return;
  }

  // ページコンテンツを取得
  await fetchPageContent();

  // 過去のチャット履歴を読み込み
  await loadChatHistory();

  // イベントリスナー設定
  setupEventListeners();
}

async function fetchPageContent(): Promise<void> {
  if (!currentTabId) return;

  try {
    // まずContent Scriptに接続を試みる
    const response = (await chrome.tabs.sendMessage(currentTabId, {
      type: 'GET_CONTENT',
    })) as ContentResponse;

    if (response.success && response.data) {
      pageContent = response.data;
    } else {
      showError(response.error || 'コンテンツを取得できませんでした');
    }
  } catch {
    // Content Scriptが注入されていない場合、動的に注入
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content/index.js'],
      });

      // 少し待ってから再度接続を試みる
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = (await chrome.tabs.sendMessage(currentTabId, {
        type: 'GET_CONTENT',
      })) as ContentResponse;

      if (response.success && response.data) {
        pageContent = response.data;
      } else {
        showError(response.error || 'コンテンツを取得できませんでした');
      }
    } catch (e) {
      // chrome:// や拡張機能ページでは動作しない
      const errorMsg = e instanceof Error ? e.message : '';
      if (errorMsg.includes('Cannot access') || errorMsg.includes('chrome://')) {
        showError('このページでは使用できません');
      } else {
        showError('コンテンツを取得できませんでした');
      }
    }
  }
}

async function loadChatHistory(): Promise<void> {
  if (!currentTabId) return;

  try {
    const state = (await chrome.runtime.sendMessage({
      type: 'GET_CHAT_STATE',
      tabId: currentTabId,
    })) as ChatState;

    if (state?.messages?.length > 0) {
      messages = state.messages;
      renderMessages();
    }
  } catch {
    // 履歴がない場合は無視
  }
}

function setupEventListeners(): void {
  // 送信ボタン
  sendBtn.addEventListener('click', sendMessage);

  // Enter キーで送信（Shift+Enter で改行）
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // テキストエリアの自動リサイズ
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
  });

  // ストリーミングチャンクを受信
  chrome.runtime.onMessage.addListener((message) => {
    if (
      message.type === 'STREAM_CHUNK' &&
      message.tabId === currentTabId
    ) {
      handleStreamChunk(message.payload as StreamChunk);
    }
  });
}

async function sendMessage(): Promise<void> {
  const content = messageInput.value.trim();
  if (!content || isStreaming || !pageContent) return;

  // ユーザーメッセージを追加
  const userMessage: ChatMessage = { role: 'user', content };
  messages.push(userMessage);
  renderMessages();

  // 入力をクリア
  messageInput.value = '';
  messageInput.style.height = 'auto';

  // ストリーミング開始
  isStreaming = true;
  sendBtn.disabled = true;

  // アシスタントメッセージ用の要素を作成
  currentStreamingMessage = createMessageElement('assistant', '');
  currentStreamingMessage.classList.add('streaming');
  chatContainer.appendChild(currentStreamingMessage);
  scrollToBottom();

  // バックグラウンドにリクエストを送信（tabIdを含める）
  await chrome.runtime.sendMessage({
    type: 'CHAT',
    tabId: currentTabId,
    payload: {
      messages: messages.filter((m) => m.role !== 'system'),
      pageContent,
    },
  });
}

function handleStreamChunk(chunk: StreamChunk): void {
  if (chunk.type === 'chunk' && chunk.content && currentStreamingMessage) {
    currentStreamingMessage.textContent += chunk.content;
    scrollToBottom();
  } else if (chunk.type === 'done') {
    finishStreaming();
  } else if (chunk.type === 'error') {
    if (currentStreamingMessage) {
      currentStreamingMessage.remove();
    }
    showError(chunk.error || 'エラーが発生しました');
    finishStreaming();
  }
}

function finishStreaming(): void {
  if (currentStreamingMessage) {
    currentStreamingMessage.classList.remove('streaming');
    const content = currentStreamingMessage.textContent || '';
    if (content) {
      messages.push({ role: 'assistant', content });
    }
    currentStreamingMessage = null;
  }
  isStreaming = false;
  sendBtn.disabled = false;
}

function renderMessages(): void {
  // ウェルカムメッセージを削除
  const welcome = chatContainer.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  // 既存のメッセージをクリア（ストリーミング中のものを除く）
  chatContainer
    .querySelectorAll('.message:not(.streaming)')
    .forEach((el) => el.remove());

  // メッセージを描画
  for (const msg of messages) {
    const el = createMessageElement(msg.role, msg.content);
    if (currentStreamingMessage) {
      chatContainer.insertBefore(el, currentStreamingMessage);
    } else {
      chatContainer.appendChild(el);
    }
  }

  scrollToBottom();
}

function createMessageElement(
  role: 'user' | 'assistant' | 'system',
  content: string
): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `message ${role}`;
  el.textContent = content;
  return el;
}

function showError(message: string): void {
  const el = document.createElement('div');
  el.className = 'message error';
  el.textContent = message;
  chatContainer.appendChild(el);
  scrollToBottom();
}

function scrollToBottom(): void {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

init();
