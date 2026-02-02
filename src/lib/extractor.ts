import type { ExtractedContent } from './types';

export function extractMainContent(doc: Document): ExtractedContent {
  const title = doc.title || '';
  const url = doc.location?.href || '';
  const content = extractByPriority(doc);

  return { title, content, url };
}

function extractByPriority(doc: Document): string {
  // 1. article要素
  const article = doc.querySelector('article');
  if (article) return cleanText(article.textContent);

  // 2. main要素
  const main = doc.querySelector('main');
  if (main) return cleanText(main.textContent);

  // 3. role="main"属性
  const roleMain = doc.querySelector('[role="main"]');
  if (roleMain) return cleanText(roleMain.textContent);

  // 4. 一般的なコンテンツクラス名
  const contentSelectors = [
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
    '.content',
  ];

  for (const selector of contentSelectors) {
    const el = doc.querySelector(selector);
    if (el) return cleanText(el.textContent);
  }

  // 5. フォールバック: body全体（不要要素除去）
  return extractBodyText(doc);
}

function extractBodyText(doc: Document): string {
  const clone = doc.body.cloneNode(true) as HTMLElement;

  // 不要な要素を除去
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

function cleanText(text: string | null): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 10000); // トークン制限を考慮して最大10000文字
}
