/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorMessage } from '../entrypoints/sidepanel/components/ErrorMessage';
import type { AppError } from '../lib/types';

describe('ErrorMessage', () => {
  const serverError: AppError = {
    category: 'server-unreachable',
    message: 'サーバーに接続できません',
    guidance: 'vLLMサーバーが起動しているか確認してください。',
    retryable: true,
  };

  const pageError: AppError = {
    category: 'page-unavailable',
    message: 'このページでは使用できません',
    guidance: 'このページでは使用できません。通常のWebページで試してください。',
    retryable: false,
  };

  const generalError: AppError = {
    category: 'general',
    message: 'API error: 500',
    guidance: '時間をおいて再試行するか、拡張機能を再読み込みしてください。',
    retryable: false,
  };

  it('server-unreachable エラーを表示する', () => {
    render(<ErrorMessage error={serverError} />);

    expect(screen.getByText('サーバーに接続できません')).not.toBeNull();
    expect(screen.getByText(serverError.guidance)).not.toBeNull();
  });

  it('page-unavailable エラーを表示する', () => {
    render(<ErrorMessage error={pageError} />);

    expect(screen.getByText('このページでは使用できません')).not.toBeNull();
    expect(screen.getByText(pageError.guidance)).not.toBeNull();
  });

  it('general エラーを表示する', () => {
    render(<ErrorMessage error={generalError} />);

    expect(screen.getByText('API error: 500')).not.toBeNull();
    expect(screen.getByText(generalError.guidance)).not.toBeNull();
  });

  it('role="alert" が設定されている', () => {
    render(<ErrorMessage error={serverError} />);

    expect(screen.getByRole('alert')).not.toBeNull();
  });

  it('カテゴリに応じたCSSクラスが適用される', () => {
    const { rerender } = render(<ErrorMessage error={serverError} />);
    expect(screen.getByRole('alert').className).toContain('error-server-unreachable');

    rerender(<ErrorMessage error={pageError} />);
    expect(screen.getByRole('alert').className).toContain('error-page-unavailable');

    rerender(<ErrorMessage error={generalError} />);
    expect(screen.getByRole('alert').className).toContain('error-general');
  });

  it('stream-stalled カテゴリのCSSクラスが適用される', () => {
    const stalledError: AppError = {
      category: 'stream-stalled',
      message: 'タイムアウト',
      guidance: 'サーバーの負荷が高い可能性があります。再試行してください。',
      retryable: true,
    };
    render(<ErrorMessage error={stalledError} />);
    expect(screen.getByRole('alert').className).toContain('error-stream-stalled');
  });

  it('retryable=true + onRetry ありの場合「再試行」ボタンが表示される', () => {
    const retryableError: AppError = {
      category: 'general',
      message: 'error',
      guidance: 'guidance',
      retryable: true,
    };
    const onRetry = vi.fn();
    render(<ErrorMessage error={retryableError} onRetry={onRetry} />);

    const retryBtn = screen.getByRole('button', { name: '再試行' });
    expect(retryBtn).not.toBeNull();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retryable=false の場合「再試行」ボタンが表示されない', () => {
    const nonRetryableError: AppError = {
      category: 'general',
      message: 'error',
      guidance: 'guidance',
      retryable: false,
    };
    const onRetry = vi.fn();
    render(<ErrorMessage error={nonRetryableError} onRetry={onRetry} />);

    expect(screen.queryByRole('button', { name: '再試行' })).toBeNull();
  });

  it('onRetry なしの場合「再試行」ボタンが表示されない', () => {
    const retryableError: AppError = {
      category: 'general',
      message: 'error',
      guidance: 'guidance',
      retryable: true,
    };
    render(<ErrorMessage error={retryableError} />);

    expect(screen.queryByRole('button', { name: '再試行' })).toBeNull();
  });

  it('onDismiss ありの場合「閉じる」ボタンが表示される', () => {
    const onDismiss = vi.fn();
    render(<ErrorMessage error={generalError} onDismiss={onDismiss} />);

    const dismissBtn = screen.getByRole('button', { name: '閉じる' });
    expect(dismissBtn).not.toBeNull();
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
