import { fetchModels } from './llm-client';
import { SETTINGS_KEY, type Settings } from './types';

export const DEFAULT_VLLM_BASE_URL = 'http://localhost:8000/v1';

export async function getSettings(): Promise<Settings | null> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as Settings | undefined) ?? null;
}

export async function getSelectedModel(): Promise<string> {
  const settings = await getSettings();
  const savedModel = settings?.selectedModel;

  try {
    const baseUrl = await getVllmBaseUrl();
    const models = await fetchModels(baseUrl);
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
  const current = await getSettings();
  const newSettings: Settings = { ...current, selectedModel: model };
  await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
}

export async function getVllmBaseUrl(): Promise<string> {
  const settings = await getSettings();
  return settings?.vllmBaseUrl || DEFAULT_VLLM_BASE_URL;
}

export async function saveVllmBaseUrl(url: string): Promise<void> {
  const current = await getSettings();
  const newSettings: Settings = {
    ...current,
    selectedModel: current?.selectedModel ?? '',
    vllmBaseUrl: url,
  };
  await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
}
