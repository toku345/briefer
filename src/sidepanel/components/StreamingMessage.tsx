interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return <div className="message assistant streaming">{content}</div>;
}
