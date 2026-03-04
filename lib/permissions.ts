/**
 * ホスト権限の判定・要求ユーティリティ。
 * localhost はマニフェストの host_permissions で静的許可、
 * それ以外は optional_host_permissions で実行時に要求する。
 */

export function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

export function extractOriginPattern(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) return null;
    return `${parsed.origin}/*`;
  } catch {
    return null;
  }
}

export async function hasHostPermission(url: string): Promise<boolean> {
  if (isLocalhostUrl(url)) return true;
  const pattern = extractOriginPattern(url);
  if (!pattern) return false;
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

export async function requestHostPermission(url: string): Promise<boolean> {
  if (isLocalhostUrl(url)) return true;
  const pattern = extractOriginPattern(url);
  if (!pattern) return false;
  try {
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}
