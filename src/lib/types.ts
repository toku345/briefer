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
  | { type: 'done' }
  | { type: 'error'; error: string };

export type MessageType =
  | { type: 'GET_CONTENT' }
  | { type: 'CHAT'; tabId: number; payload: SummarizeRequest }
  | { type: 'STREAM_CHUNK'; tabId: number; payload: StreamChunk }
  | { type: 'GET_CHAT_STATE'; tabId: number }
  | { type: 'GET_MODELS' };
