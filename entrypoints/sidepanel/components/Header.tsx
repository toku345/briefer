import { useCallback, useEffect, useRef, useState } from 'react';
import { useModels } from '../hooks/useModels';
import { useSelectedModel } from '../hooks/useSelectedModel';
import { type ConnectionStatus, useServerHealth } from '../hooks/useServerHealth';
import { SettingsPopover } from './SettingsPopover';

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'サーバー接続中',
  checking: '確認中...',
  disconnected: 'サーバー未接続',
};

const STATUS_CLASSES: Record<ConnectionStatus, string> = {
  connected: 'status-connected',
  checking: 'status-checking',
  disconnected: 'status-disconnected',
};

interface HeaderProps {
  onClearChat: () => void;
  hasMessages: boolean;
}

export function Header({ onClearChat, hasMessages }: HeaderProps) {
  const { data: models, isLoading } = useModels();
  const { model, selectModel } = useSelectedModel();
  const { status } = useServerHealth();
  const [showSettings, setShowSettings] = useState(false);
  const gearBtnRef = useRef<HTMLButtonElement>(null);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);

  // 設定が未保存でモデルリストがある場合、最初のモデルを自動選択
  useEffect(() => {
    if (model === null && models && models.length > 0) {
      selectModel(models[0].id);
    }
  }, [model, models, selectModel]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectModel(e.target.value);
  };

  return (
    <header className="header">
      <div className="header-left">
        {/* biome-ignore lint/a11y/useSemanticElements: Biomeはrole="status"に対し<output>を推奨するが、<output>はフォーム計算結果用。接続ステータス表示にはspan+role="status"が意味的に適切 */}
        <span
          role="status"
          className={`status-dot ${STATUS_CLASSES[status]}`}
          title={STATUS_LABELS[status]}
        >
          <span className="visually-hidden">{STATUS_LABELS[status]}</span>
        </span>
        <h1>Briefer</h1>
      </div>
      <div className="header-right">
        {models && models.length > 0 && (
          <select
            className="model-select"
            value={model ?? ''}
            onChange={handleChange}
            disabled={isLoading || !model}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id.split('/').pop()}
              </option>
            ))}
          </select>
        )}
        {hasMessages && (
          <button
            type="button"
            className="header-btn"
            onClick={onClearChat}
            title="新しい会話"
            aria-label="新しい会話"
          >
            <PlusIcon />
          </button>
        )}
        <div className="settings-wrapper">
          <button
            ref={gearBtnRef}
            type="button"
            className="header-btn"
            onClick={() => setShowSettings((prev) => !prev)}
            title="設定"
            aria-label="設定"
          >
            <GearIcon />
          </button>
          {showSettings && (
            <SettingsPopover onClose={handleCloseSettings} excludeRef={gearBtnRef} />
          )}
        </div>
      </div>
    </header>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
