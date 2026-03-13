import type { AppError } from '@/lib/types';

interface ErrorMessageProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorMessage({ error, onRetry, onDismiss }: ErrorMessageProps) {
  return (
    <div className={`error-message error-${error.category}`} role="alert">
      <p className="error-message-text">{error.message}</p>
      <p className="error-message-guidance">{error.guidance}</p>
      {(onRetry || onDismiss) && (
        <div className="error-actions">
          {error.retryable && onRetry && (
            <button
              type="button"
              className="error-retry-btn"
              onClick={onRetry}
              aria-label="再試行"
              title="再試行"
            >
              再試行
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              className="error-dismiss-btn"
              onClick={onDismiss}
              aria-label="閉じる"
              title="閉じる"
            >
              閉じる
            </button>
          )}
        </div>
      )}
    </div>
  );
}
