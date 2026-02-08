import type { Language, Message, Session } from './types';

const UID_KEY = 'aurora_uid';
const LEGACY_UID_KEY = 'pivota_aurora_uid_v1';
const LANG_PREF_KEY = 'lang_pref';
const LEGACY_LANG_PREF_KEY = 'pivota_aurora_lang_pref_v1';
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

export type LangPref = 'en' | 'cn';

let memoryUid: string | null = null;
let memoryLangPref: LangPref | null = null;

const isBrowser = () => typeof window !== 'undefined';

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

const safeJsonParse = <T>(raw: string): T | undefined => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
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
  const stored = safeStorageGet(LANG_PREF_KEY);
  if (stored === 'en' || stored === 'cn') return stored;

  const legacy = safeStorageGet(LEGACY_LANG_PREF_KEY);
  if (legacy === 'en' || legacy === 'cn') {
    safeStorageSet(LANG_PREF_KEY, legacy);
    return legacy;
  }
  if (legacy === 'EN') {
    safeStorageSet(LANG_PREF_KEY, 'en');
    return 'en';
  }
  if (legacy === 'CN') {
    safeStorageSet(LANG_PREF_KEY, 'cn');
    return 'cn';
  }
  if (memoryLangPref) return memoryLangPref;
  return 'en';
};

export const setLangPref = (lang: LangPref) => {
  memoryLangPref = lang;
  const stored = safeStorageSet(LANG_PREF_KEY, lang);
  if (stored) {
    // Best-effort: keep legacy key for older builds.
    safeStorageSet(LEGACY_LANG_PREF_KEY, lang === 'cn' ? 'CN' : 'EN');
  }
  if (isBrowser()) {
    try {
      window.dispatchEvent(new CustomEvent('aurora_lang_pref_changed', { detail: lang }));
    } catch {
      // ignore
    }
  }
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
