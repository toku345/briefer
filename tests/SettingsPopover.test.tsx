/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../lib/types';

const mockUpdateSetting = vi.hoisted(() => vi.fn());

vi.mock('../entrypoints/sidepanel/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      serverUrl: 'http://localhost:8000/v1',
      selectedModel: null,
      temperature: 0.3,
      maxTokens: 2048,
    },
    updateSetting: mockUpdateSetting,
  }),
}));

const { SettingsPopover } = await import('../entrypoints/sidepanel/components/SettingsPopover');

describe('SettingsPopover validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('temperature', () => {
    it('有効範囲内の値で updateSetting が呼ばれる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Temperature/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '1.5' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).toHaveBeenCalledWith('temperature', 1.5);
    });

    it('範囲外の値 (2.1) でリバートされる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Temperature/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '2.1' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.value).toBe(String(DEFAULT_SETTINGS.temperature));
    });

    it('負の値 (-0.1) でリバートされる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Temperature/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '-0.1' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.value).toBe(String(DEFAULT_SETTINGS.temperature));
    });

    it('NaN 入力でリバートされる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Temperature/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.value).toBe(String(DEFAULT_SETTINGS.temperature));
    });

    it('境界値 0 は受け入れられる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Temperature/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).toHaveBeenCalledWith('temperature', 0);
    });

    it('境界値 2 は受け入れられる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Temperature/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '2' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).toHaveBeenCalledWith('temperature', 2);
    });

    it('現在値と同値を入力した場合、updateSetting も flashError も呼ばれない', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Temperature/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '0.3' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.classList.contains('settings-input-error')).toBe(false);
    });
  });

  describe('maxTokens', () => {
    it('有効な値で updateSetting が呼ばれる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Max Tokens/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '4096' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).toHaveBeenCalledWith('maxTokens', 4096);
    });

    it('0 でリバートされる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Max Tokens/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.value).toBe(String(DEFAULT_SETTINGS.maxTokens));
    });

    it('負の値でリバートされる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Max Tokens/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '-1' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.value).toBe(String(DEFAULT_SETTINGS.maxTokens));
    });

    it('境界値 1 は受け入れられる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Max Tokens/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).toHaveBeenCalledWith('maxTokens', 1);
    });

    it('現在値と同値を入力した場合、updateSetting も flashError も呼ばれない', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Max Tokens/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '2048' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.classList.contains('settings-input-error')).toBe(false);
    });
  });

  describe('serverUrl', () => {
    it('有効な URL で updateSetting が呼ばれる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Server URL/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'http://custom:9000/v1' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).toHaveBeenCalledWith('serverUrl', 'http://custom:9000/v1');
    });

    it('空文字でリバートされる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Server URL/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.value).toBe(DEFAULT_SETTINGS.serverUrl);
    });

    it('空白のみでリバートされる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Server URL/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.value).toBe(DEFAULT_SETTINGS.serverUrl);
    });

    it('前後の空白がトリムされる', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Server URL/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '  http://custom:9000/v1  ' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).toHaveBeenCalledWith('serverUrl', 'http://custom:9000/v1');
    });

    it('現在値と同値を入力した場合、updateSetting も flashError も呼ばれない', () => {
      render(<SettingsPopover onClose={vi.fn()} />);
      const input = screen.getByLabelText(/Server URL/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'http://localhost:8000/v1' } });
      fireEvent.blur(input);

      expect(mockUpdateSetting).not.toHaveBeenCalled();
      expect(input.classList.contains('settings-input-error')).toBe(false);
    });
  });
});
