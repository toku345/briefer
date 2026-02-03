import { useCallback, useEffect, useState } from 'react';
import { SETTINGS_KEY } from '@/lib/types';

export function useSelectedModel() {
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local
      .get(SETTINGS_KEY)
      .then((result) => {
        const settings = result[SETTINGS_KEY] as { selectedModel?: string } | undefined;
        setModel(settings?.selectedModel ?? null);
      })
      .catch((error) => {
        console.error('[Briefer] Failed to load selected model:', error);
      });
  }, []);

  const selectModel = useCallback(async (modelId: string) => {
    try {
      const result = await chrome.storage.local.get(SETTINGS_KEY);
      const settings = (result[SETTINGS_KEY] as { selectedModel?: string } | undefined) ?? {};
      const newSettings = { ...settings, selectedModel: modelId };
      await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
      setModel(modelId);
    } catch (error) {
      console.error('[Briefer] Failed to save selected model:', error);
      throw error;
    }
  }, []);

  return { model, selectModel };
}
