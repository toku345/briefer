interface WelcomeMessageProps {
  quickActions: string[];
  onQuickAction: (content: string) => void;
}

export function WelcomeMessage({ quickActions, onQuickAction }: WelcomeMessageProps) {
  return (
    <div className="welcome-message">
      <p>このページを短時間で把握できます</p>
      <p className="hint">まずは次のテンプレートから始められます</p>
      <div className="quick-actions">
        {quickActions.map((action) => (
          <button
            key={action}
            type="button"
            className="quick-action"
            onClick={() => onQuickAction(action)}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
