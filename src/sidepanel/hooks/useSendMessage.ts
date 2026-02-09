import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChatState, ExtractedContent } from '@/lib/types';

export function useSendMessage(
  tabId: number | null,
  pageContent: ExtractedContent | null,
  setIsStreaming: (v: boolean) => void,
  startKeepalive: () => void,
  stopKeepalive: () => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userMessage: string) => {
      if (!tabId || !pageContent) {
        throw new Error('準備ができていません');
      }

      // onMutateで既にユーザーメッセージが追加されているため、currentStateをそのまま使用
      const currentState = queryClient.getQueryData<ChatState>(['chat', tabId]);
      const messages = currentState?.messages ?? [];

      startKeepalive();

      await chrome.runtime.sendMessage({
        type: 'CHAT',
        tabId,
        payload: {
          messages: messages.filter((m) => m.role !== 'system'),
          pageContent,
        },
      });

      return userMessage;
    },
    onMutate: async (userMessage) => {
      setIsStreaming(true);

      await queryClient.cancelQueries({ queryKey: ['chat', tabId] });
      const previousState = queryClient.getQueryData<ChatState>(['chat', tabId]);

      queryClient.setQueryData<ChatState>(['chat', tabId], (old) => ({
        messages: [...(old?.messages ?? []), { role: 'user', content: userMessage }],
        pageContent: old?.pageContent ?? null,
      }));

      return { previousState };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousState) {
        queryClient.setQueryData(['chat', tabId], context.previousState);
      }
      setIsStreaming(false);
      stopKeepalive();
    },
  });
}
