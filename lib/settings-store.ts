import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from './types';

/** storage の破損や不正値を防ぐため、read/write 両方で適用 */
function sanitizeSettings(settings: Settings): Settings {
  return {
    serverUrl:
      (typeof settings.serverUrl === 'string' ? settings.serverUrl.trim() : '') ||
      DEFAULT_SETTINGS.serverUrl,
    selectedModel: settings.selectedModel,
    temperature: Number.isFinite(settings.temperature)
      ? Math.max(0, Math.min(2, settings.temperature))
      : DEFAULT_SETTINGS.temperature,
    maxTokens: Number.isFinite(settings.maxTokens)
      ? Math.max(1, Math.floor(settings.maxTokens))
      : DEFAULT_SETTINGS.maxTokens,
  };
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  return sanitizeSettings({ ...DEFAULT_SETTINGS, ...stored });
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = sanitizeSettings({ ...current, ...patch });
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
