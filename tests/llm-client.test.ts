import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSystemMessage, chat, streamChat } from '../src/lib/llm-client';
import type { ChatMessage, ExtractedContent, StreamChunk } from '../src/lib/types';

const TEST_MODEL = 'test-model';

describe('llm-client', () => {
  const mockPageContent: ExtractedContent = {
    title: 'Test Page',
    url: 'https://example.com',
    content: 'This is test content.',
  };

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

      // ページコンテンツ部分を抽出して検証（プロンプト内のテーブル区切り線は除外）
      const pageContentMatch = result.match(/<page-content>([\s\S]*?)<\/page-content>/);
      expect(pageContentMatch).not.toBeNull();
      const extractedContent = pageContentMatch?.[1];
      expect(extractedContent).not.toContain('---');
      expect(extractedContent).toContain('--');
    });
  });

  describe('chat', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('APIを正しく呼び出し応答を返す', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"これは"}}]}\n'),
          );
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"要約です"}}]}\n'),
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const messages: ChatMessage[] = [{ role: 'user', content: '要約して' }];

      const result = await chat(messages, mockPageContent, TEST_MODEL);

      expect(result).toBe('これは要約です');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('APIエラー時に例外をスローする', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Internal Server Error'),
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const messages: ChatMessage[] = [
        { role: 'user', content: '要約して' },
        { role: 'assistant', content: '要約です', modelId: 'org/some-model' },
        { role: 'user', content: '続けて' },
      ];

      await chat(messages, mockPageContent, TEST_MODEL);

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      for (const msg of body.messages) {
        expect(msg).not.toHaveProperty('modelId');
      }
    });

    it('ストリーミングリクエストを送信する', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];

      await chat(messages, mockPageContent, TEST_MODEL);

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.stream).toBe(true);
      expect(body.model).toBe(TEST_MODEL);
    });
  });

  describe('streamChat edge cases', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

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

      global.fetch = vi.fn().mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'chunk', content: 'OK' });
      expect(chunks).toContainEqual({ type: 'done', modelId: TEST_MODEL });
    });

    it('レスポンスボディがない場合はエラーを返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, body: null });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      expect(chunks).toContainEqual({ type: 'error', error: 'No response body' });
    });

    it('choices配列がない場合はスキップする', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"invalid": true}\n'));
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"valid"}}]}\n'),
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      const contentChunks = chunks.filter((c) => c.type === 'chunk');
      expect(contentChunks).toHaveLength(1);
      expect(contentChunks[0]).toEqual({ type: 'chunk', content: 'valid' });
    });

    it('ストリーム読み取り中のエラーを処理する', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Network error'));
        },
      });

      global.fetch = vi.fn().mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual({ type: 'error', error: 'Network error' });
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

      global.fetch = vi.fn().mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      const contentChunks = chunks.filter((c) => c.type === 'chunk');
      expect(contentChunks).toHaveLength(1);
      expect(contentChunks[0]).toEqual({ type: 'chunk', content: 'text' });
    });

    it('data: プレフィックスのない行はスキップする', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('comment line\n'));
          controller.enqueue(new TextEncoder().encode(': SSE comment\n'));
          controller.enqueue(
            new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n'),
          );
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({ ok: true, body: mockStream });

      const messages: ChatMessage[] = [{ role: 'user', content: 'test' }];
      const chunks: StreamChunk[] = [];
      for await (const chunk of streamChat(messages, mockPageContent, TEST_MODEL)) {
        chunks.push(chunk);
      }

      const contentChunks = chunks.filter((c) => c.type === 'chunk');
      expect(contentChunks).toHaveLength(1);
    });
  });
});
