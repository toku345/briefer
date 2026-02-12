import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ActiveStream, ApiResponse, ChatState, ExtractedContent } from '@/lib/types';

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface SendMessageInput {
  userMessage: string;
  requestId: string;
  sessionId: string;
}

export function useSendMessage(
  tabId: number | null,
  pageContent: ExtractedContent | null,
  setIsStreaming: (v: boolean) => void,
  setActiveStream: (stream: ActiveStream | null) => void,
  startKeepalive: () => void,
  stopKeepalive: () => void,
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ userMessage, requestId, sessionId }: SendMessageInput) => {
      if (!tabId || !pageContent) {
        throw new Error('準備ができていません');
      }

      setActiveStream({ requestId, sessionId });

      // onMutateで既にユーザーメッセージが追加されているため、currentStateをそのまま使用
      const currentState = queryClient.getQueryData<ChatState>(['chat', tabId]);
      const messages = currentState?.messages ?? [];

      startKeepalive();

      const response = (await chrome.runtime.sendMessage({
        type: 'CHAT',
        tabId,
        requestId,
        sessionId,
        payload: {
          messages: messages.filter((m) => m.role !== 'system'),
          pageContent,
        },
      })) as ApiResponse<{ requestId: string; sessionId: string }>;

      if (!response.success) {
        throw new Error(response.error ?? 'チャットの開始に失敗しました');
      }

      if (response.data?.requestId && response.data?.sessionId) {
        setActiveStream({
          requestId: response.data.requestId,
          sessionId: response.data.sessionId,
        });
      }

      return userMessage;
    },
    onMutate: async ({ userMessage, requestId, sessionId }) => {
      setIsStreaming(true);

      await queryClient.cancelQueries({ queryKey: ['chat', tabId] });
      const previousState = queryClient.getQueryData<ChatState>(['chat', tabId]);

      queryClient.setQueryData<ChatState>(['chat', tabId], (old) => ({
        messages: [
          ...(old?.messages ?? []),
          {
            role: 'user',
            content: userMessage,
            createdAt: Date.now(),
            requestId,
            sessionId,
          },
        ],
        pageContent: old?.pageContent ?? null,
      }));

      return { previousState };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousState) {
        queryClient.setQueryData(['chat', tabId], context.previousState);
      }
      setIsStreaming(false);
      setActiveStream(null);
      stopKeepalive();
    },
  });

  const mutate = (userMessage: string) => {
    mutation.mutate({
      userMessage,
      requestId: generateId('req'),
      sessionId: `tab-${tabId ?? 'unknown'}`,
    });
  };

  return {
    ...mutation,
    mutate,
  };
}
