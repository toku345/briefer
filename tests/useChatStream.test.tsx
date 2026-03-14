/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatState, StreamChunk } from '../lib/types';

vi.mock('@/lib/llm-client', () => ({
  streamChat: vi.fn(),
}));

vi.mock('@/lib/settings-store', () => ({
  getSelectedModel: vi.fn(() => Promise.resolve('test-model')),
}));

const mockChrome = {
  storage: {
    session: {
      remove: vi.fn(() => Promise.resolve()),
      set: vi.fn(() => Promise.resolve()),
    },
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome =
  mockChrome as unknown as typeof chrome;

const { useChatStream, TTFT_TIMEOUT_MS, INTER_TOKEN_TIMEOUT_MS } = await import(
  '../entrypoints/sidepanel/hooks/useChatStream'
);
const { streamChat } = await import('../lib/llm-client');
const mockStreamChat = vi.mocked(streamChat);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

const pageContent = { title: 'Test', content: 'content', url: 'http://test' };

/**
 * abort signal に応答する async generator。
 * チャンクを yield した後、abort されるまで無限に待機する。
 */
function createHangingStream(initialChunks: StreamChunk[] = []) {
  return async function* (
    _m: unknown,
    _p: unknown,
    _model: unknown,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    for (const chunk of initialChunks) {
      yield chunk;
    }
    // abort されるまで無限に待機
    await new Promise<void>((_resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  };
}

describe('useChatStream.clearChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('session storage をクリアし UI 状態をリセットする', async () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData<ChatState>(['chat', 1], {
      messages: [{ role: 'user', content: 'hello' }],
      pageContent: null,
    });

    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    await act(async () => {
      await result.current.clearChat();
    });

    expect(mockChrome.storage.session.remove).toHaveBeenCalledWith('chat_1');
    const state = queryClient.getQueryData<ChatState>(['chat', 1]);
    expect(state?.messages).toEqual([]);
    expect(state?.pageContent).toBeNull();
  });

  it('tabId が null の場合は何もしない', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(null, null), { wrapper });

    await act(async () => {
      await result.current.clearChat();
    });

    expect(mockChrome.storage.session.remove).not.toHaveBeenCalled();
  });

  it('storage 失敗時でも UI 状態はリセットされる', async () => {
    mockChrome.storage.session.remove.mockRejectedValueOnce(new Error('Storage error'));

    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData<ChatState>(['chat', 2], {
      messages: [{ role: 'user', content: 'hello' }],
      pageContent: null,
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useChatStream(2, pageContent), { wrapper });

    await act(async () => {
      await result.current.clearChat();
    });

    const state = queryClient.getQueryData<ChatState>(['chat', 2]);
    expect(state?.messages).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[useChatStream] Failed to clear session storage:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});

describe('useChatStream stall detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TTFTタイムアウト: 初回チャンクなしで60秒経過するとエラーになる', async () => {
    mockStreamChat.mockImplementation(createHangingStream([]));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    await act(async () => {
      result.current.sendMessage('hello');
    });

    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TTFT_TIMEOUT_MS);
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('サーバーからの応答がタイムアウトしました');
  });

  it('2チャンク目がトークン間タイマーをリセットする', async () => {
    // 2つのチャンクを間隔をおいて送る generator
    mockStreamChat.mockImplementation(async function* (_m, _p, _model, signal) {
      yield { type: 'chunk' as const, content: 'first' };
      // INTER_TOKEN_TIMEOUT_MS 未満待機 → タイマーリセットされるはず
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, INTER_TOKEN_TIMEOUT_MS - 1000);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
      yield { type: 'chunk' as const, content: 'second' };
      // abort されるまで待機
      await new Promise<void>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    await act(async () => {
      result.current.sendMessage('hello');
    });

    expect(result.current.isStreaming).toBe(true);

    // 1チャンク目→2チャンク目の間（INTER_TOKEN_TIMEOUT_MS - 1000ms）を進める
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTER_TOKEN_TIMEOUT_MS - 1000);
    });

    // 2チャンク目が届いてタイマーリセットされるので、まだストリーミング中
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.streamingContent).toBe('firstsecond');

    // さらに INTER_TOKEN_TIMEOUT_MS 経過 → stall 検出
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTER_TOKEN_TIMEOUT_MS);
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('サーバーからの応答がタイムアウトしました');
  });

  it('トークン間タイムアウト: 1チャンク受信後15秒経過するとエラーになり部分応答が保持される', async () => {
    mockStreamChat.mockImplementation(createHangingStream([{ type: 'chunk', content: 'partial' }]));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    await act(async () => {
      result.current.sendMessage('hello');
    });

    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTER_TOKEN_TIMEOUT_MS);
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('サーバーからの応答がタイムアウトしました');
    expect(result.current.streamingContent).toBe('partial');
  });
});

describe('useChatStream retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sendMessage未実行でretryを呼んでも何も起きない', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    await act(async () => {
      result.current.retry();
    });

    expect(mockStreamChat).not.toHaveBeenCalled();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('リトライでユーザーメッセージが重複しない', async () => {
    // 1回目: エラーで失敗
    let callCount = 0;
    mockStreamChat.mockImplementation(async function* () {
      callCount++;
      if (callCount === 1) {
        yield { type: 'error' as const, error: 'API error: 500' };
      } else {
        yield { type: 'chunk' as const, content: 'success' };
        yield { type: 'done' as const, modelId: 'test-model' };
      }
    });

    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    // 1回目送信 → エラー
    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.error).toBe('API error: 500');

    const stateAfterError = queryClient.getQueryData<ChatState>(['chat', 1]);
    const userMessagesAfterError = stateAfterError?.messages.filter((m) => m.role === 'user');
    expect(userMessagesAfterError).toHaveLength(1);

    // リトライ → 成功
    await act(async () => {
      await result.current.retry();
    });

    const stateAfterRetry = queryClient.getQueryData<ChatState>(['chat', 1]);
    const userMessagesAfterRetry = stateAfterRetry?.messages.filter((m) => m.role === 'user');
    expect(userMessagesAfterRetry).toHaveLength(1);
    expect(userMessagesAfterRetry?.[0].content).toBe('hello');
  });
});

describe('useChatStream partial response preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mid-streamエラー後にstreamingContentが保持される', async () => {
    mockStreamChat.mockImplementation(async function* () {
      yield { type: 'chunk' as const, content: 'partial response' };
      yield { type: 'error' as const, error: 'Stream error' };
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.error).toBe('Stream error');
    expect(result.current.streamingContent).toBe('partial response');
    expect(result.current.isStreaming).toBe(false);
  });

  it('clearErrorで部分応答もクリアされる', async () => {
    mockStreamChat.mockImplementation(async function* () {
      yield { type: 'chunk' as const, content: 'partial' };
      yield { type: 'error' as const, error: 'error' };
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.streamingContent).toBe('partial');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.streamingContent).toBe('');
  });

  it('キャンセル時はstreamingContentがクリアされエラーが設定されない', async () => {
    mockStreamChat.mockImplementation(createHangingStream([{ type: 'chunk', content: 'partial' }]));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useChatStream(1, pageContent), { wrapper });

    await act(async () => {
      result.current.sendMessage('hello');
    });

    // チャンクが来るまで少し待つ
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      result.current.cancel();
    });

    // cancel 後の状態を確認
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.streamingContent).toBe('');
    expect(result.current.isStreaming).toBe(false);
  });
});
