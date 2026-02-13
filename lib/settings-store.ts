import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from './types';

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}

export async function getServerUrl(): Promise<string> {
  const settings = await getSettings();
  return settings.serverUrl;
}

export async function getSelectedModel(): Promise<string | null> {
  const settings = await getSettings();
  return settings.selectedModel;
}

export async function saveSelectedModel(model: string): Promise<void> {
  await saveSettings({ selectedModel: model });
}
