import { addMessage, getChatState, setPageContent } from '../lib/chat-store';
import { fetchModels, streamChat } from '../lib/llm-client';
import { getSelectedModel, saveSelectedModel } from '../lib/settings-store';
import { ThinkTagFilter } from '../lib/think-tag-filter';
import {
  type ApiResponse,
  type ChatMessage,
  type ChatRequestEnvelope,
  type GetChatStateResponse,
  type GetModelsResponse,
  type GetSelectedModelResponse,
  type GetStreamStateResponse,
  KEEPALIVE_PORT_NAME,
  type PortMessage,
  type ResumeStreamEnvelope,
  type SetSelectedModelResponse,
  type StreamAckEnvelope,
  type StreamChunk,
  type StreamState,
  type SummarizeRequest,
} from '../lib/types';

interface InMemoryStreamState extends StreamState {
  events: StreamChunk[];
  updatedAt: number;
}

type OutgoingStreamEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; modelId: string }
  | { type: 'error'; error: string };

const streamStates = new Map<string, InMemoryStreamState>();
const latestStreamByTab = new Map<number, string>();

function now(): number {
  return Date.now();
}

function createRequestId(): string {
  return `req_${now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSessionId(tabId: number): string {
  return `tab-${tabId}`;
}

function createMessageId(role: ChatMessage['role']): string {
  return `${role}_${now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function streamKey(tabId: number, sessionId: string, requestId: string): string {
  return `${tabId}:${sessionId}:${requestId}`;
}

// 送信元が自拡張機能であることを検証（他の拡張機能からの不正なメッセージを拒否）
function isValidSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

function isValidTabId(tabId: unknown): tabId is number {
  return typeof tabId === 'number' && tabId >= 0;
}

function isChatEnvelope(message: unknown): message is ChatRequestEnvelope {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'CHAT' &&
    'payload' in message
  );
}

function isStreamAckEnvelope(message: unknown): message is StreamAckEnvelope {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'STREAM_ACK'
  );
}

function isResumeStreamEnvelope(message: unknown): message is ResumeStreamEnvelope {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'RESUME_STREAM'
  );
}

function toSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

function toFailure(error: string): ApiResponse<never> {
  return { success: false, error };
}

function registerStream(params: {
  tabId: number;
  requestId: string;
  sessionId: string;
  modelId: string;
}): InMemoryStreamState {
  const state: InMemoryStreamState = {
    tabId: params.tabId,
    requestId: params.requestId,
    sessionId: params.sessionId,
    modelId: params.modelId,
    status: 'streaming',
    lastSeq: 0,
    startedAt: now(),
    lastAckSeq: 0,
    events: [],
    updatedAt: now(),
  };

  const key = streamKey(params.tabId, params.sessionId, params.requestId);
  streamStates.set(key, state);
  latestStreamByTab.set(params.tabId, key);
  return state;
}

async function emitStreamEvent(state: InMemoryStreamState, event: OutgoingStreamEvent) {
  const nextSeq = state.lastSeq + 1;
  state.lastSeq = nextSeq;
  state.updatedAt = now();

  const payload: StreamChunk = {
    ...event,
    requestId: state.requestId,
    sessionId: state.sessionId,
    seq: nextSeq,
  };

  state.events.push(payload);
  // メモリ利用を抑えるため、直近200イベントのみ保持
  if (state.events.length > 200) {
    state.events = state.events.slice(-200);
  }

  await sendToSidePanel(state.tabId, payload);
}

async function cacheLatestUserMessage(
  tabId: number,
  request: SummarizeRequest,
  requestId: string,
  sessionId: string,
): Promise<void> {
  const latestMessage = request.messages[request.messages.length - 1];
  if (!latestMessage || latestMessage.role !== 'user') {
    return;
  }

  const state = await getChatState(tabId);
  const storedLast = state.messages[state.messages.length - 1];
  if (storedLast?.role === 'user' && storedLast.content === latestMessage.content) {
    return;
  }

  await addMessage(tabId, {
    id: createMessageId('user'),
    role: 'user',
    content: latestMessage.content,
    createdAt: now(),
    requestId,
    sessionId,
  });
}

async function handleChat(
  request: SummarizeRequest,
  tabId: number,
  requestId: string,
  sessionId: string,
): Promise<void> {
  await setPageContent(tabId, request.pageContent);
  await cacheLatestUserMessage(tabId, request, requestId, sessionId);
  const model = await getSelectedModel();

  let fullResponse = '';
  const filter = new ThinkTagFilter();
  const streamState = registerStream({ tabId, requestId, sessionId, modelId: model });

  try {
    for await (const chunk of streamChat(request.messages, request.pageContent, model)) {
      if (chunk.type === 'chunk' && chunk.content) {
        const filtered = filter.process(chunk.content);
        fullResponse += filtered;
        if (filtered) {
          await emitStreamEvent(streamState, { type: 'chunk', content: filtered });
        }
        continue;
      }

      if (chunk.type === 'error') {
        streamState.status = 'error';
        streamState.error = chunk.error;
        await emitStreamEvent(streamState, { type: 'error', error: chunk.error });
      }
    }

    const remaining = filter.flush();
    if (remaining) {
      fullResponse += remaining;
      await emitStreamEvent(streamState, { type: 'chunk', content: remaining });
    }

    if (fullResponse) {
      const assistantMessage: ChatMessage = {
        id: createMessageId('assistant'),
        role: 'assistant',
        content: fullResponse,
        modelId: model,
        createdAt: now(),
        requestId,
        sessionId,
      };
      await addMessage(tabId, assistantMessage);
    }

    if (streamState.status !== 'error') {
      streamState.status = 'done';
      await emitStreamEvent(streamState, {
        type: 'done',
        modelId: model,
      });
    }
  } catch (error) {
    streamState.status = 'error';
    streamState.error = error instanceof Error ? error.message : 'Unknown error';
    await emitStreamEvent(streamState, {
      type: 'error',
      error: streamState.error,
    });
  }
}

function handleAck(message: StreamAckEnvelope): void {
  if (!isValidTabId(message.tabId)) {
    return;
  }

  const key = streamKey(message.tabId, message.sessionId, message.requestId);
  const state = streamStates.get(key);
  if (!state) {
    return;
  }

  state.lastAckSeq = Math.max(state.lastAckSeq, message.lastSeq);
  state.updatedAt = now();
}

async function handleResume(
  message: ResumeStreamEnvelope,
): Promise<ApiResponse<{ resent: number }>> {
  if (!isValidTabId(message.tabId)) {
    return toFailure('Invalid tabId');
  }

  const key = streamKey(message.tabId, message.sessionId, message.requestId);
  const state = streamStates.get(key);
  if (!state) {
    return toSuccess({ resent: 0 });
  }

  const pending = state.events.filter((event) => (event.seq ?? 0) > message.lastSeq);
  for (const event of pending) {
    await sendToSidePanel(message.tabId, event);
  }

  return toSuccess({ resent: pending.length });
}

function getLatestStreamState(tabId: number): StreamState | null {
  const key = latestStreamByTab.get(tabId);
  if (!key) return null;

  const stream = streamStates.get(key);
  if (!stream) return null;

  return {
    tabId: stream.tabId,
    requestId: stream.requestId,
    sessionId: stream.sessionId,
    modelId: stream.modelId,
    status: stream.status,
    lastSeq: stream.lastSeq,
    startedAt: stream.startedAt,
    lastAckSeq: stream.lastAckSeq,
    error: stream.error,
  };
}

// Keepalive ポート: Side Panel からの定期 ping で Service Worker のアイドルタイムアウトを防止
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== KEEPALIVE_PORT_NAME) return;

  port.onMessage.addListener((msg: PortMessage) => {
    if (msg.type === 'KEEPALIVE_PING') {
      try {
        port.postMessage({ type: 'KEEPALIVE_PONG' } satisfies PortMessage);
      } catch {
        // ポートが既に切断されている場合は無視
      }
    }
  });
});

// デフォルトで Side Panel を無効化（明示的に開いたタブでのみ有効にする）
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 送信元検証: 自拡張機能からのメッセージのみ受け付け
  if (!isValidSender(sender)) {
    return false;
  }

  if (isChatEnvelope(message)) {
    // tabId検証: sender.tab?.id を優先（Side Panelからは undefined）
    const tabId = sender.tab?.id ?? message.tabId;
    if (!isValidTabId(tabId)) {
      sendResponse(toFailure('Invalid tabId'));
      return true;
    }

    const requestId = message.requestId ?? createRequestId();
    const sessionId = message.sessionId ?? createSessionId(tabId);

    handleChat(message.payload, tabId, requestId, sessionId).catch((error) => {
      console.error('[Briefer] handleChat failed:', error);
      const chunk: StreamChunk = {
        type: 'error',
        error: error instanceof Error ? error.message : 'チャット処理に失敗しました',
        requestId,
        sessionId,
      };
      sendToSidePanel(tabId, chunk);
    });

    sendResponse(toSuccess({ requestId, sessionId }));
    return true;
  }

  if (isStreamAckEnvelope(message)) {
    handleAck(message);
    sendResponse(toSuccess({ ok: true }));
    return true;
  }

  if (isResumeStreamEnvelope(message)) {
    handleResume(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse(toFailure(error instanceof Error ? error.message : 'Failed to resume stream'));
      });
    return true;
  }

  if (typeof message === 'object' && message !== null && 'type' in message) {
    if (message.type === 'GET_CHAT_STATE') {
      const tabId = message.tabId;
      if (!isValidTabId(tabId)) {
        sendResponse(toFailure('Invalid tabId') satisfies GetChatStateResponse);
        return true;
      }

      getChatState(tabId)
        .then((state) => sendResponse(toSuccess(state) satisfies GetChatStateResponse))
        .catch((error) => {
          sendResponse(
            toFailure(
              error instanceof Error ? error.message : 'Failed to get chat state',
            ) satisfies GetChatStateResponse,
          );
        });
      return true;
    }

    if (message.type === 'GET_MODELS') {
      fetchModels()
        .then((models) => sendResponse(toSuccess(models) satisfies GetModelsResponse))
        .catch((error) =>
          sendResponse(
            toFailure(
              error instanceof Error ? error.message : 'Failed to fetch models',
            ) satisfies GetModelsResponse,
          ),
        );
      return true;
    }

    if (message.type === 'GET_SELECTED_MODEL') {
      getSelectedModel()
        .then((selectedModel) =>
          sendResponse(toSuccess(selectedModel) satisfies GetSelectedModelResponse),
        )
        .catch((error) =>
          sendResponse(
            toFailure(
              error instanceof Error ? error.message : 'Failed to get selected model',
            ) satisfies GetSelectedModelResponse,
          ),
        );
      return true;
    }

    if (message.type === 'SET_SELECTED_MODEL') {
      if (typeof message.modelId !== 'string' || message.modelId.trim() === '') {
        sendResponse(toFailure('Invalid modelId') satisfies SetSelectedModelResponse);
        return true;
      }

      saveSelectedModel(message.modelId)
        .then(() =>
          sendResponse(
            toSuccess({ selectedModel: message.modelId }) satisfies SetSelectedModelResponse,
          ),
        )
        .catch((error) =>
          sendResponse(
            toFailure(
              error instanceof Error ? error.message : 'Failed to save model',
            ) satisfies SetSelectedModelResponse,
          ),
        );
      return true;
    }

    if (message.type === 'GET_STREAM_STATE') {
      const tabId = message.tabId;
      if (!isValidTabId(tabId)) {
        sendResponse(toFailure('Invalid tabId') satisfies GetStreamStateResponse);
        return true;
      }

      sendResponse(toSuccess(getLatestStreamState(tabId)) satisfies GetStreamStateResponse);
      return true;
    }
  }

  return false;
});

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
