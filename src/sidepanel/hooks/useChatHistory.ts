import { useQuery } from '@tanstack/react-query';
import type { ChatMessage, ChatState } from '@/lib/types';

const STORAGE_PREFIX = 'chat_';

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
        const key = `${STORAGE_PREFIX}${tabId}`;
        const result = await chrome.storage.session.get(key);
        const messages = (result[key] as ChatMessage[] | undefined) ?? [];
        return { messages, pageContent: null };
      } catch (error) {
        console.error('[Briefer] Failed to get chat state:', error);
        return DEFAULT_STATE;
      }
    },
    enabled: !!tabId,
  });
}
