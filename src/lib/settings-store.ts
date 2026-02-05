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
  const models = await fetchModels();
  if (models.length === 0) {
    throw new Error('No models available');
  }

  const settings = await getSettings();
  const savedModel = settings?.selectedModel;

  // 保存されたモデルが利用可能なモデル一覧に含まれているか検証
  if (savedModel && models.some((m) => m.id === savedModel)) {
    return savedModel;
  }

  // 保存されたモデルが無効な場合は最初の利用可能なモデルにリセット
  const defaultModel = models[0].id;
  await saveSelectedModel(defaultModel);
  return defaultModel;
}

export async function saveSelectedModel(model: string): Promise<void> {
  const newSettings: Settings = { selectedModel: model };
  await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
}
