import { useQuery } from '@tanstack/react-query';
import type { ContentResponse, ExtractedContent } from '@/lib/types';

// executeScript完了後、リスナー登録には非同期の遅延があり即sendMessageすると接続エラーになる
const CONTENT_SCRIPT_INIT_MS = 100;

async function requestContent(tabId: number): Promise<ExtractedContent> {
  const response = (await chrome.tabs.sendMessage(tabId, {
    type: 'GET_CONTENT',
  })) as ContentResponse | undefined;

  if (!response) {
    throw new Error('ページからの応答がありませんでした');
  }

  if (response.success) {
    return response.data;
  }

  if (response.error.includes('Cannot access') || response.error.includes('chrome://')) {
    throw new Error('このページでは使用できません');
  }
  throw new Error(response.error);
}

async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/index.js'],
  });
  await new Promise((resolve) => setTimeout(resolve, CONTENT_SCRIPT_INIT_MS));
}

function isContentScriptMissing(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('Could not establish connection') ||
    error.message.includes('message port closed')
  );
}

export function usePageContent(tabId: number | null) {
  return useQuery<ExtractedContent, Error>({
    queryKey: ['pageContent', tabId],
    queryFn: async () => {
      if (!tabId) throw new Error('タブIDがありません');

      try {
        return await requestContent(tabId);
      } catch (error) {
        if (!isContentScriptMissing(error)) throw error;

        await injectContentScript(tabId);
        return await requestContent(tabId);
      }
    },
    enabled: !!tabId,
  });
}
