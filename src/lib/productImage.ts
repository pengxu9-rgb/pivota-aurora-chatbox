const toHttpUrl = (raw: unknown): string => {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : '';
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

  const seen = new Set<string>();
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    return url;
  }
  return '';
};
