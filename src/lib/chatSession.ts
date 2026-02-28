export type SessionProfile = Record<string, unknown>;

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
  sessionMeta,
}: {
  state: string;
  profileSnapshot?: SessionProfile | null;
  bootstrapProfile?: SessionProfile | null;
  sessionMeta?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const session: Record<string, unknown> = { state };
  const profile = resolveSessionProfile({ profileSnapshot, bootstrapProfile });
  if (profile) session.profile = profile;
  if (sessionMeta && typeof sessionMeta === 'object' && !Array.isArray(sessionMeta)) {
    session.meta = sessionMeta;
  }
  return session;
}
