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
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** アシスタントメッセージ生成時に使用されたモデルID */
  modelId?: string;
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
  | { type: 'chunk'; content: string }
  | { type: 'done'; modelId: string }
  | { type: 'error'; error: string };

export type MessageType =
  | { type: 'GET_CONTENT' }
  | { type: 'CHAT'; tabId: number; payload: SummarizeRequest }
  | { type: 'STREAM_CHUNK'; tabId: number; payload: StreamChunk }
  | { type: 'GET_CHAT_STATE'; tabId: number }
  | { type: 'GET_MODELS' }
  | { type: 'CANCEL_CHAT'; tabId: number }
  | { type: 'SELECTED_TEXT'; tabId: number; text: string }
  | { type: 'SIDEPANEL_READY'; tabId: number };

// Chrome runtime message response types
export interface GetModelsResponse {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
}

// Settings storage key (shared constant)
export const SETTINGS_KEY = 'briefer_settings';

export interface Settings {
  selectedModel: string;
  vllmBaseUrl?: string;
}

// Port-based keepalive (MV3 Service Worker のアイドルタイムアウト対策)
export type PortMessage = { type: 'KEEPALIVE_PING' } | { type: 'KEEPALIVE_PONG' };

export const KEEPALIVE_PORT_NAME = 'briefer-keepalive';
