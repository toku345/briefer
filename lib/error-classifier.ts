import type { AppError, ErrorCategory } from './types';

const GUIDANCE: Record<ErrorCategory, string> = {
  'server-unreachable': 'vLLMサーバーが起動しているか確認してください。',
  'page-unavailable': 'このページでは使用できません。通常のWebページで試してください。',
  general: '時間をおいて再試行するか、拡張機能を再読み込みしてください。',
};

const PAGE_UNAVAILABLE_PATTERNS = ['このページでは使用できません', 'Cannot access', 'chrome://'];

const SERVER_UNREACHABLE_PATTERNS = [
  'Failed to fetch',
  'NetworkError',
  'ERR_CONNECTION_REFUSED',
  'Load failed',
];

function matchesAny(message: string, patterns: string[]): boolean {
  return patterns.some((p) => message.includes(p));
}

/**
 * 3種のエラーソースを統一的に分類する。
 * 優先順位: tabError > contentError > streamError
 */
export function classifyError(
  tabError: string | null,
  contentError: Error | null,
  streamError: string | null,
): AppError | null {
  if (tabError) {
    return {
      category: 'general',
      message: tabError,
      guidance: GUIDANCE.general,
    };
  }

  if (contentError) {
    const msg = contentError.message;
    if (matchesAny(msg, PAGE_UNAVAILABLE_PATTERNS)) {
      return {
        category: 'page-unavailable',
        message: 'このページでは使用できません',
        guidance: GUIDANCE['page-unavailable'],
      };
    }
    return {
      category: 'general',
      message: msg,
      guidance: GUIDANCE.general,
    };
  }

  if (streamError) {
    if (matchesAny(streamError, SERVER_UNREACHABLE_PATTERNS)) {
      return {
        category: 'server-unreachable',
        message: 'サーバーに接続できません',
        guidance: GUIDANCE['server-unreachable'],
      };
    }
    return {
      category: 'general',
      message: streamError,
      guidance: GUIDANCE.general,
    };
  }

  return null;
}
