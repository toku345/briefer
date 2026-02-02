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

        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.error || 'コンテンツを取得できませんでした');
      } catch {
        // Content Scriptが注入されていない場合、動的に注入
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/index.js'],
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        const response = (await chrome.tabs.sendMessage(tabId, {
          type: 'GET_CONTENT',
        })) as ContentResponse;

        if (response.success && response.data) {
          return response.data;
        }

        const errorMsg = response.error || '';
        if (errorMsg.includes('Cannot access') || errorMsg.includes('chrome://')) {
          throw new Error('このページでは使用できません');
        }
        throw new Error('コンテンツを取得できませんでした');
      }
    },
    enabled: !!tabId,
  });
}
