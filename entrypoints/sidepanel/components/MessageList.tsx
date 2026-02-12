import type { ChatMessage } from '@/lib/types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <>
      {messages.map((message, index) => (
        <MessageBubble key={`${message.role}-${index}`} message={message} />
      ))}
    </>
  );
}
