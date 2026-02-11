interface WelcomeMessageProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

const quickActions = [
  { label: 'このページを要約', message: 'このページを要約して' },
  { label: '重要ポイントを抽出', message: 'このページの重要なポイントを3つ挙げて' },
  { label: '簡単に説明', message: 'このページの内容を初心者にもわかるように簡単に説明して' },
] as const;

export function WelcomeMessage({ onSend, disabled }: WelcomeMessageProps) {
  return (
    <div className="welcome-message">
      <p>このページについて質問してください</p>
      <div className="welcome-actions">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            onClick={() => onSend(action.message)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
