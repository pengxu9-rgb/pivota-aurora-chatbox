import type { Language, Message, Session } from './types';

const UID_KEY = 'pivota_aurora_uid_v1';
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

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeJsonParse = <T>(raw: string): T | undefined => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

export const getOrCreateAuroraUid = (): string => {
  if (!isBrowser()) return 'unknown';
  const existing = window.localStorage.getItem(UID_KEY);
  if (existing) return existing;

  const cryptoObj = globalThis.crypto as Crypto | undefined;
  const uid = (cryptoObj?.randomUUID?.() ?? `uid_${Date.now()}_${Math.random().toString(16).slice(2)}`).slice(0, 64);
  window.localStorage.setItem(UID_KEY, uid);
  return uid;
};

export const getAuroraUid = (): string | undefined => {
  if (!isBrowser()) return undefined;
  const uid = window.localStorage.getItem(UID_KEY);
  return uid || undefined;
};

const stripFiles = (_key: string, value: unknown) => {
  // Drop File/Blob to keep localStorage JSON-serializable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v: any = value;
  if (typeof File !== 'undefined' && v instanceof File) return undefined;
  if (typeof Blob !== 'undefined' && v instanceof Blob) return undefined;
  if (typeof FormData !== 'undefined' && v instanceof FormData) return undefined;
  return value;
};

export const loadPersistedChatState = (): PersistedChatState | undefined => {
  if (!isBrowser()) return undefined;
  const raw = window.localStorage.getItem(CHAT_KEY);
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
    window.localStorage.setItem(CHAT_KEY, JSON.stringify(payload, stripFiles));
  } catch {
    // Ignore quota / serialization errors.
  }
};

export const clearPersistedChatState = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(CHAT_KEY);
};
