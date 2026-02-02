import type { ChatMessage, ExtractedContent, StreamChunk } from './types';

const VLLM_BASE_URL = 'http://localhost:8000/v1';
const DEFAULT_MODEL = 'Qwen/Qwen3-Coder-30B-A3B-Instruct';

interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

const SYSTEM_PROMPT = `あなたは優秀なアシスタントです。
ユーザーが閲覧しているWebページについて質問に答えてください。

以下のページコンテンツを参照して回答してください。
ユーザーが「要約して」と言った場合は、以下の形式で簡潔に要約してください：

1. **概要**: 1-2文でページの主題を説明
2. **要点**: 3-5個の箇条書きで重要なポイントを列挙

日本語で回答してください。`;

export function buildSystemMessage(pageContent: ExtractedContent): string {
  return `${SYSTEM_PROMPT}

---
【ページタイトル】
${pageContent.title}

【URL】
${pageContent.url}

【ページコンテンツ】
${pageContent.content}
---`;
}

export async function* streamChat(
  messages: ChatMessage[],
  pageContent: ExtractedContent,
): AsyncGenerator<StreamChunk> {
  const systemMessage = buildSystemMessage(pageContent);

  const request: ChatCompletionRequest = {
    model: DEFAULT_MODEL,
    messages: [{ role: 'system', content: systemMessage }, ...messages],
    max_tokens: 1024,
    temperature: 0.3,
    stream: true,
  };

  console.log('[LLM] Sending request to:', `${VLLM_BASE_URL}/chat/completions`);
  console.log('[LLM] Request model:', DEFAULT_MODEL);

  const response = await fetch(`${VLLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  console.log('[LLM] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[LLM] Error response:', errorText);
    yield {
      type: 'error',
      error: `API error: ${response.status} ${response.statusText}`,
    };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            yield { type: 'chunk', content };
          }
        } catch {
          // JSON parse error - skip
        }
      }
    }

    yield { type: 'done' };
  } catch (error) {
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    reader.releaseLock();
  }
}

export async function chat(
  messages: ChatMessage[],
  pageContent: ExtractedContent,
): Promise<string> {
  let result = '';
  for await (const chunk of streamChat(messages, pageContent)) {
    if (chunk.type === 'chunk' && chunk.content) {
      result += chunk.content;
    } else if (chunk.type === 'error') {
      throw new Error(chunk.error);
    }
  }
  return result;
}
