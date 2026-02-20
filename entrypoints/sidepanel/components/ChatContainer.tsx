import { useEffect, useRef } from 'react';
import type { AppError, ChatMessage } from '@/lib/types';
import { ErrorMessage } from './ErrorMessage';
import { MessageList } from './MessageList';
import { StreamingMessage } from './StreamingMessage';
import { WelcomeMessage } from './WelcomeMessage';

interface ChatContainerProps {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  error: AppError | null;
  onAction: (message: string) => void;
  actionDisabled: boolean;
}

export function ChatContainer({
  messages,
  streamingContent,
  isStreaming,
  error,
  onAction,
  actionDisabled,
}: ChatContainerProps) {
  const containerRef = useRef<HTMLElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages/streamingContent変更時にスクロールする意図的な依存
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, streamingContent]);

  const showWelcome = messages.length === 0 && !isStreaming && !error;

  return (
    <main className="chat-container" ref={containerRef}>
      {showWelcome && <WelcomeMessage onAction={onAction} disabled={actionDisabled} />}
      <MessageList messages={messages} />
      {isStreaming && <StreamingMessage content={streamingContent} />}
      {error && <ErrorMessage error={error} />}
    </main>
  );
}
