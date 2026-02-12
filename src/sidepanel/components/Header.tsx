import { useEffect } from 'react';
import type { ExtractedContent } from '@/lib/types';
import { useModels } from '../hooks/useModels';
import { useSelectedModel } from '../hooks/useSelectedModel';

interface HeaderProps {
  pageContent: ExtractedContent | null;
}

export function Header({ pageContent }: HeaderProps) {
  const { data: models, isLoading } = useModels();
  const { model, selectModel, isLoading: isModelLoading, error: modelError } = useSelectedModel();

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
      <div className="header-brand">
        <h1>Briefer</h1>
        {pageContent && (
          <p className="page-meta" title={pageContent.url}>
            {pageContent.title || pageContent.url}
          </p>
        )}
      </div>
      <div className="header-controls">
        {models && models.length > 0 && (
          <select
            className="model-select"
            value={model ?? ''}
            onChange={handleChange}
            disabled={isLoading || isModelLoading || !model}
            aria-label="使用モデル"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id.split('/').pop() ?? m.id}
              </option>
            ))}
          </select>
        )}
        {modelError && <span className="header-error">{modelError}</span>}
      </div>
    </header>
  );
}
