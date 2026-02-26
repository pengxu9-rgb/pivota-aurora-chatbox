const toHttpUrl = (raw: unknown): string => {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : '';
};

const canonicalUrlKey = (value: string): string => value.replace(/^https?:\/\//i, '');

const isHttpsUrl = (value: string): boolean => /^https:\/\//i.test(value);

const dedupeUrlsPreferHttps = (urls: string[]): string[] => {
  const byKey = new Map<string, string>();
  for (const rawUrl of urls) {
    const url = toHttpUrl(rawUrl);
    if (!url) continue;
    const key = canonicalUrlKey(url);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, url);
      continue;
    }
    if (!isHttpsUrl(existing) && isHttpsUrl(url)) {
      byKey.set(key, url);
    }
  }
  return Array.from(byKey.values());
};

const extractUrlFromObject = (raw: unknown): string => {
  if (!raw || typeof raw !== 'object') return '';
  const record = raw as Record<string, unknown>;
  return (
    toHttpUrl(record.url) ||
    toHttpUrl(record.image_url) ||
    toHttpUrl(record.imageUrl) ||
    toHttpUrl(record.src)
  );
};

const extractUrlsFromCollection = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const candidate = typeof item === 'string' ? toHttpUrl(item) : extractUrlFromObject(item);
    if (!candidate) continue;
    out.push(candidate);
  }
  return out;
};

export const pickProductImageUrl = (raw: Record<string, unknown> | null | undefined): string => {
  if (!raw || typeof raw !== 'object') return '';

  const candidates: string[] = [];
  const pushCandidate = (value: unknown) => {
    const candidate = toHttpUrl(value);
    if (!candidate) return;
    candidates.push(candidate);
  };

  pushCandidate(raw.image_url);
  pushCandidate(raw.imageUrl);
  pushCandidate(raw.image);
  for (const url of extractUrlsFromCollection(raw.images)) pushCandidate(url);
  for (const url of extractUrlsFromCollection(raw.image_urls)) pushCandidate(url);

  const dedupedCandidates = dedupeUrlsPreferHttps(candidates);
  for (const url of dedupedCandidates) {
    if (isHttpsUrl(url)) return url;
  }
  return dedupedCandidates[0] || '';
};
