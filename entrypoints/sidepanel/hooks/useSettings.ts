import { useCallback, useEffect, useState } from 'react';
import { getSettings, saveSettings } from '@/lib/settings-store';
import type { Settings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((err) => {
        console.error('[useSettings] Failed to load settings:', err);
      });
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      const updated = await saveSettings({ [key]: value });
      setSettings(updated);
    },
    [],
  );

  return { settings, updateSetting };
}
