import { bffJson, makeDefaultHeaders, type Language } from '@/lib/pivotaAgentBff';
import { loadAuroraAuthSessionForRevalidation } from '@/lib/auth';

export type ActivityEventType =
  | 'chat_started'
  | 'skin_analysis'
  | 'tracker_logged'
  | 'profile_updated'
  | 'travel_plan_created'
  | 'travel_plan_updated'
  | 'travel_plan_archived';

export type ActivityKind =
  | 'chat_started'
  | 'skin_analysis'
  | 'tracker_logged'
  | 'profile_updated'
  | 'travel_plan';

export type ActivityItem = {
  activity_id: string | null;
  event_type: ActivityEventType | string;
  payload: Record<string, unknown>;
  deeplink: string | null;
  source: string;
  occurred_at_ms: number;
  created_at?: string;
  activity_kind?: ActivityKind | null;
  detail_available?: boolean;
};

export type ActivityListResponse = {
  items: ActivityItem[];
  next_cursor: string | null;
};

export type ActivityDetailAction = {
  action_id: string;
  deeplink: string;
  label: string;
  variant?: 'primary' | 'secondary' | string;
};

export type ActivityDetail = {
  kind: ActivityKind;
  snapshot: Record<string, unknown>;
  actions: ActivityDetailAction[];
};

export type ActivityDetailResponse = {
  item: ActivityItem;
  detail: ActivityDetail;
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
  const authToken = loadAuroraAuthSessionForRevalidation()?.token || undefined;
  const query: Record<string, string> = {};
  if (Number.isFinite(Number(options.limit))) query.limit = String(Math.trunc(Number(options.limit)));
  if (options.cursor && String(options.cursor).trim()) query.cursor = String(options.cursor).trim();
  if (Array.isArray(options.types) && options.types.length) query.types = options.types.join(',');
  return bffJson<ActivityListResponse>(withQuery('/v1/activity', query), { ...headers, auth_token: authToken }, { method: 'GET' });
};

export const logActivity = async (
  language: Language,
  input: ActivityLogInput,
): Promise<{ ok: boolean; activity_id: string | null }> => {
  const headers = makeDefaultHeaders(language);
  const authToken = loadAuroraAuthSessionForRevalidation()?.token || undefined;
  return bffJson<{ ok: boolean; activity_id: string | null }>('/v1/activity/log', { ...headers, auth_token: authToken }, {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
    }),
  });
};

export const getActivityDetail = async (
  language: Language,
  activityId: string,
): Promise<ActivityDetailResponse> => {
  const headers = makeDefaultHeaders(language);
  return bffJson<ActivityDetailResponse>(`/v1/activity/${encodeURIComponent(activityId)}`, headers, {
    method: 'GET',
  });
};
