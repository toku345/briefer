import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '@/lib/types';
import { useSelectedModel } from '../hooks/useSelectedModel';
import { CopyButton } from './CopyButton';
import { ErrorBoundary } from './ErrorBoundary';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { model } = useSelectedModel();

  if (message.role === 'assistant') {
    return (
      <div className={`message ${message.role}`}>
        <CopyButton content={message.content} modelId={model} />
        <ErrorBoundary fallback={<span>{message.content}</span>}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </ErrorBoundary>
      </div>
    );
  }
  return <div className={`message ${message.role}`}>{message.content}</div>;
}
