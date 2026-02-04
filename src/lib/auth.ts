export type AuroraAuthSession = {
  token: string;
  email: string;
  expires_at?: string | null;
};

const STORAGE_KEY = 'pivota_aurora_auth_session_v1';

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isExpired(expiresAt: string | null | undefined): boolean {
  const v = String(expiresAt || '').trim();
  if (!v) return false;
  const ts = Date.parse(v);
  if (!Number.isFinite(ts)) return false;
  return ts <= Date.now();
}

export function loadAuroraAuthSession(): AuroraAuthSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const token = typeof (parsed as any).token === 'string' ? (parsed as any).token.trim() : '';
    const email = typeof (parsed as any).email === 'string' ? (parsed as any).email.trim() : '';
    const expires_at =
      typeof (parsed as any).expires_at === 'string' ? (parsed as any).expires_at.trim() : (parsed as any).expires_at == null ? null : null;
    if (!token || !email) return null;
    if (isExpired(expires_at)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { token, email, expires_at };
  } catch {
    return null;
  }
}

export function saveAuroraAuthSession(session: AuroraAuthSession): void {
  try {
    if (!session || typeof session !== 'object') return;
    const token = String(session.token || '').trim();
    const email = String(session.email || '').trim();
    const expires_at = session.expires_at == null ? null : String(session.expires_at).trim();
    if (!token || !email) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, email, expires_at }));
  } catch {
    // ignore
  }
}

export function clearAuroraAuthSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

