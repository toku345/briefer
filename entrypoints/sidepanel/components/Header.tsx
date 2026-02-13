import { useEffect } from 'react';
import { useModels } from '../hooks/useModels';
import { useSelectedModel } from '../hooks/useSelectedModel';
import { type ConnectionStatus, useServerHealth } from '../hooks/useServerHealth';

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

export function Header() {
  const { data: models, isLoading } = useModels();
  const { model, selectModel } = useSelectedModel();
  const { status } = useServerHealth();

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
      </div>
    </header>
  );
}
