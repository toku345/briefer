/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InputContainer } from '../entrypoints/sidepanel/components/InputContainer';

describe('InputContainer', () => {
  const defaultProps = {
    onSend: vi.fn(),
    onCancel: vi.fn(),
    isStreaming: false,
    disabled: false,
    placeholder: 'メッセージを入力...',
  };

  it('placeholder propがtextareaに反映される', () => {
    render(<InputContainer {...defaultProps} placeholder="サーバーに接続できません" />);

    expect(screen.getByPlaceholderText('サーバーに接続できません')).toBeDefined();
  });

  it('状態に応じたplaceholderが表示される', () => {
    const { rerender } = render(
      <InputContainer {...defaultProps} placeholder="ページを読み込み中..." disabled={true} />,
    );
    expect(screen.getByPlaceholderText('ページを読み込み中...')).toBeDefined();

    rerender(
      <InputContainer {...defaultProps} placeholder="メッセージを入力..." disabled={false} />,
    );
    expect(screen.getByPlaceholderText('メッセージを入力...')).toBeDefined();
  });

  it('初期状態でtextareaのvalueが空である', () => {
    render(<InputContainer {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('メッセージを入力...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('送信後にtextareaがクリアされる', () => {
    const onSend = vi.fn();
    render(<InputContainer {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('メッセージを入力...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'テスト' } });
    fireEvent.click(screen.getByText('送信'));

    expect(textarea.value).toBe('');
  });

  it('送信ボタンクリックでonSendが呼ばれる', () => {
    const onSend = vi.fn();
    render(<InputContainer {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('メッセージを入力...');
    fireEvent.change(textarea, { target: { value: 'テスト' } });
    fireEvent.click(screen.getByText('送信'));

    expect(onSend).toHaveBeenCalledWith('テスト');
  });

  it('空文字列では送信されない', () => {
    const onSend = vi.fn();
    render(<InputContainer {...defaultProps} onSend={onSend} />);

    fireEvent.click(screen.getByText('送信'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disabled=trueでは送信されない', () => {
    const onSend = vi.fn();
    render(<InputContainer {...defaultProps} onSend={onSend} disabled={true} />);

    const textarea = screen.getByPlaceholderText('メッセージを入力...');
    fireEvent.change(textarea, { target: { value: 'テスト' } });
    fireEvent.click(screen.getByText('送信'));

    expect(onSend).not.toHaveBeenCalled();
  });

  it('isStreaming=trueのとき停止ボタンが表示される', () => {
    render(<InputContainer {...defaultProps} isStreaming={true} />);

    expect(screen.getByText('停止')).toBeDefined();
    expect(screen.queryByText('送信')).toBeNull();
  });

  it('停止ボタンクリックでonCancelが呼ばれる', () => {
    const onCancel = vi.fn();
    render(<InputContainer {...defaultProps} onCancel={onCancel} isStreaming={true} />);

    fireEvent.click(screen.getByText('停止'));
    expect(onCancel).toHaveBeenCalled();
  });
});
