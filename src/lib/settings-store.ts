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
  if (settings?.selectedModel) {
    return settings.selectedModel;
  }

  // 設定がない場合はAPIから利用可能なモデルを取得し、永続化する
  const models = await fetchModels();
  if (models.length === 0) {
    throw new Error('No models available');
  }
  const defaultModel = models[0].id;
  await saveSelectedModel(defaultModel);
  return defaultModel;
}

export async function saveSelectedModel(model: string): Promise<void> {
  const newSettings: Settings = { selectedModel: model };
  await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
}
