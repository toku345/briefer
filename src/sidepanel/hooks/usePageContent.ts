import { useQuery } from '@tanstack/react-query';
import type { ContentResponse, ExtractedContent } from '@/lib/types';

export function usePageContent(tabId: number | null) {
  return useQuery<ExtractedContent, Error>({
    queryKey: ['pageContent', tabId],
    queryFn: async () => {
      if (!tabId) throw new Error('タブIDがありません');

      try {
        const response = (await chrome.tabs.sendMessage(tabId, {
          type: 'GET_CONTENT',
        })) as ContentResponse;

        if (response.success) {
          return response.data;
        }
        throw new Error(response.error);
      } catch {
        // Content Scriptが注入されていない場合、動的に注入
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/index.js'],
        });

        // Content Scriptの初期化完了を待機（メッセージリスナー登録まで時間がかかる）
        await new Promise((resolve) => setTimeout(resolve, 100));

        const response = (await chrome.tabs.sendMessage(tabId, {
          type: 'GET_CONTENT',
        })) as ContentResponse;

        if (response.success) {
          return response.data;
        }

        if (response.error.includes('Cannot access') || response.error.includes('chrome://')) {
          throw new Error('このページでは使用できません');
        }
        throw new Error(response.error);
      }
    },
    enabled: !!tabId,
  });
}
