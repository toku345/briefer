import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ErrorBoundary } from './ErrorBoundary';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="message assistant streaming">
      <ErrorBoundary fallback={<span>{content}</span>}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </ErrorBoundary>
    </div>
  );
}
