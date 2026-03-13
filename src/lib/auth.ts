export type AuroraAuthSession = {
  token: string;
  email: string;
  expires_at?: string | null;
};

export type AuroraResponseAuthMeta = {
  state: 'authenticated' | 'invalid';
  user: {
    email: string | null;
  };
  expires_at: string | null;
};

const STORAGE_KEY = 'pivota_aurora_auth_session_v1';
export const AURORA_AUTH_SESSION_CHANGED_EVENT = 'aurora_auth_session_changed';

function dispatchAuthChange(): void {
  try {
    window.dispatchEvent(new CustomEvent(AURORA_AUTH_SESSION_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isExpired(expiresAt: string | null | undefined): boolean {
  const v = String(expiresAt || '').trim();
  if (!v) return false;
  const ts = Date.parse(v);
  if (!Number.isFinite(ts)) return false;
  return ts <= Date.now();
}

function normalizeAuroraAuthSession(value: unknown): AuroraAuthSession | null {
  if (!isRecord(value)) return null;
  const token = typeof value.token === 'string' ? value.token.trim() : '';
  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const expires_at =
    typeof value.expires_at === 'string' ? value.expires_at.trim() : value.expires_at == null ? null : null;
  if (!token || !email) return null;
  return { token, email, expires_at };
}

function readStoredAuroraAuthSession(options: { enforceExpiry?: boolean } = {}): AuroraAuthSession | null {
  const enforceExpiry = options.enforceExpiry !== false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = normalizeAuroraAuthSession(safeJsonParse(raw));
    if (!session) return null;
    if (enforceExpiry && isExpired(session.expires_at)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function sameAuroraAuthSession(a: AuroraAuthSession | null, b: AuroraAuthSession | null): boolean {
  if (!a || !b) return a === b;
  return a.token === b.token && a.email === b.email && (a.expires_at || null) === (b.expires_at || null);
}

function normalizeAuroraResponseAuthMeta(value: unknown): AuroraResponseAuthMeta | null {
  if (!isRecord(value)) return null;
  const state = value.state === 'authenticated' || value.state === 'invalid' ? value.state : null;
  const user = isRecord(value.user) ? value.user : {};
  const email = typeof user.email === 'string' ? user.email.trim() : user.email == null ? null : null;
  const expires_at = typeof value.expires_at === 'string' ? value.expires_at.trim() : value.expires_at == null ? null : null;
  if (!state) return null;
  return {
    state,
    user: { email },
    expires_at,
  };
}

export function loadAuroraAuthSession(): AuroraAuthSession | null {
  return readStoredAuroraAuthSession();
}

export function saveAuroraAuthSession(session: AuroraAuthSession): void {
  try {
    const nextSession = normalizeAuroraAuthSession(session);
    if (!nextSession) return;
    const currentSession = readStoredAuroraAuthSession({ enforceExpiry: false });
    if (sameAuroraAuthSession(currentSession, nextSession)) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    dispatchAuthChange();
  } catch {
    // ignore
  }
}

export function clearAuroraAuthSession(): void {
  try {
    const hadSession = window.localStorage.getItem(STORAGE_KEY) != null;
    window.localStorage.removeItem(STORAGE_KEY);
    if (hadSession) dispatchAuthChange();
  } catch {
    // ignore
  }
}

export function syncAuroraAuthSessionFromResponse(
  response: unknown,
  options: { fallbackToken?: string | null } = {},
): void {
  const root = isRecord(response) ? response : null;
  const meta = root && isRecord(root.meta) ? root.meta : null;
  const authMeta = normalizeAuroraResponseAuthMeta(meta && meta.auth);
  if (!authMeta) return;

  if (authMeta.state === 'invalid') {
    clearAuroraAuthSession();
    return;
  }

  const currentSession = readStoredAuroraAuthSession({ enforceExpiry: false });
  const token = String(options.fallbackToken || currentSession?.token || '').trim();
  const email = String(authMeta.user.email || currentSession?.email || '').trim();
  if (!token || !email) return;

  saveAuroraAuthSession({
    token,
    email,
    expires_at: authMeta.expires_at,
  });
}
