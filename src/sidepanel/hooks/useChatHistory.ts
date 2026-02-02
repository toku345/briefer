import { useQuery } from '@tanstack/react-query';
import type { ChatState } from '@/lib/types';

const DEFAULT_STATE: ChatState = {
  messages: [],
  pageContent: null,
};

export function useChatHistory(tabId: number | null) {
  return useQuery<ChatState>({
    queryKey: ['chat', tabId],
    queryFn: async () => {
      if (!tabId) return DEFAULT_STATE;

      try {
        const state = (await chrome.runtime.sendMessage({
          type: 'GET_CHAT_STATE',
          tabId,
        })) as ChatState | null;

        return state ?? DEFAULT_STATE;
      } catch {
        return DEFAULT_STATE;
      }
    },
    enabled: !!tabId,
  });
}
