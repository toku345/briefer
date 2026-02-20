import type { AppError, ExtractedContent } from './types';

export function getPlaceholder(
  tabId: number | null,
  pageContent: ExtractedContent | null,
  error: AppError | null,
): string {
  if (error?.category === 'server-unreachable') return 'サーバーに接続できません';
  if (error?.category === 'page-unavailable') return 'このページでは使用できません';
  if (error) return 'エラーが発生しています';
  if (tabId === null) return 'タブ情報を取得中...';
  if (!pageContent) return 'ページを読み込み中...';
  return 'メッセージを入力...';
}
