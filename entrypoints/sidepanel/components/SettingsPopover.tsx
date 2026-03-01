import { type RefObject, useEffect, useRef, useState } from 'react';
import { hasHostPermission, isLocalhostUrl, requestHostPermission } from '@/lib/permissions';
import { useSettings } from '../hooks/useSettings';

function flashError(el: HTMLElement) {
  el.classList.remove('settings-input-error');
  requestAnimationFrame(() => el.classList.add('settings-input-error'));
}

interface SettingsPopoverProps {
  onClose: () => void;
  excludeRef?: RefObject<HTMLElement | null>;
}

export function SettingsPopover({ onClose, excludeRef }: SettingsPopoverProps) {
  const { settings, updateSetting } = useSettings();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [temperature, setTemperature] = useState(String(settings.temperature));
  const [maxTokens, setMaxTokens] = useState(String(settings.maxTokens));
  const [needsPermission, setNeedsPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // settings がロードされたら local state を同期
  useEffect(() => {
    setServerUrl(settings.serverUrl);
    setTemperature(String(settings.temperature));
    setMaxTokens(String(settings.maxTokens));
  }, [settings.serverUrl, settings.temperature, settings.maxTokens]);

  // serverUrl 変更時にホスト権限を確認
  useEffect(() => {
    if (isLocalhostUrl(settings.serverUrl)) {
      setNeedsPermission(false);
      setPermissionError(null);
      return;
    }
    let cancelled = false;
    hasHostPermission(settings.serverUrl).then((has) => {
      if (!cancelled) {
        setNeedsPermission(!has);
        if (has) setPermissionError(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [settings.serverUrl]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
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
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, excludeRef]);

  const handleServerUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const trimmed = serverUrl.trim();
    if (!trimmed) {
      setServerUrl(settings.serverUrl);
      flashError(e.currentTarget);
      return;
    }
    if (trimmed !== settings.serverUrl) updateSetting('serverUrl', trimmed);
    else setServerUrl(settings.serverUrl);
  };

  const handleTemperatureBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(temperature);
    if (Number.isNaN(value) || value < 0 || value > 2) {
      setTemperature(String(settings.temperature));
      flashError(e.currentTarget);
      return;
    }
    if (value !== settings.temperature) updateSetting('temperature', value);
  };

  const handleMaxTokensBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = Number(maxTokens);
    if (!Number.isInteger(value) || value < 1) {
      setMaxTokens(String(settings.maxTokens));
      flashError(e.currentTarget);
      return;
    }
    if (value !== settings.maxTokens) updateSetting('maxTokens', value);
  };

  const handleRequestPermission = () => {
    requestHostPermission(settings.serverUrl).then((granted) => {
      if (granted) {
        setNeedsPermission(false);
        setPermissionError(null);
      } else {
        setPermissionError('ホスト権限が拒否されました');
      }
    });
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
      {needsPermission && (
        <div className="permission-request">
          <button type="button" className="permission-btn" onClick={handleRequestPermission}>
            ホスト権限を許可
          </button>
          {permissionError && <p className="permission-error">{permissionError}</p>}
        </div>
      )}
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
