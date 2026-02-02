import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSystemMessage, chat } from '../src/lib/llm-client';
import type { ExtractedContent, ChatMessage } from '../src/lib/types';

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
  });

  describe('chat', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('APIを正しく呼び出し応答を返す', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"これは"}}]}\n'
            )
          );
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":"要約です"}}]}\n'
            )
          );
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
      ];

      const result = await chat(messages, mockPageContent);

      expect(result).toBe('これは要約です');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('APIエラー時に例外をスローする', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        body: null,
      });

      const messages: ChatMessage[] = [
        { role: 'user', content: '要約して' },
      ];

      await expect(chat(messages, mockPageContent)).rejects.toThrow(
        'API error: 500'
      );
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

      const messages: ChatMessage[] = [
        { role: 'user', content: 'test' },
      ];

      await chat(messages, mockPageContent);

      const callArgs = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.stream).toBe(true);
      expect(body.model).toBe('Qwen/Qwen3-Coder-30B-A3B-Instruct');
    });
  });
});
