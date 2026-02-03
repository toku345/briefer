import { fetchModels } from './llm-client';

const SETTINGS_KEY = 'briefer_settings';

interface Settings {
  selectedModel: string;
}

export async function getSettings(): Promise<Settings | null> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] ?? null;
}

export async function getSelectedModel(): Promise<string> {
  const settings = await getSettings();
  if (settings?.selectedModel) {
    return settings.selectedModel;
  }

  // 設定がない場合はAPIから利用可能なモデルを取得
  const models = await fetchModels();
  if (models.length === 0) {
    throw new Error('No models available');
  }
  return models[0].id;
}

export async function saveSelectedModel(model: string): Promise<void> {
  const newSettings: Settings = { selectedModel: model };
  await chrome.storage.local.set({ [SETTINGS_KEY]: newSettings });
}
