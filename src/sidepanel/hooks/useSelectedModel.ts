import { useCallback, useEffect, useState } from 'react';
import { getSelectedModel, saveSelectedModel } from '@/lib/settings-store';

export function useSelectedModel() {
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    getSelectedModel()
      .then((m) => setModel(m))
      .catch((error) => {
        console.error('[Briefer] Failed to load selected model:', error);
      });
  }, []);

  const selectModel = useCallback(async (modelId: string) => {
    await saveSelectedModel(modelId);
    setModel(modelId);
  }, []);

  return { model, selectModel };
}
