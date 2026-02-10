type UiLanguage = 'CN' | 'EN';

const isHttpProtocol = (url: URL): boolean => url.protocol === 'http:' || url.protocol === 'https:';

const isGoogleHost = (hostname: string): boolean => {
  const host = String(hostname || '').toLowerCase();
  return host === 'google.com' || host.endsWith('.google.com') || host === 'google.cn' || host.endsWith('.google.cn');
};

export function normalizeOutboundFallbackUrl(rawUrl: string): string | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (!isHttpProtocol(parsed)) return null;

  if (isGoogleHost(parsed.hostname) && parsed.pathname.toLowerCase() === '/url') {
    const target =
      parsed.searchParams.get('url') ||
      parsed.searchParams.get('q') ||
      parsed.searchParams.get('u') ||
      parsed.searchParams.get('uddg');
    if (target) {
      try {
        const targetUrl = new URL(target);
        if (isHttpProtocol(targetUrl)) return targetUrl.toString();
      } catch {
        return null;
      }
    }
  }
  return parsed.toString();
}

export function buildGoogleSearchFallbackUrl(rawQuery: string, language: UiLanguage): string | null {
  const query = String(rawQuery || '').trim();
  if (!query) return null;
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', language === 'CN' ? 'zh-CN' : 'en');
  return url.toString();
}
