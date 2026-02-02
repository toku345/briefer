import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatState, ExtractedContent } from '../src/lib/types';

// chrome.storage.session のモック
const mockStorage: Record<string, ChatState> = {};

const mockChromeStorage = {
  get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
  set: vi.fn((data: Record<string, ChatState>) => {
    Object.assign(mockStorage, data);
    return Promise.resolve();
  }),
  remove: vi.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
};

// chrome グローバルをモック
(globalThis as unknown as { chrome: typeof chrome }).chrome = {
  storage: {
    session: mockChromeStorage,
  },
} as typeof chrome;

// モック設定後にモジュールをインポート
const { addMessage, clearChat, getChatState, saveChatState, setPageContent } = await import(
  '../src/lib/chat-store'
);

describe('chat-store', () => {
  const tabId = 123;
  const storageKey = `chat_${tabId}`;

  const mockPageContent: ExtractedContent = {
    title: 'Test Page',
    url: 'https://example.com',
    content: 'Test content',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // ストレージをクリア
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  });

  describe('getChatState', () => {
    it('存在する状態を取得する', async () => {
      const existingState: ChatState = {
        messages: [{ role: 'user', content: 'Hello' }],
        pageContent: mockPageContent,
      };
      mockStorage[storageKey] = existingState;

      const result = await getChatState(tabId);

      expect(result).toEqual(existingState);
      expect(mockChromeStorage.get).toHaveBeenCalledWith(storageKey);
    });

    it('存在しない場合は空の状態を返す', async () => {
      const result = await getChatState(tabId);

      expect(result).toEqual({ messages: [], pageContent: null });
    });

    it('ストレージエラー時は空の状態を返す', async () => {
      mockChromeStorage.get.mockRejectedValueOnce(new Error('Storage error'));

      const result = await getChatState(tabId);

      expect(result).toEqual({ messages: [], pageContent: null });
    });
  });

  describe('saveChatState', () => {
    it('状態を保存する', async () => {
      const state: ChatState = {
        messages: [{ role: 'user', content: 'Hello' }],
        pageContent: mockPageContent,
      };

      await saveChatState(tabId, state);

      expect(mockChromeStorage.set).toHaveBeenCalledWith({
        [storageKey]: state,
      });
    });

    it('20件を超えるメッセージを切り詰める', async () => {
      const messages: ChatMessage[] = Array.from({ length: 25 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
      }));
      const state: ChatState = { messages, pageContent: null };

      await saveChatState(tabId, state);

      const savedState = mockChromeStorage.set.mock.calls[0][0][storageKey];
      expect(savedState.messages).toHaveLength(20);
      expect(savedState.messages[0].content).toBe('Message 5');
      expect(savedState.messages[19].content).toBe('Message 24');
    });

    it('ストレージエラー時は例外をスローする', async () => {
      mockChromeStorage.set.mockRejectedValueOnce(new Error('Quota exceeded'));

      const state: ChatState = { messages: [], pageContent: null };

      await expect(saveChatState(tabId, state)).rejects.toThrow('会話履歴の保存に失敗しました');
    });
  });

  describe('addMessage', () => {
    it('メッセージを追加して状態を返す', async () => {
      const existingState: ChatState = {
        messages: [{ role: 'user', content: 'First' }],
        pageContent: null,
      };
      mockStorage[storageKey] = existingState;

      const newMessage: ChatMessage = { role: 'assistant', content: 'Response' };
      const result = await addMessage(tabId, newMessage);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]).toEqual(newMessage);
    });

    it('空の状態にメッセージを追加する', async () => {
      const message: ChatMessage = { role: 'user', content: 'Hello' };
      const result = await addMessage(tabId, message);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual(message);
    });
  });

  describe('setPageContent', () => {
    it('ページコンテンツを設定する', async () => {
      await setPageContent(tabId, mockPageContent);

      const savedState = mockChromeStorage.set.mock.calls[0][0][storageKey];
      expect(savedState.pageContent).toEqual(mockPageContent);
    });

    it('既存のメッセージを保持する', async () => {
      const existingState: ChatState = {
        messages: [{ role: 'user', content: 'Hello' }],
        pageContent: null,
      };
      mockStorage[storageKey] = existingState;

      await setPageContent(tabId, mockPageContent);

      const savedState = mockChromeStorage.set.mock.calls[0][0][storageKey];
      expect(savedState.messages).toHaveLength(1);
      expect(savedState.pageContent).toEqual(mockPageContent);
    });
  });

  describe('clearChat', () => {
    it('チャット状態を削除する', async () => {
      mockStorage[storageKey] = {
        messages: [{ role: 'user', content: 'Hello' }],
        pageContent: mockPageContent,
      };

      await clearChat(tabId);

      expect(mockChromeStorage.remove).toHaveBeenCalledWith(storageKey);
    });

    it('ストレージエラー時は例外をスローする', async () => {
      mockChromeStorage.remove.mockRejectedValueOnce(new Error('Storage error'));

      await expect(clearChat(tabId)).rejects.toThrow('会話履歴の削除に失敗しました');
    });
  });
});
