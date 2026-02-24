import { type RefObject, useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';

interface SettingsPopoverProps {
  onClose: () => void;
  excludeRef?: RefObject<HTMLElement | null>;
}

export function SettingsPopover({ onClose, excludeRef }: SettingsPopoverProps) {
  const { settings, updateSetting } = useSettings();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [temperature, setTemperature] = useState(String(settings.temperature));
  const [maxTokens, setMaxTokens] = useState(String(settings.maxTokens));
  const popoverRef = useRef<HTMLDivElement>(null);

  // settings がロードされたら local state を同期
  useEffect(() => {
    setServerUrl(settings.serverUrl);
    setTemperature(String(settings.temperature));
    setMaxTokens(String(settings.maxTokens));
  }, [settings.serverUrl, settings.temperature, settings.maxTokens]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !excludeRef?.current?.contains(target)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, excludeRef]);

  const handleServerUrlBlur = () => {
    const trimmed = serverUrl.trim();
    if (trimmed && trimmed !== settings.serverUrl) {
      updateSetting('serverUrl', trimmed);
    } else {
      setServerUrl(settings.serverUrl);
    }
  };

  const handleTemperatureBlur = () => {
    const value = Number.parseFloat(temperature);
    if (!Number.isNaN(value) && value >= 0 && value <= 2 && value !== settings.temperature) {
      updateSetting('temperature', value);
    } else {
      setTemperature(String(settings.temperature));
    }
  };

  const handleMaxTokensBlur = () => {
    const value = Number.parseInt(maxTokens, 10);
    if (!Number.isNaN(value) && value >= 1 && value !== settings.maxTokens) {
      updateSetting('maxTokens', value);
    } else {
      setMaxTokens(String(settings.maxTokens));
    }
  };

  return (
    <div className="settings-popover" ref={popoverRef}>
      <label>
        Server URL
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          onBlur={handleServerUrlBlur}
        />
      </label>
      <label>
        Temperature
        <input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          onBlur={handleTemperatureBlur}
        />
      </label>
      <label>
        Max Tokens
        <input
          type="number"
          min={1}
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          onBlur={handleMaxTokensBlur}
        />
      </label>
    </div>
  );
}
