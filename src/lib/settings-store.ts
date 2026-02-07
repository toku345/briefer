import { fetchModels } from './llm-client';
import { SETTINGS_KEY } from './types';

interface Settings {
  selectedModel: string;
}

export async function getSettings(): Promise<Settings | null> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as Settings | undefined) ?? null;
}

export async function getSelectedModel(): Promise<string> {
  const settings = await getSettings();
  const savedModel = settings?.selectedModel;

  try {
    const models = await fetchModels();
    if (models.length === 0) {
      throw new Error('No models available');
    }

    if (savedModel && models.some((m) => m.id === savedModel)) {
      return savedModel;
    }

    if (savedModel) {
      console.warn(
        `[Briefer] Saved model "${savedModel}" not found. Falling back to "${models[0].id}".`,
      );
    }
    const defaultModel = models[0].id;
    await saveSelectedModel(defaultModel);
    return defaultModel;
  } catch (err) {
    // fetchModels() 失敗時、保存済みモデルがあればフォールバックとして使用
    if (savedModel) {
      console.warn('[Briefer] Failed to validate model, using saved:', savedModel);
      return savedModel;
    }
    throw err;
  }
}

export async function saveSelectedModel(model: string): Promise<void> {
  const newSettings: Settings = { selectedModel: model };
  await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
}
