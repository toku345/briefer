import { describe, expect, it } from 'vitest';
import { getPlaceholder } from '../entrypoints/sidepanel/App';
import type { AppError } from '../lib/types';

describe('getPlaceholder', () => {
  const serverError: AppError = {
    category: 'server-unreachable',
    message: 'サーバーに接続できません',
    guidance: 'vLLM サーバーが起動しているか確認してください。',
  };

  const pageError: AppError = {
    category: 'page-unavailable',
    message: 'このページでは使用できません',
    guidance: '通常の Web ページで試してください。',
  };

  it('server-unreachableエラー時', () => {
    expect(
      getPlaceholder(
        1,
        { title: 'Test', content: 'text', url: 'https://example.com' },
        serverError,
      ),
    ).toBe('サーバーに接続できません');
  });

  it('page-unavailableエラー時', () => {
    expect(getPlaceholder(1, null, pageError)).toBe('このページでは使用できません');
  });

  it('tabIdがnullのとき', () => {
    expect(getPlaceholder(null, null, null)).toBe('タブ情報を取得中...');
  });

  it('pageContentがnullのとき', () => {
    expect(getPlaceholder(1, null, null)).toBe('ページを読み込み中...');
  });

  it('正常状態', () => {
    expect(
      getPlaceholder(1, { title: 'Test', content: 'text', url: 'https://example.com' }, null),
    ).toBe('メッセージを入力...');
  });
});
