import { PivotaAgentBffError, bffJson, makeDefaultHeaders, type Language } from '@/lib/pivotaAgentBff';

export type TravelPlanStatus = 'upcoming' | 'in_trip' | 'completed' | 'archived';

export type DestinationPlace = {
  label: string;
  canonical_name: string;
  latitude: number;
  longitude: number;
  country_code?: string | null;
  country?: string | null;
  admin1?: string | null;
  timezone?: string | null;
  resolution_source?: 'auto_resolved' | 'user_selected';
};

export type TravelPlanCardModel = {
  trip_id: string;
  destination: string;
  destination_place?: DestinationPlace | null;
  start_date: string;
  end_date: string;
  indoor_outdoor_ratio?: number;
  itinerary?: string;
  created_at_ms: number;
  updated_at_ms: number;
  is_archived?: boolean;
  archived_at_ms?: number | null;
  status: TravelPlanStatus;
  days_to_start?: number | null;
  days_to_end?: number | null;
  prep_checklist: string[];
};

export type TravelPlansSummary = {
  active_trip_id: string | null;
  counts: {
    in_trip: number;
    upcoming: number;
    completed: number;
    archived: number;
  };
};

export type TravelPlansListResponse = {
  plans: TravelPlanCardModel[];
  summary: TravelPlansSummary;
};

export type CreateTravelPlanInput = {
  destination: string;
  destination_place?: DestinationPlace;
  start_date: string;
  end_date: string;
  indoor_outdoor_ratio?: number;
  itinerary?: string;
};

export type UpdateTravelPlanInput = Partial<CreateTravelPlanInput> & {
  is_archived?: boolean;
};

export type TravelPlanMutationResponse = {
  plan: TravelPlanCardModel | null;
  summary: TravelPlansSummary;
};

export type DestinationAmbiguityResponse = {
  error: 'DESTINATION_AMBIGUOUS';
  normalized_query: string;
  candidates: DestinationPlace[];
};

const withQuery = (path: string, query: Record<string, string>) => {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) sp.set(key, value);
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
};

export const listTravelPlans = async (
  language: Language,
  options: { includeArchived?: boolean } = {},
): Promise<TravelPlansListResponse> => {
  const headers = makeDefaultHeaders(language);
  const path = withQuery('/v1/travel-plans', {
    include_archived: options.includeArchived ? 'true' : 'false',
  });
  return bffJson<TravelPlansListResponse>(path, headers, { method: 'GET' });
};

export const createTravelPlan = async (
  language: Language,
  payload: CreateTravelPlanInput,
): Promise<TravelPlanMutationResponse> => {
  const headers = makeDefaultHeaders(language);
  return bffJson<TravelPlanMutationResponse>('/v1/travel-plans', headers, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateTravelPlan = async (
  language: Language,
  tripId: string,
  payload: UpdateTravelPlanInput,
): Promise<TravelPlanMutationResponse> => {
  const headers = makeDefaultHeaders(language);
  return bffJson<TravelPlanMutationResponse>(`/v1/travel-plans/${encodeURIComponent(tripId)}`, headers, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const archiveTravelPlan = async (
  language: Language,
  tripId: string,
): Promise<TravelPlanMutationResponse> => {
  const headers = makeDefaultHeaders(language);
  return bffJson<TravelPlanMutationResponse>(`/v1/travel-plans/${encodeURIComponent(tripId)}/archive`, headers, {
    method: 'POST',
  });
};

export const getTravelPlanById = async (
  language: Language,
  tripId: string,
): Promise<TravelPlanMutationResponse> => {
  const headers = makeDefaultHeaders(language);
  return bffJson<TravelPlanMutationResponse>(`/v1/travel-plans/${encodeURIComponent(tripId)}`, headers, {
    method: 'GET',
  });
};

export const getDestinationAmbiguityPayload = (error: unknown): DestinationAmbiguityResponse | null => {
  if (!(error instanceof PivotaAgentBffError)) return null;
  if (error.status !== 409) return null;
  const body = error.responseBody;
  if (!body || typeof body !== 'object') return null;
  if ((body as { error?: string }).error !== 'DESTINATION_AMBIGUOUS') return null;
  const candidates = Array.isArray((body as { candidates?: unknown[] }).candidates)
    ? ((body as { candidates: unknown[] }).candidates as DestinationPlace[])
    : [];
  return {
    error: 'DESTINATION_AMBIGUOUS',
    normalized_query:
      typeof (body as { normalized_query?: string }).normalized_query === 'string'
        ? (body as { normalized_query: string }).normalized_query
        : '',
    candidates,
  };
};
