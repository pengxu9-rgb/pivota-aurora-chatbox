export type AuroraUserProfile = {
  displayName: string;
  avatarUrl: string;
};

const STORAGE_KEY_PREFIX = 'pivota_aurora_user_profile_v1:';
export const AURORA_USER_PROFILE_UPDATED_EVENT = 'aurora:user-profile-updated';

const normalizeEmail = (email: string): string => String(email || '').trim().toLowerCase();

const toStorageKey = (email: string): string => `${STORAGE_KEY_PREFIX}${normalizeEmail(email)}`;

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const normalizeProfile = (value: unknown): AuroraUserProfile => {
  const obj = asObject(value) || {};
  const displayName = typeof obj.displayName === 'string' ? obj.displayName.trim().slice(0, 40) : '';
  const avatarUrl = typeof obj.avatarUrl === 'string' ? obj.avatarUrl.trim() : '';
  return { displayName, avatarUrl };
};

const emitProfileUpdated = (email: string, profile: AuroraUserProfile | null): void => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(AURORA_USER_PROFILE_UPDATED_EVENT, {
        detail: { email: normalizeEmail(email), profile },
      }),
    );
  } catch {
    // ignore
  }
};

export function loadAuroraUserProfile(email: string): AuroraUserProfile | null {
  if (typeof window === 'undefined') return null;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  try {
    const raw = window.localStorage.getItem(toStorageKey(normalizedEmail));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const normalized = normalizeProfile(parsed);
    if (!normalized.displayName && !normalized.avatarUrl) return null;
    return normalized;
  } catch {
    return null;
  }
}

export function saveAuroraUserProfile(email: string, profile: Partial<AuroraUserProfile>): AuroraUserProfile | null {
  if (typeof window === 'undefined') return null;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  try {
    const next = normalizeProfile(profile);
    if (!next.displayName && !next.avatarUrl) {
      window.localStorage.removeItem(toStorageKey(normalizedEmail));
      emitProfileUpdated(normalizedEmail, null);
      return null;
    }
    window.localStorage.setItem(toStorageKey(normalizedEmail), JSON.stringify(next));
    emitProfileUpdated(normalizedEmail, next);
    return next;
  } catch {
    return null;
  }
}

export function clearAuroraUserProfile(email: string): void {
  if (typeof window === 'undefined') return;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  try {
    window.localStorage.removeItem(toStorageKey(normalizedEmail));
    emitProfileUpdated(normalizedEmail, null);
  } catch {
    // ignore
  }
}
