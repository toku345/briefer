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
  quickActions: string[];
  onQuickAction: (content: string) => void;
}

export function ChatContainer({
  messages,
  streamingContent,
  isStreaming,
  error,
  quickActions,
  onQuickAction,
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
  const showDeepDiveChips =
    !showWelcome &&
    !isStreaming &&
    !error &&
    messages.some((message) => message.role === 'assistant');

  const deepDiveActions = [
    'この内容の根拠を3点で示して',
    '実務で使えるチェックリストにして',
    '見落としや反論ポイントを挙げて',
  ];

  return (
    <main className="chat-container" ref={containerRef}>
      {showWelcome && <WelcomeMessage quickActions={quickActions} onQuickAction={onQuickAction} />}
      <MessageList messages={messages} />
      {isStreaming && <StreamingMessage content={streamingContent} />}
      {error && <div className="message error">{error}</div>}
      {showDeepDiveChips && (
        <div className="quick-actions follow-up-actions">
          {deepDiveActions.map((action) => (
            <button
              key={action}
              type="button"
              className="quick-action secondary"
              onClick={() => onQuickAction(action)}
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
