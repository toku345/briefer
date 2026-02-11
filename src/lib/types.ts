export interface ExtractedContent {
  title: string;
  content: string;
  url: string;
}

export interface ModelInfo {
  id: string;
  object: 'model';
  owned_by: string;
}

export interface ModelsResponse {
  object: 'list';
  data: ModelInfo[];
}

export interface ChatMessage {
  id?: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** アシスタントメッセージ生成時に使用されたモデルID */
  modelId?: string;
  createdAt?: number;
  requestId?: string;
  sessionId?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  pageContent: ExtractedContent | null;
}

export type ContentResponse =
  | { success: true; data: ExtractedContent }
  | { success: false; error: string };

export interface SummarizeRequest {
  messages: ChatMessage[];
  pageContent: ExtractedContent;
}

export type StreamChunk =
  | {
      type: 'chunk';
      content: string;
      requestId?: string;
      sessionId?: string;
      seq?: number;
    }
  | {
      type: 'done';
      modelId: string;
      requestId?: string;
      sessionId?: string;
      seq?: number;
    }
  | {
      type: 'error';
      error: string;
      requestId?: string;
      sessionId?: string;
      seq?: number;
    };

export interface ChatRequestEnvelope {
  type: 'CHAT';
  tabId: number;
  requestId?: string;
  sessionId?: string;
  payload: SummarizeRequest;
}

export interface StreamAckEnvelope {
  type: 'STREAM_ACK';
  tabId: number;
  requestId: string;
  sessionId: string;
  lastSeq: number;
}

export interface ResumeStreamEnvelope {
  type: 'RESUME_STREAM';
  tabId: number;
  requestId: string;
  sessionId: string;
  lastSeq: number;
}

export interface StreamState {
  tabId: number;
  requestId: string;
  sessionId: string;
  modelId: string;
  status: 'streaming' | 'done' | 'error';
  lastSeq: number;
  startedAt: number;
  lastAckSeq: number;
  error?: string;
}

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

export type GetChatStateResponse = ApiResponse<ChatState>;

export type GetModelsResponse = ApiResponse<ModelInfo[]>;

export type GetSelectedModelResponse = ApiResponse<string | null>;

export type SetSelectedModelResponse = ApiResponse<{ selectedModel: string }>;

export type GetStreamStateResponse = ApiResponse<StreamState | null>;

export type MessageType =
  | { type: 'GET_CONTENT' }
  | ChatRequestEnvelope
  | { type: 'STREAM_CHUNK'; tabId: number; payload: StreamChunk }
  | { type: 'GET_CHAT_STATE'; tabId: number }
  | { type: 'GET_MODELS' }
  | { type: 'GET_SELECTED_MODEL' }
  | { type: 'SET_SELECTED_MODEL'; modelId: string }
  | { type: 'GET_STREAM_STATE'; tabId: number }
  | StreamAckEnvelope
  | ResumeStreamEnvelope;

// Settings storage key (shared constant)
export const SETTINGS_KEY = 'briefer_settings';

// Port-based keepalive (MV3 Service Worker のアイドルタイムアウト対策)
export type PortMessage = { type: 'KEEPALIVE_PING' } | { type: 'KEEPALIVE_PONG' };

export const KEEPALIVE_PORT_NAME = 'briefer-keepalive';
