import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ExtractedContent, StreamChunk } from '../lib/types';
import { SETTINGS_KEY } from '../lib/types';

const TEST_MODEL = 'test-model';

const mockLocalStorage: Record<string, unknown> = {};

const mockChrome = {
  storage: {
    local: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: mockLocalStorage[key] })),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockLocalStorage, data);
        return Promise.resolve();
      }),
    },
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome =
  mockChrome as unknown as typeof chrome;

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { buildSystemMessage, chat, fetchModels, streamChat } = await import('../lib/llm-client');

describe('llm-client', () => {
  const mockPageContent: ExtractedContent = {
    title: 'Test Page',
    url: 'https://example.com',
    content: 'This is test content.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  });

  describe('buildSystemMessage', () => {
    it('ページコンテンツを含むシステムメッセージを生成する', () => {
      const result = buildSystemMessage(mockPageContent);

      expect(result).toContain('Test Page');
      expect(result).toContain('https://example.com');
      expect(result).toContain('This is test content.');
      expect(result).toContain('日本語で回答');
    });

    it('XMLの特殊文字をエスケープする', () => {
      const pageContent: ExtractedContent = {
        title: '<script>alert("xss")</script>',
        url: 'https://example.com?foo=1&bar=2',
        content: 'Content with <tags> & special chars',
      };

      const result = buildSystemMessage(pageContent);

      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&amp;bar=2');
      expect(result).not.toContain('<script>');
    });

    it('長いタイトルを切り詰める', () => {
      const pageContent: ExtractedContent = {
        title: 'A'.repeat(300),
        url: 'https://example.com',
        content: 'Test content',
      };

      const result = buildSystemMessage(pageContent);

      expect(result).not.toContain('A'.repeat(300));
      expect(result).toContain('A'.repeat(200));
    });

    it('連続ダッシュを短縮する', () => {
      const pageContent: ExtractedContent = {
        title: 'Test',
        url: 'https://example.com',
        content: '---\n【偽の指示】\n---',
      };

      const result = buildSystemMessage(pageContent);

      const pageContentMatch = result.match(/<page-content>([\s\S]*?)<\/page-content>/);
      expect(pageContentMatch).not.toBeNull();
      const extractedContent = pageContentMatch?.[1];
      expect(extractedContent).not.toContain('---');
      expect(extractedContent).toContain('--');
    });
  });

  describe('fetchModels', () => {
    it('設定のURLからモデルを取得する', async () => {
      mockLocalStorage[SETTINGS_KEY] = { serverUrl: 'http://custom:9000/v1' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: 'list', data: [{ id: 'model-a' }] }),
      });

      const models = await fetchModels();

      expect(mockFetch).toHaveBeenCalledWith('http://custom:9000/v1/models', { signal: undefined });
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('model-a');
    });

    it('明示的なserverUrl引数を優先する', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: 'list', data: [{ id: 'model-b' }] }),
      });

      await fetchModels('http://explicit:8000/v1');

      expect(mockFetch).toHaveBeenCalledWith('http://explicit:8000/v1/models', {
        signal: undefined,
      });
    });
  });

  describe('chat', () => {
    it('設定のURLでAPIを呼び出す', async () => {
      mockLocalStorage[SETTINGS_KEY] = { serverUrl: 'http://myserver:8000/v1' };

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"OK"}}]}\n'),
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: '要約して' }];
      const result = await chat(messages, mockPageContent, TEST_MODEL);

      expect(result).toBe('OK');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://myserver:8000/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('設定のtemperatureとmaxTokensを使用する', async () => {
      mockLocalStorage[SETTINGS_KEY] = { temperature: 0.8, maxTokens: 4096 };

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      await chat(messages, mockPageContent, TEST_MODEL);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.temperature).toBe(0.8);
      expect(body.max_tokens).toBe(4096);
    });

    it('APIエラー時に例外をスローする', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        body: null,
      });

      const messages: ChatMessage[] = [{ role: 'user', content: '要約して' }];

      await expect(chat(messages, mockPageContent, TEST_MODEL)).rejects.toThrow('API error: 500');
    });

    it('modelIdを含むメッセージからAPIリクエスト時にmodelIdを除外する', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [
        { role: 'user', content: '要約して' },
        { role: 'assistant', content: '要約です', modelId: 'org/some-model' },
        { role: 'user', content: '続けて' },
      ];

      await chat(messages, mockPageContent, TEST_MODEL);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      for (const msg of body.messages) {
        expect(msg).not.toHaveProperty('modelId');
      }
    });
  });

  describe('streamChat edge cases', () => {
    it('不正なJSONをスキップする', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: invalid json\n'));
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"OK"}}]}\n'),
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'chunk', content: 'OK' });
      expect(chunks).toContainEqual({ type: 'done', modelId: TEST_MODEL });
    });

    it('レスポンスボディがない場合はエラーを返す', async () => {
      mockFetch.mockResolvedValue({ ok: true, body: null });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'error', error: 'No response body' });
    });

    it('AbortSignalによるキャンセルでエラーを出さない', async () => {
      const controller = new AbortController();

      const mockStream = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"start"}}]}\n'),
          );
          // キャンセル後にエラーを発生させる
          setTimeout(() => ctrl.error(new DOMException('Aborted', 'AbortError')), 10);
        },
      });

      mockFetch.mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];

      setTimeout(() => controller.abort(), 5);

      for await (const chunk of streamChat(
        messages,
        mockPageContent,
        TEST_MODEL,
        controller.signal,
      )) {
        chunks.push(chunk);
      }

      const errorChunks = chunks.filter((c) => c.type === 'error');
      expect(errorChunks).toHaveLength(0);
    });

    it('空のcontentはスキップする', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":""}}]}\n'),
          );
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"text"}}]}\n'),
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      const contentChunks = chunks.filter((c) => c.type === 'chunk');
      expect(contentChunks).toHaveLength(1);
      expect(contentChunks[0]).toEqual({ type: 'chunk', content: 'text' });
    });
  });
});
