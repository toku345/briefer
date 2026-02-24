/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatState } from '../lib/types';

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

const { useChatStream } = await import('../entrypoints/sidepanel/hooks/useChatStream');

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
