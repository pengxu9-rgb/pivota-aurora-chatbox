export type ReturnWelcomeSummary = {
  goal_primary: string | null;
  plan_am_short: string[] | null;
  plan_pm_short: string[] | null;
  sensitivities: string[] | null;
  last_seen_at: string | null;
  days_since_last: number | null;
  checkin_due: boolean | null;
};

type Language = 'EN' | 'CN';

type RoutineEntry = { step?: string | null; product?: string | null };
type RoutineIntake = { am?: RoutineEntry[]; pm?: RoutineEntry[] };

const asObject = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
};

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const asString = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};

const uniqueStrings = (v: unknown, limit = 12): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of asArray(v)) {
    const s = asString(raw);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
};

const safeJsonParseObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    return asObject(parsed);
  } catch {
    return null;
  }
};

const normalizeRoutine = (value: unknown): RoutineIntake | null => {
  const obj =
    typeof value === 'string'
      ? safeJsonParseObject(value)
      : asObject(value);
  if (!obj) return null;

  const readEntries = (key: 'am' | 'pm'): RoutineEntry[] => {
    const entries = asArray(obj[key]).map((x) => asObject(x)).filter(Boolean) as Array<Record<string, unknown>>;
    return entries
      .map((e) => ({
        step: asString(e.step) ?? null,
        product: asString(e.product) ?? null,
      }))
      .filter((e) => Boolean(e.step || e.product));
  };

  return { am: readEntries('am'), pm: readEntries('pm') };
};

const titleCase = (raw: string) =>
  raw
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

const stepLabel = (rawStep: string, language: Language): string => {
  const key = rawStep.trim().toLowerCase();
  const map: Record<string, { en: string; zh: string }> = {
    cleanser: { en: 'Cleanser', zh: '洁面' },
    toner: { en: 'Toner', zh: '化妆水' },
    essence: { en: 'Essence', zh: '精华水' },
    serum: { en: 'Serum', zh: '精华' },
    treatment: { en: 'Treatment', zh: '功效' },
    moisturizer: { en: 'Moisturizer', zh: '面霜' },
    cream: { en: 'Moisturizer', zh: '面霜' },
    spf: { en: 'SPF', zh: '防晒' },
    sunscreen: { en: 'SPF', zh: '防晒' },
    mask: { en: 'Mask', zh: '面膜' },
    oil: { en: 'Oil', zh: '护肤油' },
  };

  if (map[key]) return language === 'CN' ? map[key].zh : map[key].en;
  if (!key) return '';
  return language === 'CN' ? rawStep.trim() : titleCase(rawStep);
};

const truncate = (s: string, max = 30) => {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
};

const formatPlanShort = (entries: RoutineEntry[] | null | undefined, language: Language): string[] | null => {
  if (!entries || !entries.length) return null;
  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const step = stepLabel(entry.step || '', language);
    const product = (entry.product || '').trim();
    const productNorm = product.toLowerCase();
    const item =
      product && productNorm !== 'none' && productNorm !== 'n/a' && productNorm !== 'na'
        ? `${step || (language === 'CN' ? '步骤' : 'Step')}: ${truncate(product)}`
        : step;
    const cleaned = item.trim();
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }

  if (!out.length) return null;

  const maxItems = 4;
  if (out.length > maxItems) {
    const extra = out.length - (maxItems - 1);
    return [...out.slice(0, maxItems - 1), `+${extra}`];
  }

  return out;
};

const normalizeSensitivityLabel = (raw: string, language: Language): string => {
  const key = raw.trim().toLowerCase();
  const map: Record<string, { en: string; zh: string }> = {
    low: { en: 'Low', zh: '低' },
    medium: { en: 'Medium', zh: '中' },
    high: { en: 'High', zh: '高' },
  };
  if (map[key]) return language === 'CN' ? map[key].zh : map[key].en;
  return raw.trim();
};

const parseDateMs = (value: string): number | null => {
  const s = value.trim();
  if (!s) return null;
  // Handle YYYY-MM-DD explicitly to avoid locale ambiguities.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const ts = Date.parse(`${s}T00:00:00Z`);
    return Number.isFinite(ts) ? ts : null;
  }
  const ts = Date.parse(s);
  return Number.isFinite(ts) ? ts : null;
};

const daysBetween = (fromMs: number, toMs: number): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = Math.floor(fromMs / msPerDay);
  const b = Math.floor(toMs / msPerDay);
  return Math.max(0, b - a);
};

export function buildReturnWelcomeSummary(args: {
  profile: unknown;
  recent_logs: unknown;
  checkin_due: unknown;
  language: Language;
  nowMs?: number;
}): ReturnWelcomeSummary {
  const nowMs = typeof args.nowMs === 'number' && Number.isFinite(args.nowMs) ? args.nowMs : Date.now();

  const profile = asObject(args.profile);
  const recentLogs = asArray(args.recent_logs).map((x) => asObject(x)).filter(Boolean) as Array<Record<string, unknown>>;

  const goals = uniqueStrings(profile?.goals);
  const goalPrimary = goals.length ? goals[0] : null;

  const routine = normalizeRoutine(profile?.currentRoutine);
  const planAm = formatPlanShort(routine?.am ?? null, args.language);
  const planPm = formatPlanShort(routine?.pm ?? null, args.language);

  const contraindications = uniqueStrings(profile?.contraindications);
  const sensitivities = contraindications.length
    ? contraindications
    : (() => {
        const sens = asString(profile?.sensitivity);
        if (!sens) return null;
        const label = normalizeSensitivityLabel(sens, args.language);
        return [args.language === 'CN' ? `敏感度：${label}` : `Sensitivity: ${label}`];
      })();

  let lastSeenMs: number | null = null;
  for (const log of recentLogs) {
    const candidate = asString(log.date) ?? asString((log as any).created_at) ?? asString((log as any).createdAt);
    if (!candidate) continue;
    const ts = parseDateMs(candidate);
    if (ts == null) continue;
    if (lastSeenMs == null || ts > lastSeenMs) lastSeenMs = ts;
  }

  if (lastSeenMs == null) {
    const updatedAt = asString((profile as any)?.updated_at) ?? asString((profile as any)?.updatedAt);
    if (updatedAt) lastSeenMs = parseDateMs(updatedAt);
  }

  const lastSeenAt = lastSeenMs == null ? null : new Date(lastSeenMs).toISOString();
  const daysSinceLast = lastSeenMs == null ? null : daysBetween(lastSeenMs, nowMs);

  return {
    goal_primary: goalPrimary,
    plan_am_short: planAm,
    plan_pm_short: planPm,
    sensitivities,
    last_seen_at: lastSeenAt,
    days_since_last: daysSinceLast,
    checkin_due: typeof args.checkin_due === 'boolean' ? args.checkin_due : null,
  };
}
