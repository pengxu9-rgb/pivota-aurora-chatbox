export type PersistedShopState = {
  version: 1;
  saved_at: number;
  aurora_uid: string;
  cart: {
    item_count: number;
    updated_at: string | null;
    items: Array<{
      id: string;
      product_id?: string;
      variant_id?: string;
      sku?: string;
      merchant_id?: string;
      offer_id?: string;
      title: string;
      price: number;
      currency?: string;
      quantity: number;
      image_url?: string;
    }>;
  };
  recent_orders: Array<{
    order_id: string;
    occurred_at: string;
    seller_name?: string | null;
    seller_domain?: string | null;
  }>;
};

const VERSION = 1 as const;
const KEY_PREFIX = 'pivota_aurora_shop_state_v1';

let memoryState: PersistedShopState | null = null;

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

const keyForUid = (uid: string) => `${KEY_PREFIX}:${uid}`;

const isObject = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export const loadShopState = (auroraUid: string): PersistedShopState | undefined => {
  const uid = String(auroraUid || '').trim();
  if (!uid) return undefined;

  const raw = safeStorageGet(keyForUid(uid));
  if (!raw) {
    if (memoryState?.aurora_uid === uid) return memoryState;
    return undefined;
  }

  const parsed = safeJsonParse<Partial<PersistedShopState>>(raw);
  if (!parsed || parsed.version !== VERSION) return undefined;
  if (parsed.aurora_uid !== uid) return undefined;
  if (!parsed.cart || typeof parsed.cart.item_count !== 'number') return undefined;
  if (!Array.isArray(parsed.recent_orders)) return undefined;

  const cartItemsRaw = Array.isArray((parsed.cart as any).items) ? ((parsed.cart as any).items as unknown[]) : [];
  const cartItems = cartItemsRaw
    .map((it) => {
      if (!isObject(it)) return null;
      const id = String((it as any).id || '').trim();
      const title = String((it as any).title || '').trim();
      const price = Number((it as any).price);
      const quantity = Number((it as any).quantity);
      if (!id || !title) return null;
      if (!Number.isFinite(price)) return null;
      if (!Number.isFinite(quantity)) return null;
      return {
        id,
        product_id: String((it as any).product_id || '').trim() || undefined,
        variant_id: String((it as any).variant_id || '').trim() || undefined,
        sku: String((it as any).sku || '').trim() || undefined,
        merchant_id: String((it as any).merchant_id || '').trim() || undefined,
        offer_id: String((it as any).offer_id || '').trim() || undefined,
        title,
        price,
        currency: String((it as any).currency || '').trim() || undefined,
        quantity,
        image_url: String((it as any).image_url || '').trim() || undefined,
      };
    })
    .filter(Boolean) as PersistedShopState['cart']['items'];

  const normalized: PersistedShopState = {
    version: VERSION,
    saved_at: typeof parsed.saved_at === 'number' ? parsed.saved_at : Date.now(),
    aurora_uid: uid,
    cart: {
      item_count: Number(parsed.cart.item_count) || 0,
      updated_at: typeof parsed.cart.updated_at === 'string' ? parsed.cart.updated_at : null,
      items: cartItems.slice(0, 40),
    },
    recent_orders: parsed.recent_orders
      .map((o) => {
        if (!isObject(o)) return null;
        const order_id = String((o as any).order_id || '').trim();
        const occurred_at = String((o as any).occurred_at || '').trim();
        if (!order_id || !occurred_at) return null;
        return {
          order_id,
          occurred_at,
          seller_name: ((o as any).seller_name ?? null) as string | null,
          seller_domain: ((o as any).seller_domain ?? null) as string | null,
        };
      })
      .filter(Boolean) as PersistedShopState['recent_orders'],
  };

  memoryState = normalized;
  return normalized;
};

export const saveShopState = (state: Omit<PersistedShopState, 'version' | 'saved_at'>) => {
  const uid = String(state.aurora_uid || '').trim();
  if (!uid) return;

  const payload: PersistedShopState = {
    version: VERSION,
    saved_at: Date.now(),
    aurora_uid: uid,
    cart: {
      item_count: Number(state.cart?.item_count) || 0,
      updated_at: typeof state.cart?.updated_at === 'string' ? state.cart.updated_at : null,
      items: Array.isArray(state.cart?.items) ? state.cart.items.slice(0, 40) : [],
    },
    recent_orders: Array.isArray(state.recent_orders) ? state.recent_orders.slice(0, 20) : [],
  };

  memoryState = payload;

  try {
    safeStorageSet(keyForUid(uid), JSON.stringify(payload));
  } catch {
    // Ignore quota / serialization errors.
  }
};
