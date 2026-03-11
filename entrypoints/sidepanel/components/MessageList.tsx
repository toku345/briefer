import type { ChatMessage } from '@/lib/types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <>
      {messages.map((message, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only, never reordered
        <MessageBubble key={`${message.role}-${index}`} message={message} />
      ))}
    </>
  );
}
