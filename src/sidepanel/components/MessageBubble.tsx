import type { ChatMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  return <div className={`message ${message.role}`}>{message.content}</div>;
}
