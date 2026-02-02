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
      } catch (error) {
        // Service Worker未起動の場合は空の状態を返す（初回アクセス時）
        if (
          error instanceof Error &&
          (error.message.includes('Could not establish connection') ||
            error.message.includes('Receiving end does not exist'))
        ) {
          return DEFAULT_STATE;
        }
        console.error('[Briefer] Failed to get chat state:', error);
        throw new Error('会話履歴の読み込みに失敗しました');
      }
    },
    enabled: !!tabId,
  });
}
