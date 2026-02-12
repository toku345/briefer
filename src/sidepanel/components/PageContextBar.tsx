import { useCallback, useEffect, useState } from 'react';

interface PageContextBarProps {
  title?: string;
  url?: string;
  isLoading?: boolean;
}

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function PageContextBar({ title, url, isLoading }: PageContextBarProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timeoutId = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [copied]);

  const handleUrlClick = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch (err) {
      console.error('[Briefer] Failed to copy URL:', err);
    }
  }, [url]);

  if (isLoading) {
    return (
      <div className="page-context-bar">
        <span className="loading-text">ページを読み込み中...</span>
      </div>
    );
  }

  if (!title) return null;

  const hostname = url ? getHostname(url) : null;

  return (
    <div className="page-context-bar">
      {/* Google Favicons API はドメイン情報を外部送信するため、プライバシー保護のためローカルアイコンを使用 */}
      <span className="favicon" aria-hidden="true">
        🌐
      </span>
      <span className="page-title">{title}</span>
      {url && (
        <button
          type="button"
          className="page-url"
          onClick={handleUrlClick}
          title={copied ? 'コピーしました' : 'URLをコピー'}
        >
          {copied ? 'コピーしました' : hostname}
        </button>
      )}
    </div>
  );
}
