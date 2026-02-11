import type { ChatMessage } from '@/lib/types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const buildMessageKey = (message: ChatMessage, index: number): string => {
    if (message.id) return message.id;
    if (message.requestId)
      return `${message.role}-${message.requestId}-${message.createdAt ?? index}`;
    return `${message.role}-${message.content.slice(0, 24)}-${index}`;
  };

  return (
    <>
      {messages.map((message, index) => (
        <MessageBubble key={buildMessageKey(message, index)} message={message} />
      ))}
    </>
  );
}
