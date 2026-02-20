import type { AppError } from '@/lib/types';

interface ErrorMessageProps {
  error: AppError;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  return (
    <div className={`error-message error-${error.category}`} role="alert">
      <p className="error-message-text">{error.message}</p>
      <p className="error-message-guidance">{error.guidance}</p>
    </div>
  );
}
