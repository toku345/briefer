import { type KeyboardEvent, useCallback, useRef, useState } from 'react';

interface InputContainerProps {
  onSend: (content: string) => void;
  disabled: boolean;
  defaultValue?: string;
}

export function InputContainer({ onSend, disabled, defaultValue = '' }: InputContainerProps) {
  const [value, setValue] = useState(defaultValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        placeholder="メッセージを入力..."
        rows={1}
      />
      <button id="send-btn" type="button" onClick={handleSend} disabled={disabled}>
        送信
      </button>
    </footer>
  );
}
