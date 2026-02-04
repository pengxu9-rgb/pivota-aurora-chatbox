export type ExternalVerificationCitationV1 = {
  title: string;
  source?: string | null;
  year?: number | null;
  url?: string | null;
  note?: string | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function coerceNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeCitationItem(input: unknown): ExternalVerificationCitationV1 | null {
  if (typeof input === 'string') {
    const title = input.trim();
    if (!title) return null;
    return { title };
  }

  if (!isPlainObject(input)) return null;

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return null;

  const source = typeof input.source === 'string' ? input.source.trim() || null : null;
  const yearRaw = coerceNumber(input.year);
  const year = yearRaw == null ? null : Math.round(yearRaw);
  const url = typeof input.url === 'string' ? input.url.trim() || null : null;
  const note = typeof input.note === 'string' ? input.note.trim() || null : null;

  return { title, source, year, url, note };
}

function normalizeCitationsList(input: unknown): ExternalVerificationCitationV1[] {
  if (!Array.isArray(input)) return [];
  const out: ExternalVerificationCitationV1[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    const normalized = normalizeCitationItem(item);
    if (!normalized) continue;

    const key = (normalized.url || normalized.note || normalized.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);

    if (out.length >= 10) break;
  }

  return out;
}

function tryReadExternalVerificationCitations(obj: Record<string, unknown> | null): ExternalVerificationCitationV1[] {
  if (!obj) return [];
  const ext =
    (isPlainObject(obj.external_verification) ? obj.external_verification : null) ??
    (isPlainObject((obj as any).externalVerification) ? (obj as any).externalVerification : null);

  if (!ext || !isPlainObject(ext)) return [];
  return normalizeCitationsList((ext as any).citations);
}

export function extractExternalVerificationCitations(payload: unknown): ExternalVerificationCitationV1[] {
  if (!isPlainObject(payload)) return [];

  const roots: Array<Record<string, unknown> | null> = [
    payload,
    isPlainObject((payload as any).structured) ? ((payload as any).structured as Record<string, unknown>) : null,
    isPlainObject((payload as any).context) ? ((payload as any).context as Record<string, unknown>) : null,
    isPlainObject((payload as any).result) ? ((payload as any).result as Record<string, unknown>) : null,
  ];

  for (const root of roots) {
    const citations = tryReadExternalVerificationCitations(root);
    if (citations.length) return citations;
  }

  return [];
}

