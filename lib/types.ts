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

export type StreamChunk =
  | { type: 'chunk'; content: string }
  | { type: 'done'; modelId: string }
  | { type: 'error'; error: string };

export const SETTINGS_KEY = 'briefer_settings';

export interface Settings {
  serverUrl: string;
  selectedModel: string | null;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_SETTINGS: Settings = {
  serverUrl: 'http://localhost:8000/v1',
  selectedModel: null,
  temperature: 0.3,
  maxTokens: 2048,
};

export type ErrorCategory = 'server-unreachable' | 'page-unavailable' | 'general';

export interface AppError {
  category: ErrorCategory;
  message: string;
  guidance: string;
}
