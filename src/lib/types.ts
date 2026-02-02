export interface ExtractedContent {
  title: string;
  content: string;
  url: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatState {
  messages: ChatMessage[];
  pageContent: ExtractedContent | null;
}

export interface ContentResponse {
  success: boolean;
  data?: ExtractedContent;
  error?: string;
}

export interface SummarizeRequest {
  messages: ChatMessage[];
  pageContent: ExtractedContent;
}

export interface StreamChunk {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  error?: string;
}

export type MessageType =
  | { type: 'GET_CONTENT' }
  | { type: 'CHAT'; payload: SummarizeRequest }
  | { type: 'STREAM_CHUNK'; payload: StreamChunk };
