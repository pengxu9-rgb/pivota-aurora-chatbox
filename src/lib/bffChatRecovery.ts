// One completed anonymous conversation per tab, not a cross-account history store.
const KEY = 'aurora_bff_chat_recovery_v1';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BYTES = 1_000_000;

export type ChatRecovery<T> = {
  uid: string;
  briefId: string;
  traceId: string;
  items: T[];
  threadState: Record<string, unknown>;
  sessionState: string;
  agentState: string;
};

export function clearChatRecovery() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* Storage may be disabled. */ }
}

export function loadChatRecovery<T>(
  uid: string,
  briefId: string,
  isItem: (value: unknown) => value is T,
): ChatRecovery<T> | undefined {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return;
    if (raw.length > MAX_BYTES) { clearChatRecovery(); return; }
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Number.isFinite(value.savedAt) ||
        Date.now() - value.savedAt > TTL_MS || value.savedAt > Date.now() ||
        value.uid !== uid ||
        typeof value.briefId !== 'string' || !value.briefId || value.briefId.length > 128 ||
        typeof value.traceId !== 'string' || !value.traceId || value.traceId.length > 128 ||
        !Array.isArray(value.items) || value.items.length > 120 || !value.items.every(isItem) ||
        !value.threadState || typeof value.threadState !== 'object' || Array.isArray(value.threadState) ||
        typeof value.sessionState !== 'string' || typeof value.agentState !== 'string') {
      clearChatRecovery();
      return;
    }
    if (briefId && value.briefId !== briefId) return;
    return value;
  } catch { clearChatRecovery(); return; }
}

export function saveChatRecovery<T>(value: ChatRecovery<T>) {
  try {
    const raw = JSON.stringify({ ...value, items: value.items.slice(-120), version: 1, savedAt: Date.now() },
      (key, entry) => {
        if (/^(auth_token|access_token|refresh_token|password|authorization)$/i.test(key)) return undefined;
        if (typeof Blob !== 'undefined' && entry instanceof Blob) return undefined;
        if (typeof entry === 'string' && /^(blob:|data:)/i.test(entry)) return undefined;
        return entry;
      });
    if (raw.length > MAX_BYTES) { clearChatRecovery(); return; }
    window.sessionStorage.setItem(KEY, raw);
  } catch { clearChatRecovery(); }
}
