import { getApiBaseUrl, getApiRootUrl } from './pivotaApi';
import type { LangPref } from './persistence';

export type GlowBootstrapSummary = {
  goal_primary: string | null;
  plan_am_short: string[] | null;
  plan_pm_short: string[] | null;
  sensitivities: string[] | null;
  last_seen_at: string | null;
  days_since_last: number | null;
  checkin_due: boolean | null;
};

export type GlowArtifactsPresent = {
  has_profile: boolean;
  has_products: boolean;
  has_plan: boolean;
};

export type GlowSessionBootstrapResponse = {
  is_returning: boolean;
  aurora_uid: string;
  lang: LangPref;
  summary: GlowBootstrapSummary | null;
  artifacts_present: GlowArtifactsPresent;
};

const asObject = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
};

const asString = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};

const asNumber = (v: unknown): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
};

const asBoolean = (v: unknown): boolean | null => {
  if (typeof v !== 'boolean') return null;
  return v;
};

const asStringArray = (v: unknown): string[] | null => {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .slice(0, 12);
  return out.length ? out : null;
};

const joinUrl = (baseUrl: string, path: string) => {
  const normalized = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalized}${normalizedPath}`;
};

export const fetchGlowSessionBootstrap = async (args: {
  auroraUid?: string;
  lang: LangPref;
  briefId?: string;
  traceId?: string;
  sessionId?: string;
  signal?: AbortSignal;
}): Promise<GlowSessionBootstrapResponse | null> => {
  const baseUrlV1 = getApiBaseUrl();
  const baseUrlRoot = getApiRootUrl();
  const candidates = [baseUrlV1, baseUrlRoot].filter(Boolean) as string[];
  const seen = new Set<string>();
  const baseUrls: string[] = [];
  for (const raw of candidates) {
    const normalized = raw.replace(/\/+$/, '');
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    baseUrls.push(normalized);
  }
  if (!baseUrls.length) return null;

  for (const baseUrl of baseUrls) {
    const url = new URL(joinUrl(baseUrl, '/session/bootstrap'));
    if (args.briefId) url.searchParams.set('brief_id', args.briefId);
    if (args.sessionId) url.searchParams.set('session_id', args.sessionId);

    // Best-effort: some deployments expose this endpoint without the `/v1` prefix.
    // We try both base urls (with and without `/v1`) and gracefully return null on 404s.
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: args.signal,
      headers: {
        Accept: 'application/json',
        ...(args.auroraUid ? { 'X-Aurora-Uid': args.auroraUid } : {}),
        'X-Aurora-Lang': args.lang,
        ...(args.briefId ? { 'X-Brief-ID': args.briefId } : {}),
        ...(args.traceId ? { 'X-Trace-ID': args.traceId } : {}),
      },
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 405) continue;
      return null;
    }

    const raw = (await res.json()) as unknown;
    const obj = asObject(raw);
    if (!obj) return null;

    const isReturning = obj.is_returning === true;
    const auroraUid = asString(obj.aurora_uid) ?? args.auroraUid ?? '';
    const langRaw = asString(obj.lang);
    const lang: LangPref = langRaw === 'cn' ? 'cn' : 'en';

    const summaryObj = asObject(obj.summary);
    const summary: GlowBootstrapSummary | null = summaryObj
      ? {
          goal_primary: asString(summaryObj.goal_primary),
          plan_am_short: asStringArray(summaryObj.plan_am_short),
          plan_pm_short: asStringArray(summaryObj.plan_pm_short),
          sensitivities: asStringArray(summaryObj.sensitivities),
          last_seen_at: asString(summaryObj.last_seen_at),
          days_since_last: asNumber(summaryObj.days_since_last),
          checkin_due: asBoolean(summaryObj.checkin_due),
        }
      : null;

    const artifactsObj = asObject(obj.artifacts_present) ?? {};
    const artifactsPresent: GlowArtifactsPresent = {
      has_profile: artifactsObj.has_profile === true,
      has_products: artifactsObj.has_products === true,
      has_plan: artifactsObj.has_plan === true,
    };

    return {
      is_returning: isReturning,
      aurora_uid: auroraUid,
      lang,
      summary,
      artifacts_present: artifactsPresent,
    };
  }

  return null;
};
