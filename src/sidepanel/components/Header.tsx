import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { DEFAULT_VLLM_BASE_URL, getVllmBaseUrl, saveVllmBaseUrl } from '@/lib/settings-store';
import { useModels } from '../hooks/useModels';
import { useSelectedModel } from '../hooks/useSelectedModel';

interface HeaderProps {
  onClearChat?: () => void;
}

export function Header({ onClearChat }: HeaderProps) {
  const { data: models, isLoading, isError } = useModels();
  const { model, selectModel } = useSelectedModel();
  const queryClient = useQueryClient();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    getVllmBaseUrl().then(setUrlInput);
  }, []);

  // 設定が未保存でモデルリストがある場合、最初のモデルを自動選択
  useEffect(() => {
    if (model === null && models && models.length > 0) {
      selectModel(models[0].id);
    }
  }, [model, models, selectModel]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectModel(e.target.value);
  };

  const handleSaveUrl = async () => {
    const trimmed = urlInput.trim() || DEFAULT_VLLM_BASE_URL;
    await saveVllmBaseUrl(trimmed);
    setUrlInput(trimmed);
    queryClient.invalidateQueries({ queryKey: ['models'] });
    setIsSettingsOpen(false);
  };

  const statusColor = isLoading ? '#ffa500' : isError ? '#ff4444' : '#44ff44';

  return (
    <header className="header">
      <div className="header-left">
        <h1>Briefer</h1>
        {onClearChat && (
          <button
            type="button"
            className="header-clear-btn"
            onClick={onClearChat}
            title="新しい会話"
          >
            +
          </button>
        )}
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
        <span
          className="status-dot"
          style={{ backgroundColor: statusColor }}
          title={isLoading ? '接続中...' : isError ? '接続エラー' : '接続済み'}
        />
        <div className="settings-wrapper">
          <button
            type="button"
            className="header-settings-btn"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="設定"
          >
            &#x2699;
          </button>
          {isSettingsOpen && (
            <div className="settings-popover">
              <label className="settings-label" htmlFor="vllm-url-input">
                vLLM URL
              </label>
              <input
                id="vllm-url-input"
                className="settings-input"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={DEFAULT_VLLM_BASE_URL}
              />
              <button type="button" className="settings-save-btn" onClick={handleSaveUrl}>
                保存
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
