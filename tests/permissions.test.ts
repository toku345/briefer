import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockChrome = {
  permissions: {
    contains: vi.fn(),
    request: vi.fn(),
  },
};

(globalThis as unknown as { chrome: typeof chrome }).chrome =
  mockChrome as unknown as typeof chrome;

const { isLocalhostUrl, extractOriginPattern, hasHostPermission, requestHostPermission } =
  await import('../lib/permissions');

describe('permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isLocalhostUrl', () => {
    it('http://localhost:8000/v1 → true', () => {
      expect(isLocalhostUrl('http://localhost:8000/v1')).toBe(true);
    });

    it('http://localhost/v1 → true', () => {
      expect(isLocalhostUrl('http://localhost/v1')).toBe(true);
    });

    it('http://127.0.0.1:8000/v1 → true', () => {
      expect(isLocalhostUrl('http://127.0.0.1:8000/v1')).toBe(true);
    });

    it('http://127.0.0.1/v1 → true', () => {
      expect(isLocalhostUrl('http://127.0.0.1/v1')).toBe(true);
    });

    it('https://localhost:8000/v1 → false (スキームが https)', () => {
      expect(isLocalhostUrl('https://localhost:8000/v1')).toBe(false);
    });

    it('http://remote-server:8000/v1 → false', () => {
      expect(isLocalhostUrl('http://remote-server:8000/v1')).toBe(false);
    });

    it('http://[::1]:8000/v1 → false (IPv6 loopback は対象外)', () => {
      expect(isLocalhostUrl('http://[::1]:8000/v1')).toBe(false);
    });

    it('不正 URL → false', () => {
      expect(isLocalhostUrl('not-a-url')).toBe(false);
    });

    it('空文字 → false', () => {
      expect(isLocalhostUrl('')).toBe(false);
    });
  });

  describe('extractOriginPattern', () => {
    it('http://remote:9000/v1 → http://remote:9000/*', () => {
      expect(extractOriginPattern('http://remote:9000/v1')).toBe('http://remote:9000/*');
    });

    it('https://api.example.com/v1 → https://api.example.com/*（スキーム保持）', () => {
      expect(extractOriginPattern('https://api.example.com/v1')).toBe('https://api.example.com/*');
    });

    it('http://localhost:8000/v1 → http://localhost:8000/*', () => {
      expect(extractOriginPattern('http://localhost:8000/v1')).toBe('http://localhost:8000/*');
    });

    it('ポートなし URL に対応', () => {
      expect(extractOriginPattern('https://api.example.com/v1')).toBe('https://api.example.com/*');
    });

    it('不正 URL → null', () => {
      expect(extractOriginPattern('not-a-url')).toBeNull();
    });

    it('空文字 → null', () => {
      expect(extractOriginPattern('')).toBeNull();
    });
  });

  describe('hasHostPermission', () => {
    it('localhost → true（chrome.permissions を呼ばない）', async () => {
      const result = await hasHostPermission('http://localhost:8000/v1');
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).not.toHaveBeenCalled();
    });

    it('remote + 権限あり → true', async () => {
      mockChrome.permissions.contains.mockResolvedValue(true);
      const result = await hasHostPermission('http://remote:9000/v1');
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledWith({
        origins: ['http://remote:9000/*'],
      });
    });

    it('remote + 権限なし → false', async () => {
      mockChrome.permissions.contains.mockResolvedValue(false);
      const result = await hasHostPermission('http://remote:9000/v1');
      expect(result).toBe(false);
    });

    it('不正 URL → false', async () => {
      const result = await hasHostPermission('not-a-url');
      expect(result).toBe(false);
      expect(mockChrome.permissions.contains).not.toHaveBeenCalled();
    });
  });

  describe('requestHostPermission', () => {
    it('localhost → true（chrome.permissions.request を呼ばない）', async () => {
      const result = await requestHostPermission('http://localhost:8000/v1');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).not.toHaveBeenCalled();
    });

    it('remote + 許可 → true', async () => {
      mockChrome.permissions.request.mockResolvedValue(true);
      const result = await requestHostPermission('http://remote:9000/v1');
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        origins: ['http://remote:9000/*'],
      });
    });

    it('remote + 拒否 → false', async () => {
      mockChrome.permissions.request.mockResolvedValue(false);
      const result = await requestHostPermission('http://remote:9000/v1');
      expect(result).toBe(false);
    });

    it('不正 URL → false', async () => {
      const result = await requestHostPermission('not-a-url');
      expect(result).toBe(false);
      expect(mockChrome.permissions.request).not.toHaveBeenCalled();
    });
  });
});
