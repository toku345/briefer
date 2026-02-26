/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from '../lib/types';

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

let useSettings: typeof import('../entrypoints/sidepanel/hooks/useSettings').useSettings;

describe('useSettings', () => {
  beforeAll(async () => {
    const module = await import('../entrypoints/sidepanel/hooks/useSettings');
    useSettings = module.useSettings;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  });

  it('デフォルト値でロードされる', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  it('保存済み設定をロードする', async () => {
    mockLocalStorage[SETTINGS_KEY] = {
      serverUrl: 'http://custom:9000/v1',
      temperature: 0.8,
    };

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings.serverUrl).toBe('http://custom:9000/v1');
      expect(result.current.settings.temperature).toBe(0.8);
      expect(result.current.settings.maxTokens).toBe(DEFAULT_SETTINGS.maxTokens);
    });
  });

  it('updateSetting で部分更新し state が反映される', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    await act(async () => {
      await result.current.updateSetting('temperature', 1.5);
    });

    expect(result.current.settings.temperature).toBe(1.5);
    expect(mockChrome.storage.local.set).toHaveBeenCalled();

    const saved = mockLocalStorage[SETTINGS_KEY] as Settings;
    expect(saved.temperature).toBe(1.5);
    expect(saved.serverUrl).toBe(DEFAULT_SETTINGS.serverUrl);
  });
});
