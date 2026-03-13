import type { Language, Message, Session } from './types';

const UID_KEY = 'aurora_uid';
const LEGACY_UID_KEY = 'pivota_aurora_uid_v1';
const LANG_PREF_KEY = 'lang_pref';
const LEGACY_LANG_PREF_KEY = 'pivota_aurora_lang_pref_v1';
const ACCOUNT_LANG_PREF_KEY_PREFIX = 'pivota_aurora_account_lang_pref_v1:';
const LANG_REPLY_MODE_KEY = 'lang_reply_mode';
const LANG_MISMATCH_HINT_MUTED_UNTIL_KEY = 'lang_mismatch_hint_muted_until';
const CHAT_KEY = 'pivota_aurora_chat_state_v1';
const VERSION = 1;

export type PersistedChatState = {
  version: number;
  saved_at: number;
  aurora_uid: string;
  language: Language;
  session: Session;
  messages: Message[];
};

export type LangPref = 'en' | 'cn' | 'fr' | 'de' | 'ja';
export type LangReplyMode = 'ui_lock' | 'auto_follow_input';

let memoryUid: string | null = null;
let memoryLangPref: LangPref | null = null;

export const isLangPref = (value: unknown): value is LangPref =>
  value === 'en' || value === 'cn' || value === 'fr' || value === 'de' || value === 'ja';

const normalizeStoredLangPref = (value: unknown): LangPref | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (isLangPref(normalized)) return normalized;
  if (normalized === 'zh') return 'cn';
  if (raw === 'EN' || raw === 'FR' || raw === 'DE' || raw === 'JA') return normalized as LangPref;
  if (raw === 'CN' || raw === 'ZH') return 'cn';
  return null;
};

export const toUiLanguage = (pref: LangPref): Language => {
  switch (pref) {
    case 'cn':
      return 'CN';
    case 'fr':
      return 'FR';
    case 'de':
      return 'DE';
    case 'ja':
      return 'JA';
    default:
      return 'EN';
  }
};

export const toBackendLanguage = (language: Language): 'EN' | 'CN' => (language === 'CN' ? 'CN' : 'EN');

export const toBackendLangPref = (pref: LangPref): 'en' | 'cn' => (pref === 'cn' ? 'cn' : 'en');

const isBrowser = () => typeof window !== 'undefined';
const normalizeAccountEmail = (email: string) => String(email || '').trim().toLowerCase();

const safeStorageGet = (key: string): string | null => {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key: string, value: string): boolean => {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeStorageRemove = (key: string): boolean => {
  if (!isBrowser()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

const safeJsonParse = <T>(raw: string): T | undefined => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

const getStoredLangPref = (): LangPref | null => {
  const stored = normalizeStoredLangPref(safeStorageGet(LANG_PREF_KEY));
  if (stored) return stored;

  const legacy = normalizeStoredLangPref(safeStorageGet(LEGACY_LANG_PREF_KEY));
  if (legacy) {
    safeStorageSet(LANG_PREF_KEY, legacy);
    return legacy;
  }
  return memoryLangPref;
};

export const getOrCreateAuroraUid = (): string => {
  const existing = safeStorageGet(UID_KEY);
  if (existing) return existing;
  const legacy = safeStorageGet(LEGACY_UID_KEY);
  if (legacy) {
    // Best-effort migration to the canonical key.
    safeStorageSet(UID_KEY, legacy);
    return legacy;
  }
  if (memoryUid) return memoryUid;

  const cryptoObj = globalThis.crypto as Crypto | undefined;
  const uid = (cryptoObj?.randomUUID?.() ?? `uid_${Date.now()}_${Math.random().toString(16).slice(2)}`).slice(0, 64);

  const stored = safeStorageSet(UID_KEY, uid);
  if (stored) {
    // Best-effort: migrate from legacy key.
    safeStorageSet(LEGACY_UID_KEY, uid);
    return uid;
  }

  memoryUid = uid;
  return uid;
};

export const getAuroraUid = (): string | undefined => {
  const uid = safeStorageGet(UID_KEY);
  if (uid) return uid;
  const legacy = safeStorageGet(LEGACY_UID_KEY);
  if (legacy) {
    safeStorageSet(UID_KEY, legacy);
    return legacy;
  }
  return memoryUid || undefined;
};

export const getLangPref = (): LangPref => {
  return getStoredLangPref() ?? 'en';
};

export const setLangPref = (lang: LangPref) => {
  memoryLangPref = lang;
  const stored = safeStorageSet(LANG_PREF_KEY, lang);
  if (stored) {
    // Best-effort: keep legacy key for older builds.
    safeStorageSet(LEGACY_LANG_PREF_KEY, toBackendLanguage(toUiLanguage(lang)));
  }
  if (isBrowser()) {
    try {
      window.dispatchEvent(new CustomEvent('aurora_lang_pref_changed', { detail: lang }));
    } catch {
      // ignore
    }
  }
};

export const hasExplicitLangPref = (): boolean => getStoredLangPref() != null;

export const getAccountLangPref = (email: string): LangPref | null => {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!normalizedEmail) return null;
  return normalizeStoredLangPref(safeStorageGet(`${ACCOUNT_LANG_PREF_KEY_PREFIX}${normalizedEmail}`));
};

export const setAccountLangPref = (email: string, lang: LangPref): void => {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!normalizedEmail) return;
  safeStorageSet(`${ACCOUNT_LANG_PREF_KEY_PREFIX}${normalizedEmail}`, lang);
};

export const getLangReplyMode = (): LangReplyMode => {
  const stored = safeStorageGet(LANG_REPLY_MODE_KEY);
  if (stored === 'ui_lock' || stored === 'auto_follow_input') return stored;
  return 'ui_lock';
};

export const setLangReplyMode = (mode: LangReplyMode) => {
  safeStorageSet(LANG_REPLY_MODE_KEY, mode);
};

export const getLangMismatchHintMutedUntil = (): number => {
  const raw = safeStorageGet(LANG_MISMATCH_HINT_MUTED_UNTIL_KEY);
  const ts = Number(raw);
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  return Math.floor(ts);
};

export const setLangMismatchHintMutedUntil = (timestampMs: number) => {
  const ts = Number(timestampMs);
  if (!Number.isFinite(ts) || ts <= 0) {
    safeStorageRemove(LANG_MISMATCH_HINT_MUTED_UNTIL_KEY);
    return;
  }
  safeStorageSet(LANG_MISMATCH_HINT_MUTED_UNTIL_KEY, String(Math.floor(ts)));
};

const stripFiles = (_key: string, value: unknown) => {
  // Drop File/Blob to keep localStorage JSON-serializable.
  const v = value as any;
  if (typeof File !== 'undefined' && v instanceof File) return undefined;
  if (typeof Blob !== 'undefined' && v instanceof Blob) return undefined;
  if (typeof FormData !== 'undefined' && v instanceof FormData) return undefined;
  return value;
};

export const loadPersistedChatState = (): PersistedChatState | undefined => {
  const raw = safeStorageGet(CHAT_KEY);
  if (!raw) return undefined;

  const parsed = safeJsonParse<Partial<PersistedChatState>>(raw);
  if (!parsed || parsed.version !== VERSION) return undefined;
  if (!parsed.aurora_uid || !parsed.saved_at || !parsed.session) return undefined;
  if (!parsed.language || !parsed.messages) return undefined;
  if (!Array.isArray(parsed.messages)) return undefined;

  return parsed as PersistedChatState;
};

export const savePersistedChatState = (state: Omit<PersistedChatState, 'version'>) => {
  if (!isBrowser()) return;

  // Avoid storing transient loading placeholders.
  const messages = state.messages.filter((m) => m?.type !== 'loading_card').slice(-120);

  const payload: PersistedChatState = {
    ...state,
    messages,
    version: VERSION,
  };

  try {
    safeStorageSet(CHAT_KEY, JSON.stringify(payload, stripFiles));
  } catch {
    // Ignore quota / serialization errors.
  }
};

export const clearPersistedChatState = () => {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(CHAT_KEY);
  } catch {
    // ignore
  }
};

export const __resetPersistenceMemoryForTests = () => {
  memoryUid = null;
  memoryLangPref = null;
};
