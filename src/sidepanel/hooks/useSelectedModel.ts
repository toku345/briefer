import { useCallback, useEffect, useState } from 'react';

const SETTINGS_KEY = 'briefer_settings';

export function useSelectedModel() {
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get(SETTINGS_KEY).then((result) => {
      const settings = result[SETTINGS_KEY];
      setModel(settings?.selectedModel ?? null);
    });
  }, []);

  const selectModel = useCallback(async (modelId: string) => {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = result[SETTINGS_KEY] ?? {};
    settings.selectedModel = modelId;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    setModel(modelId);
  }, []);

  return { model, selectModel };
}
