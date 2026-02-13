import { useQuery } from '@tanstack/react-query';
import type { ExtractedContent } from '@/lib/types';

// chrome.scripting.executeScript に渡す自己完結型の抽出関数
// シリアライズされて Content Script コンテキストで実行されるため、外部参照不可
function extractFromPage(): ExtractedContent {
  const title = document.title || '';
  const url = document.location?.href || '';

  function cleanText(text: string | null): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim().slice(0, 10000);
  }

  function extractByPriority(): string {
    const article = document.querySelector('article');
    if (article) return cleanText(article.textContent);

    const main = document.querySelector('main');
    if (main) return cleanText(main.textContent);

    const roleMain = document.querySelector('[role="main"]');
    if (roleMain) return cleanText(roleMain.textContent);

    const contentSelectors = [
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
      '.content',
    ];
    for (const selector of contentSelectors) {
      const el = document.querySelector(selector);
      if (el) return cleanText(el.textContent);
    }

    // フォールバック: body全体（不要要素除去）
    const clone = document.body.cloneNode(true) as HTMLElement;
    const removeSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      'noscript',
      'iframe',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
    ];
    for (const sel of removeSelectors) {
      for (const el of clone.querySelectorAll(sel)) {
        el.remove();
      }
    }
    return cleanText(clone.textContent);
  }

  return { title, content: extractByPriority(), url };
}

export function usePageContent(tabId: number | null) {
  return useQuery<ExtractedContent, Error>({
    queryKey: ['pageContent', tabId],
    queryFn: async () => {
      if (!tabId) throw new Error('タブIDがありません');

      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId },
          func: extractFromPage,
        });

        if (!result?.result) {
          throw new Error('ページからの応答がありませんでした');
        }

        return result.result as ExtractedContent;
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('Cannot access') || error.message.includes('chrome://'))
        ) {
          throw new Error('このページでは使用できません');
        }
        throw error;
      }
    },
    enabled: !!tabId,
  });
}
