import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_KEY } from '../lib/types';

const mockLocalStorage: Record<string, unknown> = {};

const mockChrome = {
  storage: {
    local: {
      get: vi.fn((key: string) => Promise.resolve({ [key]: mockLocalStorage[key] })),
      set: vi.fn((data: Record<string, unknown>) => {
        Object.assign(mockLocalStorage, data);
        return Promise.resolve();
      }),
    },
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome =
  mockChrome as unknown as typeof chrome;

const { getSelectedModel, getServerUrl, getSettings, saveSelectedModel, saveSettings } =
  await import('../lib/settings-store');

describe('settings-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  });

  describe('getSettings', () => {
    it('未保存時はデフォルト値を返す', async () => {
      const settings = await getSettings();

      expect(settings).toEqual({
        serverUrl: 'http://localhost:8000/v1',
        selectedModel: null,
        temperature: 0.3,
        maxTokens: 2048,
      });
    });

    it('保存済み設定とデフォルトをマージする', async () => {
      mockLocalStorage[SETTINGS_KEY] = {
        serverUrl: 'http://localhost:9000/v1',
        selectedModel: 'org/model-a',
      };

      const settings = await getSettings();

      expect(settings.serverUrl).toBe('http://localhost:9000/v1');
      expect(settings.selectedModel).toBe('org/model-a');
      expect(settings.temperature).toBe(0.3);
      expect(settings.maxTokens).toBe(2048);
    });
  });

  describe('saveSettings', () => {
    it('部分的に設定を更新する', async () => {
      const result = await saveSettings({ temperature: 0.7 });

      expect(result.temperature).toBe(0.7);
      expect(result.serverUrl).toBe('http://localhost:8000/v1');
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
    });

    it('複数フィールドを同時に更新する', async () => {
      const result = await saveSettings({
        serverUrl: 'http://remote:8000/v1',
        maxTokens: 4096,
      });

      expect(result.serverUrl).toBe('http://remote:8000/v1');
      expect(result.maxTokens).toBe(4096);
    });
  });

  describe('getServerUrl', () => {
    it('サーバーURLを返す', async () => {
      const url = await getServerUrl();
      expect(url).toBe('http://localhost:8000/v1');
    });

    it('保存済みURLを返す', async () => {
      mockLocalStorage[SETTINGS_KEY] = { serverUrl: 'http://custom:8080/v1' };

      const url = await getServerUrl();
      expect(url).toBe('http://custom:8080/v1');
    });
  });

  describe('getSelectedModel', () => {
    it('未保存時はnullを返す', async () => {
      const model = await getSelectedModel();
      expect(model).toBeNull();
    });

    it('保存済みモデルを返す', async () => {
      mockLocalStorage[SETTINGS_KEY] = { selectedModel: 'org/model-x' };

      const model = await getSelectedModel();
      expect(model).toBe('org/model-x');
    });
  });

  describe('saveSelectedModel', () => {
    it('モデルを保存する', async () => {
      await saveSelectedModel('org/new-model');

      const saved = mockLocalStorage[SETTINGS_KEY] as Record<string, unknown>;
      expect(saved.selectedModel).toBe('org/new-model');
    });
  });
});
