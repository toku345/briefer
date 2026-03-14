import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ErrorBoundary } from './ErrorBoundary';

interface StreamingMessageProps {
  content: string;
  showCursor?: boolean;
}

export function StreamingMessage({ content, showCursor = true }: StreamingMessageProps) {
  return (
    <div className={`message assistant${showCursor ? ' streaming' : ''}`}>
      <ErrorBoundary fallback={<span>{content}</span>}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </ErrorBoundary>
    </div>
  );
}
