interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

interface ErrorInfo {
  title: string;
  subtitle?: string;
  showRetry: boolean;
}

function classifyError(error: string): ErrorInfo {
  const lower = error.toLowerCase();

  if (lower.includes('fetch') || lower.includes('network') || error.includes('ECONNREFUSED')) {
    return {
      title: 'vLLM サーバーに接続できません',
      subtitle: 'vllm serve コマンドでサーバーを起動してください',
      showRetry: false,
    };
  }

  if (
    error.includes('chrome://') ||
    error.includes('Cannot access') ||
    error.includes('not allowed')
  ) {
    return {
      title: 'このページでは Briefer を使用できません',
      showRetry: false,
    };
  }

  return {
    title: error,
    showRetry: true,
  };
}

export function ErrorMessage({ error, onRetry, onDismiss }: ErrorMessageProps) {
  const info = classifyError(error);

  return (
    <div className="error-message" role="alert">
      {onDismiss && (
        <button type="button" className="error-dismiss-btn" onClick={onDismiss} aria-label="閉じる">
          x
        </button>
      )}
      <div className="error-title">{info.title}</div>
      {info.subtitle && <div className="error-subtitle">{info.subtitle}</div>}
      {info.showRetry && onRetry && (
        <div className="error-actions">
          <button type="button" className="error-retry-btn" onClick={onRetry}>
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
