import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { streamChat } from '@/lib/llm-client';
import { getSelectedModel } from '@/lib/settings-store';
import { ThinkTagFilter } from '@/lib/think-tag-filter';
import type { ChatMessage, ChatState, ExtractedContent } from '@/lib/types';

const MAX_MESSAGES = 20;
const STORAGE_PREFIX = 'chat_';

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

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!tabId || !pageContent || abortRef.current) return;

      setError(null);
      setIsStreaming(true);
      setStreamingContent('');

      // 楽観的更新: ユーザーメッセージを即座に反映
      queryClient.setQueryData<ChatState>(['chat', tabId], (old) => ({
        messages: [...(old?.messages ?? []), { role: 'user', content: userMessage }],
        pageContent: old?.pageContent ?? null,
      }));

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
      let hasError = false;
      const filter = new ThinkTagFilter();

      try {
        const apiMessages = allMessages.filter((m) => m.role !== 'system');

        for await (const chunk of streamChat(apiMessages, pageContent, model, controller.signal)) {
          if (chunk.type === 'chunk' && chunk.content) {
            const filtered = filter.process(chunk.content);
            fullResponse += filtered;
            if (filtered) {
              setStreamingContent((prev) => prev + filtered);
            }
          } else if (chunk.type === 'error') {
            setError(chunk.error);
            hasError = true;
            break;
          }
        }

        const remaining = filter.flush();
        if (remaining) {
          fullResponse += remaining;
          setStreamingContent((prev) => prev + remaining);
        }

        if (fullResponse && !hasError) {
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

          await persistMessages(tabId, updatedMessages);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'エラーが発生しました');
        }
      } finally {
        abortRef.current = null;
        setStreamingContent('');
        setIsStreaming(false);
      }
    },
    [tabId, pageContent, queryClient],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearChat = useCallback(async () => {
    if (!tabId) return;
    abortRef.current?.abort();
    await chrome.storage.session.remove(`${STORAGE_PREFIX}${tabId}`);
    queryClient.setQueryData<ChatState>(['chat', tabId], { messages: [], pageContent: null });
    setError(null);
    setStreamingContent('');
    setIsStreaming(false);
  }, [tabId, queryClient]);

  const clearError = useCallback(() => setError(null), []);

  return { sendMessage, cancel, clearChat, streamingContent, isStreaming, error, clearError };
}
