/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorMessage } from '../entrypoints/sidepanel/components/ErrorMessage';
import type { AppError } from '../lib/types';

describe('ErrorMessage', () => {
  const serverError: AppError = {
    category: 'server-unreachable',
    message: 'サーバーに接続できません',
    guidance: 'vLLMサーバーが起動しているか確認してください。',
  };

  const pageError: AppError = {
    category: 'page-unavailable',
    message: 'このページでは使用できません',
    guidance: 'このページでは使用できません。通常のWebページで試してください。',
  };

  const generalError: AppError = {
    category: 'general',
    message: 'API error: 500',
    guidance: '時間をおいて再試行するか、拡張機能を再読み込みしてください。',
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
});
