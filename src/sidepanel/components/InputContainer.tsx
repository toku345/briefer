import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

interface InputContainerProps {
  onSend: (content: string) => void;
  disabledReason?: 'loading' | 'sending' | 'server-error';
  prefillText?: string;
  isStreaming?: boolean;
  onCancel?: () => void;
}

const placeholderMap: Record<string, string> = {
  loading: 'ページを読み込み中...',
  sending: '応答を生成中...',
  'server-error': 'vLLM に接続できません',
};

export function InputContainer({
  onSend,
  disabledReason,
  prefillText,
  isStreaming,
  onCancel,
}: InputContainerProps) {
  const disabled = !!disabledReason;
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefillText) {
      setValue(prefillText);
    }
  }, [prefillText]);

  const handleSend = useCallback(() => {
    const content = value.trim();
    if (!content || disabled) return;

    onSend(content);
    setValue('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  return (
    <footer className="input-container">
      <textarea
        id="message-input"
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={disabledReason ? placeholderMap[disabledReason] : 'メッセージを入力...'}
        rows={1}
      />
      {isStreaming ? (
        <button id="send-btn" type="button" className="cancel" onClick={onCancel}>
          停止
        </button>
      ) : (
        <button id="send-btn" type="button" onClick={handleSend} disabled={disabled}>
          送信
        </button>
      )}
    </footer>
  );
}
