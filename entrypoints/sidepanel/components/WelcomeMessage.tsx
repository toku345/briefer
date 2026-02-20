interface WelcomeMessageProps {
  onAction: (message: string) => void;
  disabled: boolean;
}

const QUICK_ACTIONS = [
  { label: '要約', message: 'このページを要約して' },
  { label: '重要ポイント', message: 'このページの重要なポイントを教えて' },
  { label: '簡単に説明', message: 'このページを簡単に説明して' },
] as const;

export function WelcomeMessage({ onAction, disabled }: WelcomeMessageProps) {
  return (
    <div className="welcome-message">
      <p>このページについて質問してください</p>
      <div className="welcome-actions">
        {QUICK_ACTIONS.map(({ label, message }) => (
          <button
            key={label}
            type="button"
            className="welcome-action-btn"
            disabled={disabled}
            onClick={() => onAction(message)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
