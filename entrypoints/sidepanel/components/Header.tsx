import { useEffect } from 'react';
import { useModels } from '../hooks/useModels';
import { useSelectedModel } from '../hooks/useSelectedModel';

export function Header() {
  const { data: models, isLoading } = useModels();
  const { model, selectModel } = useSelectedModel();

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
      <h1>Briefer</h1>
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
    </header>
  );
}
