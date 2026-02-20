/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WelcomeMessage } from '../entrypoints/sidepanel/components/WelcomeMessage';

describe('WelcomeMessage', () => {
  it('3つのクイックアクションボタンが表示される', () => {
    render(<WelcomeMessage onAction={vi.fn()} disabled={false} />);

    expect(screen.getByRole('button', { name: '要約' })).toBeDefined();
    expect(screen.getByRole('button', { name: '重要ポイント' })).toBeDefined();
    expect(screen.getByRole('button', { name: '簡単に説明' })).toBeDefined();
  });

  it('ボタンクリック時に対応メッセージでonActionが呼ばれる', () => {
    const onAction = vi.fn();
    render(<WelcomeMessage onAction={onAction} disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: '要約' }));
    expect(onAction).toHaveBeenCalledWith('このページを要約して');

    fireEvent.click(screen.getByRole('button', { name: '重要ポイント' }));
    expect(onAction).toHaveBeenCalledWith('このページの重要なポイントを教えて');

    fireEvent.click(screen.getByRole('button', { name: '簡単に説明' }));
    expect(onAction).toHaveBeenCalledWith('このページを簡単に説明して');
  });

  it('disabled=trueのときボタンが無効になる', () => {
    render(<WelcomeMessage onAction={vi.fn()} disabled={true} />);

    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('disabled=trueのときクリックしてもonActionが呼ばれない', () => {
    const onAction = vi.fn();
    render(<WelcomeMessage onAction={onAction} disabled={true} />);

    fireEvent.click(screen.getByRole('button', { name: '要約' }));
    expect(onAction).not.toHaveBeenCalled();
  });
});
