export type ChatHistoryItem = {
  brief_id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

const STORAGE_KEY = 'aurora_chat_history_v1';
const MAX_ITEMS = 20;

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

const normalizeTitle = (raw: string) => String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 64);

export const loadChatHistory = (): ChatHistoryItem[] => {
  const raw = safeStorageGet(STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeJsonParse<unknown>(raw);
  if (!Array.isArray(parsed)) return [];

  const items: ChatHistoryItem[] = [];
  for (const row of parsed) {
    const obj = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : null;
    if (!obj) continue;
    const briefId = typeof obj.brief_id === 'string' ? obj.brief_id.trim() : '';
    const title = typeof obj.title === 'string' ? normalizeTitle(obj.title) : '';
    const createdAt = typeof obj.created_at === 'number' ? obj.created_at : null;
    const updatedAt = typeof obj.updated_at === 'number' ? obj.updated_at : null;
    if (!briefId || !title || createdAt == null || updatedAt == null) continue;
    items.push({ brief_id: briefId.slice(0, 128), title, created_at: createdAt, updated_at: updatedAt });
  }

  return items.sort((a, b) => b.updated_at - a.updated_at).slice(0, MAX_ITEMS);
};

export const saveChatHistory = (items: ChatHistoryItem[]) => {
  const trimmed = Array.isArray(items) ? items.slice(0, MAX_ITEMS) : [];
  safeStorageSet(STORAGE_KEY, JSON.stringify(trimmed));
};

export const upsertChatHistoryItem = (args: { brief_id: string; title: string; touched_at?: number }) => {
  const briefId = String(args.brief_id || '').trim().slice(0, 128);
  const title = normalizeTitle(args.title);
  if (!briefId || !title) return;

  const now = typeof args.touched_at === 'number' && Number.isFinite(args.touched_at) ? args.touched_at : Date.now();
  const next = loadChatHistory();
  const idx = next.findIndex((it) => it.brief_id === briefId);

  if (idx >= 0) {
    const existing = next[idx];
    next[idx] = { ...existing, title, updated_at: now };
  } else {
    next.unshift({ brief_id: briefId, title, created_at: now, updated_at: now });
  }

  saveChatHistory(next);
};

export const deleteChatHistoryItem = (briefId: string) => {
  const id = String(briefId || '').trim();
  if (!id) return;
  const next = loadChatHistory().filter((it) => it.brief_id !== id);
  saveChatHistory(next);
};

