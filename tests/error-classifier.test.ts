import { describe, expect, it } from 'vitest';
import { classifyError } from '../lib/error-classifier';

describe('classifyError', () => {
  it('すべてnullの場合はnullを返す', () => {
    expect(classifyError(null, null, null)).toBeNull();
  });

  // --- tabError ---
  it('tabErrorがある場合はgeneralカテゴリを返す', () => {
    const result = classifyError('タブが見つかりません', null, null);
    expect(result).toEqual({
      category: 'general',
      message: 'タブが見つかりません',
      guidance: expect.stringContaining('再試行'),
    });
  });

  // --- contentError: page-unavailable ---
  it('contentErrorが「このページでは使用できません」の場合はpage-unavailableを返す', () => {
    const err = new Error('このページでは使用できません');
    const result = classifyError(null, err, null);
    expect(result?.category).toBe('page-unavailable');
    expect(result?.guidance).toContain('通常のWebページ');
  });

  it('contentErrorが「Cannot access」を含む場合はpage-unavailableを返す', () => {
    const err = new Error('Cannot access a chrome:// URL');
    const result = classifyError(null, err, null);
    expect(result?.category).toBe('page-unavailable');
  });

  it('contentErrorが「chrome://」を含む場合はpage-unavailableを返す', () => {
    const err = new Error('chrome:// pages cannot be scripted');
    const result = classifyError(null, err, null);
    expect(result?.category).toBe('page-unavailable');
  });

  it('contentErrorがその他のエラーの場合はgeneralを返す', () => {
    const err = new Error('ページからの応答がありませんでした');
    const result = classifyError(null, err, null);
    expect(result?.category).toBe('general');
    expect(result?.message).toBe('ページからの応答がありませんでした');
  });

  // --- streamError: server-unreachable ---
  it('streamErrorが「Failed to fetch」の場合はserver-unreachableを返す', () => {
    const result = classifyError(null, null, 'Failed to fetch');
    expect(result?.category).toBe('server-unreachable');
    expect(result?.message).toBe('サーバーに接続できません');
    expect(result?.guidance).toContain('vLLMサーバー');
  });

  it('streamErrorが「Load failed」の場合はserver-unreachableを返す', () => {
    const result = classifyError(null, null, 'Load failed');
    expect(result?.category).toBe('server-unreachable');
  });

  it('streamErrorが「NetworkError」の場合はserver-unreachableを返す', () => {
    const result = classifyError(null, null, 'NetworkError when attempting to fetch resource');
    expect(result?.category).toBe('server-unreachable');
  });

  it('streamErrorが「ERR_CONNECTION_REFUSED」の場合はserver-unreachableを返す', () => {
    const result = classifyError(null, null, 'net::ERR_CONNECTION_REFUSED');
    expect(result?.category).toBe('server-unreachable');
  });

  // --- streamError: general ---
  it('streamErrorがAPIエラーの場合はgeneralを返す', () => {
    const result = classifyError(null, null, 'API error: 500 Internal Server Error');
    expect(result?.category).toBe('general');
    expect(result?.message).toBe('API error: 500 Internal Server Error');
  });

  // --- 優先順位 ---
  it('tabError > contentError > streamError の優先順位で判定する', () => {
    const contentErr = new Error('このページでは使用できません');
    const result = classifyError('タブエラー', contentErr, 'Failed to fetch');
    expect(result?.category).toBe('general');
    expect(result?.message).toBe('タブエラー');
  });

  it('contentError > streamError の優先順位で判定する', () => {
    const contentErr = new Error('このページでは使用できません');
    const result = classifyError(null, contentErr, 'Failed to fetch');
    expect(result?.category).toBe('page-unavailable');
  });

  // --- guidance ---
  it('各カテゴリにguidanceが設定されている', () => {
    const tab = classifyError('err', null, null);
    const content = classifyError(null, new Error('このページでは使用できません'), null);
    const stream = classifyError(null, null, 'Failed to fetch');

    expect(tab?.guidance).toBeTruthy();
    expect(content?.guidance).toBeTruthy();
    expect(stream?.guidance).toBeTruthy();
  });
});
