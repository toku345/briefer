import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/types';
import { MessageList } from './MessageList';
import { StreamingMessage } from './StreamingMessage';
import { WelcomeMessage } from './WelcomeMessage';

interface ChatContainerProps {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;
}

export function ChatContainer({
  messages,
  streamingContent,
  isStreaming,
  error,
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
      {showWelcome && <WelcomeMessage />}
      <MessageList messages={messages} />
      {isStreaming && <StreamingMessage content={streamingContent} />}
      {error && <div className="message error">{error}</div>}
    </main>
  );
}
