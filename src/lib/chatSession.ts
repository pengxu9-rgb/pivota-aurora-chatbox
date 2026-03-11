export type SessionProfile = Record<string, unknown>;
export type ChatSessionAnalysisPhotoRef = {
  slot_id: string;
  photo_id: string;
  qc_status: string;
};
export type ChatSessionAnalysisContext = {
  analysis_origin?: 'photo' | 'profile';
  use_photo?: boolean;
  photo_refs?: ChatSessionAnalysisPhotoRef[];
  source_card_type?: string;
};

function isPlainObject(value: unknown): value is SessionProfile {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeSessionProfiles(
  baseProfile?: SessionProfile | null,
  patchProfile?: SessionProfile | null,
): SessionProfile | null {
  const base = isPlainObject(baseProfile) ? baseProfile : null;
  const patch = isPlainObject(patchProfile) ? patchProfile : null;
  if (!base && !patch) return null;
  if (!base) return patch ? { ...patch } : null;
  if (!patch) return { ...base };

  const merged: SessionProfile = {
    ...base,
    ...patch,
  };
  const baseTravelPlan = isPlainObject(base.travel_plan) ? base.travel_plan : null;
  const patchTravelPlan = isPlainObject(patch.travel_plan) ? patch.travel_plan : null;
  if (baseTravelPlan || patchTravelPlan) {
    merged.travel_plan = {
      ...(baseTravelPlan || {}),
      ...(patchTravelPlan || {}),
    };
  }
  return merged;
}

export function resolveSessionProfile({
  profileSnapshot,
  bootstrapProfile,
}: {
  profileSnapshot?: SessionProfile | null;
  bootstrapProfile?: SessionProfile | null;
}): SessionProfile | null {
  return profileSnapshot ?? bootstrapProfile ?? null;
}

export function buildChatSession({
  state,
  profileSnapshot,
  bootstrapProfile,
  sessionProfilePatch,
  sessionMeta,
  analysisContext,
}: {
  state: string;
  profileSnapshot?: SessionProfile | null;
  bootstrapProfile?: SessionProfile | null;
  sessionProfilePatch?: SessionProfile | null;
  sessionMeta?: Record<string, unknown> | null;
  analysisContext?: ChatSessionAnalysisContext | null;
}): Record<string, unknown> {
  const session: Record<string, unknown> = { state };
  const profile = mergeSessionProfiles(
    resolveSessionProfile({ profileSnapshot, bootstrapProfile }),
    sessionProfilePatch,
  );
  if (profile) session.profile = profile;
  const meta =
    sessionMeta && typeof sessionMeta === 'object' && !Array.isArray(sessionMeta)
      ? { ...sessionMeta }
      : {};
  if (analysisContext && typeof analysisContext === 'object' && !Array.isArray(analysisContext)) {
    meta.analysis_context = analysisContext;
  }
  if (Object.keys(meta).length > 0) {
    session.meta = meta;
  }
  return session;
}
