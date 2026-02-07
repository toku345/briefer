import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_KEY } from '../src/lib/types';

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

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { getSelectedModel } = await import('../src/lib/settings-store');

describe('settings-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  });

  describe('getSelectedModel', () => {
    it('保存されたモデルが利用可能な場合はそのモデルを返す', async () => {
      mockLocalStorage[SETTINGS_KEY] = { selectedModel: 'org/model-a' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ object: 'list', data: [{ id: 'org/model-a' }, { id: 'org/model-b' }] }),
      });

      const result = await getSelectedModel();

      expect(result).toBe('org/model-a');
    });

    it('保存されたモデルが利用不可の場合は最初のモデルにリセットする', async () => {
      mockLocalStorage[SETTINGS_KEY] = { selectedModel: 'org/deleted-model' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ object: 'list', data: [{ id: 'org/model-x' }, { id: 'org/model-y' }] }),
      });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getSelectedModel();

      expect(result).toBe('org/model-x');
      expect(mockLocalStorage[SETTINGS_KEY]).toEqual({ selectedModel: 'org/model-x' });
      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('org/deleted-model'));

      consoleWarn.mockRestore();
    });

    it('設定が未保存の場合はデフォルトモデルを選択して保存する', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: 'list', data: [{ id: 'org/default-model' }] }),
      });

      const result = await getSelectedModel();

      expect(result).toBe('org/default-model');
      expect(mockLocalStorage[SETTINGS_KEY]).toEqual({ selectedModel: 'org/default-model' });
    });

    it('利用可能なモデルが空の場合はエラーをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: 'list', data: [] }),
      });

      await expect(getSelectedModel()).rejects.toThrow('No models available');
    });

    it('fetchModels失敗時に保存済みモデルがあればフォールバックする', async () => {
      mockLocalStorage[SETTINGS_KEY] = { selectedModel: 'org/saved-model' };
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await getSelectedModel();

      expect(result).toBe('org/saved-model');
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to validate model'),
        'org/saved-model',
      );

      consoleWarn.mockRestore();
    });

    it('fetchModels失敗時に保存済みモデルがなければエラーをスローする', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(getSelectedModel()).rejects.toThrow('Network error');
    });
  });
});
