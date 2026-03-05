import { bffJson, makeDefaultHeaders, type Language } from '@/lib/pivotaAgentBff';

export type ActivityEventType =
  | 'chat_started'
  | 'skin_analysis'
  | 'tracker_logged'
  | 'profile_updated'
  | 'travel_plan_created'
  | 'travel_plan_updated'
  | 'travel_plan_archived';

export type ActivityItem = {
  activity_id: string | null;
  event_type: ActivityEventType | string;
  payload: Record<string, unknown>;
  deeplink: string | null;
  source: string;
  occurred_at_ms: number;
  created_at?: string;
};

export type ActivityListResponse = {
  items: ActivityItem[];
  next_cursor: string | null;
};

export type ActivityLogInput = {
  event_type: ActivityEventType;
  payload?: Record<string, unknown>;
  deeplink?: string;
  occurred_at_ms?: number;
  source?: string;
};

const withQuery = (path: string, query: Record<string, string>) => {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) sp.set(key, value);
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
};

export const listActivity = async (
  language: Language,
  options: { limit?: number; cursor?: string | null; types?: ActivityEventType[] } = {},
): Promise<ActivityListResponse> => {
  const headers = makeDefaultHeaders(language);
  const query: Record<string, string> = {};
  if (Number.isFinite(Number(options.limit))) query.limit = String(Math.trunc(Number(options.limit)));
  if (options.cursor && String(options.cursor).trim()) query.cursor = String(options.cursor).trim();
  if (Array.isArray(options.types) && options.types.length) query.types = options.types.join(',');
  return bffJson<ActivityListResponse>(withQuery('/v1/activity', query), headers, { method: 'GET' });
};

export const logActivity = async (
  language: Language,
  input: ActivityLogInput,
): Promise<{ ok: boolean; activity_id: string | null }> => {
  const headers = makeDefaultHeaders(language);
  return bffJson<{ ok: boolean; activity_id: string | null }>('/v1/activity/log', headers, {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
    }),
  });
};
