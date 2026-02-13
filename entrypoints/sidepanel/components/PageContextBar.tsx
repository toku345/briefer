interface PageContextBarProps {
  title: string | null;
  url: string | null;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function PageContextBar({ title, url }: PageContextBarProps) {
  if (!title && !url) return null;

  const hostname = url ? safeHostname(url) : null;

  return (
    <div className="page-context-bar" title={title ?? undefined}>
      <span className="page-context-title">{title || '(無題)'}</span>
      {hostname && <span className="page-context-url">{hostname}</span>}
    </div>
  );
}
