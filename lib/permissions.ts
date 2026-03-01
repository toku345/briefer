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

export function extractOriginPattern(url: string): string | null {
  try {
    return `${new URL(url).origin}/*`;
  } catch {
    return null;
  }
}

export async function hasHostPermission(url: string): Promise<boolean> {
  if (isLocalhostUrl(url)) return true;
  const pattern = extractOriginPattern(url);
  if (!pattern) return false;
  return chrome.permissions.contains({ origins: [pattern] });
}

export async function requestHostPermission(url: string): Promise<boolean> {
  if (isLocalhostUrl(url)) return true;
  const pattern = extractOriginPattern(url);
  if (!pattern) return false;
  return chrome.permissions.request({ origins: [pattern] });
}
