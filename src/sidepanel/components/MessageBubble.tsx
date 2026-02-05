import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/lib/types';
import { CopyButton } from './CopyButton';
import { ErrorBoundary } from './ErrorBoundary';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'assistant') {
    return (
      <div className={`message ${message.role}`}>
        <CopyButton content={message.content} modelId={message.modelId ?? null} />
        <ErrorBoundary fallback={<span>{message.content}</span>}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </ErrorBoundary>
      </div>
    );
  }
  return <div className={`message ${message.role}`}>{message.content}</div>;
}
