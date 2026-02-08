import { useQuery } from '@tanstack/react-query';
import type { ContentResponse, ExtractedContent } from '@/lib/types';

// Content Scriptの初期化完了を待機する時間（メッセージリスナー登録に必要）
const CONTENT_SCRIPT_INIT_MS = 100;

async function requestContent(tabId: number): Promise<ExtractedContent> {
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

async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/index.js'],
  });
  await new Promise((resolve) => setTimeout(resolve, CONTENT_SCRIPT_INIT_MS));
}

function isContentScriptMissing(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Could not establish connection');
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
