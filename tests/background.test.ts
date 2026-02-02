import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatState, ExtractedContent, SummarizeRequest } from '../src/lib/types';

// メッセージリスナーを保持
let messageListener: (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

let actionClickedListener: (tab: chrome.tabs.Tab) => void;

// モックストレージ
const mockStorage: Record<string, ChatState> = {};

// Chrome API モック
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    onMessage: {
      addListener: vi.fn((listener) => {
        messageListener = listener;
      }),
    },
    sendMessage: vi.fn(),
  },
  action: {
    onClicked: {
      addListener: vi.fn((listener) => {
        actionClickedListener = listener;
      }),
    },
  },
  sidePanel: {
    open: vi.fn(),
  },
  storage: {
    session: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
      set: vi.fn((data: Record<string, ChatState>) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
      remove: vi.fn((key: string) => {
        delete mockStorage[key];
        return Promise.resolve();
      }),
    },
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome =
  mockChrome as unknown as typeof chrome;

// fetch モック
const mockFetch = vi.fn();
global.fetch = mockFetch;

// モジュールをインポート（モック設定後）
await import('../src/background/index');

describe('background service worker', () => {
  const mockPageContent: ExtractedContent = {
    title: 'Test Page',
    url: 'https://example.com',
    content: 'Test content',
  };

  const validSender: chrome.runtime.MessageSender = {
    id: 'test-extension-id',
  };

  const invalidSender: chrome.runtime.MessageSender = {
    id: 'malicious-extension-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
  });

  describe('セキュリティ検証', () => {
    it('自拡張機能からのメッセージを受け付ける', () => {
      const sendResponse = vi.fn();
      const result = messageListener(
        { type: 'GET_CHAT_STATE', tabId: 123 },
        validSender,
        sendResponse,
      );

      expect(result).toBe(true);
    });

    it('他の拡張機能からのメッセージを拒否する', () => {
      const sendResponse = vi.fn();
      const result = messageListener(
        { type: 'GET_CHAT_STATE', tabId: 123 },
        invalidSender,
        sendResponse,
      );

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });

  describe('CHAT メッセージ', () => {
    it('有効なtabIdでCHATメッセージを処理する', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"response"}}]}\n'),
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({ ok: true, body: mockStream });

      const sendResponse = vi.fn();
      const request: SummarizeRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        pageContent: mockPageContent,
      };

      const result = messageListener(
        { type: 'CHAT', tabId: 123, payload: request },
        validSender,
        sendResponse,
      );

      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('無効なtabIdでエラーを返す', () => {
      const sendResponse = vi.fn();
      const request: SummarizeRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        pageContent: mockPageContent,
      };

      messageListener({ type: 'CHAT', tabId: -1, payload: request }, validSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid tabId',
      });
    });

    it('tabIdが数値でない場合エラーを返す', () => {
      const sendResponse = vi.fn();
      const request: SummarizeRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        pageContent: mockPageContent,
      };

      messageListener(
        { type: 'CHAT', tabId: 'invalid', payload: request },
        validSender,
        sendResponse,
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid tabId',
      });
    });
  });

  describe('GET_CHAT_STATE メッセージ', () => {
    it('チャット状態を取得する', async () => {
      const existingState: ChatState = {
        messages: [{ role: 'user', content: 'Hello' }],
        pageContent: mockPageContent,
      };
      mockStorage.chat_123 = existingState;

      const sendResponse = vi.fn();
      messageListener({ type: 'GET_CHAT_STATE', tabId: 123 }, validSender, sendResponse);

      // 非同期処理の完了を待つ
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendResponse).toHaveBeenCalledWith(existingState);
    });

    it('無効なtabIdでエラーを返す', () => {
      const sendResponse = vi.fn();
      messageListener({ type: 'GET_CHAT_STATE', tabId: -1 }, validSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid tabId',
      });
    });
  });

  describe('アクションボタン', () => {
    it('クリック時にサイドパネルを開く', async () => {
      const tab: chrome.tabs.Tab = { id: 456 } as chrome.tabs.Tab;

      actionClickedListener(tab);

      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 456 });
    });

    it('タブIDがない場合はサイドパネルを開かない', async () => {
      const tab: chrome.tabs.Tab = {} as chrome.tabs.Tab;

      actionClickedListener(tab);

      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled();
    });
  });

  describe('未知のメッセージタイプ', () => {
    it('未知のメッセージタイプはfalseを返す', () => {
      const sendResponse = vi.fn();
      const result = messageListener({ type: 'UNKNOWN' }, validSender, sendResponse);

      expect(result).toBe(false);
    });
  });
});
