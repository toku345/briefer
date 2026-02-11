import { fetchModels } from './llm-client';
import { SETTINGS_KEY } from './types';

interface Settings {
  selectedModel: string;
}

const MODELS_CACHE_TTL_MS = 60_000;
let modelsCache: { ids: string[]; expiresAt: number } | null = null;

export async function getSettings(): Promise<Settings | null> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as Settings | undefined) ?? null;
}

async function getAvailableModelIds(): Promise<string[]> {
  if (modelsCache && modelsCache.expiresAt > Date.now()) {
    return modelsCache.ids;
  }

  const models = await fetchModels();
  const ids = models.map((model) => model.id);
  modelsCache = { ids, expiresAt: Date.now() + MODELS_CACHE_TTL_MS };
  return ids;
}

export function resetSettingsCacheForTest(): void {
  modelsCache = null;
}

export async function getSelectedModel(): Promise<string> {
  const settings = await getSettings();
  const savedModel = settings?.selectedModel;

  try {
    const modelIds = await getAvailableModelIds();
    if (modelIds.length === 0) {
      throw new Error('No models available');
    }

    if (savedModel && modelIds.includes(savedModel)) {
      return savedModel;
    }

    if (savedModel) {
      console.warn(
        `[Briefer] Saved model "${savedModel}" not found. Falling back to "${modelIds[0]}".`,
      );
    }
    const defaultModel = modelIds[0];
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
