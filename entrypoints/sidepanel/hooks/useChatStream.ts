import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { STALL_TIMEOUT_MESSAGE } from '@/lib/error-classifier';
import { streamChat } from '@/lib/llm-client';
import { getSelectedModel } from '@/lib/settings-store';
import { ThinkTagFilter } from '@/lib/think-tag-filter';
import type { ChatMessage, ChatState, ExtractedContent } from '@/lib/types';

const MAX_MESSAGES = 20;
const STORAGE_PREFIX = 'chat_';

/** Time To First Token: 最初のチャンクが届くまでの許容時間 */
export const TTFT_TIMEOUT_MS = 60_000;
/** トークン間の許容間隔: 次のチャンクが届かなければ stall と判定 */
export const INTER_TOKEN_TIMEOUT_MS = 15_000;

async function persistMessages(tabId: number, messages: ChatMessage[]): Promise<void> {
  const trimmed = messages.slice(-MAX_MESSAGES);
  await chrome.storage.session.set({ [`${STORAGE_PREFIX}${tabId}`]: trimmed });
}

export function useChatStream(tabId: number | null, pageContent: ExtractedContent | null) {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string | null>(null);

  const sendMessageCore = useCallback(
    async (userMessage: string, options?: { skipUserMessageAppend?: boolean }) => {
      if (!tabId || !pageContent || abortRef.current) return;

      setError(null);
      setIsStreaming(true);
      setStreamingContent('');

      if (!options?.skipUserMessageAppend) {
        queryClient.setQueryData<ChatState>(['chat', tabId], (old) => ({
          messages: [...(old?.messages ?? []), { role: 'user', content: userMessage }],
          pageContent: old?.pageContent ?? null,
        }));
      }

      lastUserMessageRef.current = userMessage;

      const currentState = queryClient.getQueryData<ChatState>(['chat', tabId]);
      const allMessages = currentState?.messages ?? [];

      let model: string | null;
      try {
        model = await getSelectedModel();
      } catch {
        setError('モデル情報の取得に失敗しました');
        setIsStreaming(false);
        return;
      }

      if (!model) {
        setError('モデルが選択されていません');
        setIsStreaming(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      let fullResponse = '';
      let didFail = false;
      let stallTimedOut = false;
      let stallTimerId: ReturnType<typeof setTimeout> | undefined;
      const filter = new ThinkTagFilter();

      function resetStallTimer(ms: number) {
        if (stallTimerId !== undefined) clearTimeout(stallTimerId);
        stallTimerId = setTimeout(() => {
          stallTimedOut = true;
          controller.abort();
        }, ms);
      }

      try {
        const apiMessages = allMessages.filter((m) => m.role !== 'system');

        resetStallTimer(TTFT_TIMEOUT_MS);

        for await (const chunk of streamChat(apiMessages, pageContent, model, controller.signal)) {
          if (chunk.type === 'chunk' && chunk.content) {
            resetStallTimer(INTER_TOKEN_TIMEOUT_MS);

            const filtered = filter.process(chunk.content);
            fullResponse += filtered;
            if (filtered) {
              setStreamingContent((prev) => prev + filtered);
            }
          } else if (chunk.type === 'error') {
            setError(chunk.error);
            didFail = true;
            break;
          }
        }

        const remaining = filter.flush();
        if (remaining) {
          fullResponse += remaining;
          setStreamingContent((prev) => prev + remaining);
        }

        if (fullResponse && !didFail && !controller.signal.aborted) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: fullResponse,
            modelId: model,
          };

          const updatedMessages = [...allMessages, assistantMessage];

          queryClient.setQueryData<ChatState>(['chat', tabId], (old) => ({
            messages: updatedMessages,
            pageContent: old?.pageContent ?? null,
          }));

          try {
            await persistMessages(tabId, updatedMessages);
          } catch (persistErr) {
            console.error('[useChatStream] Failed to persist messages:', persistErr);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[useChatStream] Stream error:', err);
          setError(err instanceof Error ? err.message : 'エラーが発生しました');
          didFail = true;
        } else if (stallTimedOut) {
          setError(STALL_TIMEOUT_MESSAGE);
          didFail = true;
        }
        // ユーザーキャンセル（aborted && !stallTimedOut）→ エラーなし
      } finally {
        if (stallTimerId !== undefined) clearTimeout(stallTimerId);
        if (abortRef.current === controller) {
          abortRef.current = null;
          if (!didFail) {
            setStreamingContent('');
          }
          setIsStreaming(false);
        }
      }
    },
    [tabId, pageContent, queryClient],
  );

  const sendMessage = useCallback(
    (userMessage: string) => sendMessageCore(userMessage),
    [sendMessageCore],
  );

  const retry = useCallback(() => {
    const lastMessage = lastUserMessageRef.current;
    if (!lastMessage) return;
    sendMessageCore(lastMessage, { skipUserMessageAppend: true }).catch((err) => {
      console.error('[useChatStream] Retry failed:', err);
    });
  }, [sendMessageCore]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(async () => {
    if (!tabId) return;
    abortRef.current?.abort();
    abortRef.current = null;
    lastUserMessageRef.current = null;
    setError(null);
    setStreamingContent('');
    setIsStreaming(false);
    queryClient.setQueryData<ChatState>(['chat', tabId], { messages: [], pageContent: null });
    try {
      await chrome.storage.session.remove(`${STORAGE_PREFIX}${tabId}`);
    } catch (err) {
      console.error('[useChatStream] Failed to clear session storage:', err);
    }
  }, [tabId, queryClient]);

  const clearError = useCallback(() => {
    setError(null);
    setStreamingContent('');
  }, []);

  return {
    sendMessage,
    retry,
    cancel,
    clearChat,
    streamingContent,
    isStreaming,
    error,
    clearError,
  };
}
