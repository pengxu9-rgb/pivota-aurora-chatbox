import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getOrCreateAuroraUid, getLangPref } from '@/lib/persistence';
import { getPivotaShopBaseUrl, buildPdpUrl, type PdpTarget } from '@/lib/pivotaShop';
import { buildAuroraOpenCartMessage, isShopBridgeMessage, type ShopBridgeMessage, type ShopCartSnapshot, type ShopOrderSuccessPayload } from '@/lib/shopBridge';
import { loadShopState, saveShopState, type PersistedShopState } from '@/lib/shopPersistence';
import { ShopDrawer } from '@/components/shop/ShopDrawer';

export type ShopCartSummary = PersistedShopState['cart'];
export type ShopOrderSummary = PersistedShopState['recent_orders'][number];

type ShopContextValue = {
  aurora_uid: string;
  cart: ShopCartSummary;
  recent_orders: ShopOrderSummary[];
  shop_open: boolean;
  openShop: (args: { url: string; title?: string }) => void;
  openPdp: (args: { target: PdpTarget; title?: string }) => void;
  openCart: () => void;
  openOrders: () => void;
  closeShop: () => void;
  sendToShop: (msg: unknown) => boolean;
};

const ShopContext = createContext<ShopContextValue | null>(null);

const safeParseUrl = (input: string): URL | null => {
  try {
    return new URL(input);
  } catch {
    return null;
  }
};

const normalizeShopUrl = (args: { url: string; shopBaseUrl: string; auroraUid: string; lang: 'en' | 'cn' }): string | null => {
  const raw = String(args.url || '').trim();
  if (!raw) return null;
  const shopBase = String(args.shopBaseUrl || '').trim();
  const baseUrl = safeParseUrl(shopBase);
  if (!baseUrl) return null;

  const u = safeParseUrl(raw) ?? safeParseUrl(new URL(raw, shopBase).toString());
  if (!u) return null;
  if (u.origin !== baseUrl.origin) return null;

  // Embed markers (do not rely on them for security; bridge uses origin checks).
  if (!u.searchParams.get('entry')) u.searchParams.set('entry', 'aurora_chatbox');
  if (!u.searchParams.get('embed')) u.searchParams.set('embed', '1');
  if (!u.searchParams.get('lang')) u.searchParams.set('lang', args.lang);
  if (!u.searchParams.get('aurora_uid')) u.searchParams.set('aurora_uid', args.auroraUid);

  return u.toString();
};

const blankState = (uid: string): PersistedShopState => ({
  version: 1,
  saved_at: Date.now(),
  aurora_uid: uid,
  cart: { item_count: 0, updated_at: null },
  recent_orders: [],
});

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const auroraUid = useMemo(() => getOrCreateAuroraUid(), []);
  const shopBaseUrl = useMemo(() => getPivotaShopBaseUrl(), []);
  const shopOrigin = useMemo(() => safeParseUrl(shopBaseUrl)?.origin ?? null, [shopBaseUrl]);
  const [langPref, setLangPrefState] = useState(() => getLangPref());

  useEffect(() => {
    const onLang = (evt: Event) => {
      const next = (evt as CustomEvent).detail;
      if (next === 'en' || next === 'cn') setLangPrefState(next);
    };
    window.addEventListener('aurora_lang_pref_changed', onLang as EventListener);
    return () => window.removeEventListener('aurora_lang_pref_changed', onLang as EventListener);
  }, []);

  const [persisted, setPersisted] = useState<PersistedShopState>(() => loadShopState(auroraUid) ?? blankState(auroraUid));
  const [shopOpen, setShopOpen] = useState(false);
  const [shopUrl, setShopUrl] = useState<string | null>(null);
  const [shopTitle, setShopTitle] = useState('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const handleIframeRef = useCallback((iframe: HTMLIFrameElement | null) => {
    iframeRef.current = iframe;
  }, []);

  const persist = useCallback(
    (next: PersistedShopState) => {
      setPersisted(next);
      saveShopState({
        aurora_uid: next.aurora_uid,
        cart: next.cart,
        recent_orders: next.recent_orders,
      });
    },
    [],
  );

  const openShop = useCallback(
    (args: { url: string; title?: string }) => {
      const normalized = normalizeShopUrl({
        url: args.url,
        shopBaseUrl,
        auroraUid,
        lang: langPref,
      });
      if (!normalized) return;
      setShopUrl(normalized);
      setShopTitle(String(args.title || '').trim());
      setShopOpen(true);
    },
    [auroraUid, langPref, shopBaseUrl],
  );

  const closeShop = useCallback(() => {
    setShopOpen(false);
    setShopUrl(null);
    setShopTitle('');
  }, []);

  const sendToShop = useCallback((msg: unknown): boolean => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return false;
    if (!shopOrigin) return false;
    try {
      win.postMessage(msg, shopOrigin);
      return true;
    } catch {
      return false;
    }
  }, [shopOrigin]);

  const openCart = useCallback(() => {
    const sent = shopOpen ? sendToShop(buildAuroraOpenCartMessage()) : false;
    if (sent) return;
    openShop({ url: `${shopBaseUrl}/?open=cart`, title: langPref === 'cn' ? '购物车' : 'Cart' });
  }, [langPref, openShop, sendToShop, shopBaseUrl, shopOpen]);

  const openOrders = useCallback(() => {
    openShop({ url: `${shopBaseUrl}/orders`, title: langPref === 'cn' ? '订单' : 'Orders' });
  }, [langPref, openShop, shopBaseUrl]);

  const openPdp = useCallback(
    (args: { target: PdpTarget; title?: string }) => {
      const url = buildPdpUrl({ product_id: args.target.product_id, merchant_id: args.target.merchant_id, baseUrl: shopBaseUrl });
      openShop({ url, title: args.title });
    },
    [openShop, shopBaseUrl],
  );

  const applyCartSnapshot = useCallback(
    (snap: ShopCartSnapshot) => {
      const next: PersistedShopState = {
        ...persisted,
        cart: {
          item_count: Math.max(0, Number(snap.item_count) || 0),
          updated_at: String(snap.updated_at || '').trim() || new Date().toISOString(),
        },
      };
      persist(next);
    },
    [persist, persisted],
  );

  const applyOrderSuccess = useCallback(
    (payload: ShopOrderSuccessPayload) => {
      const order_id = String(payload.order_id || '').trim();
      if (!order_id) return;
      const occurred_at = String(payload.occurred_at || '').trim() || new Date().toISOString();

      const nextOrders: PersistedShopState['recent_orders'] = [
        {
          order_id,
          occurred_at,
          seller_name: payload.seller_name ?? null,
          seller_domain: payload.seller_domain ?? null,
        },
        ...persisted.recent_orders.filter((o) => o.order_id !== order_id),
      ].slice(0, 20);

      persist({
        ...persisted,
        recent_orders: nextOrders,
      });
    },
    [persist, persisted],
  );

  useEffect(() => {
    if (!shopOrigin) return;
    const onMessage = (evt: MessageEvent) => {
      if (evt.origin !== shopOrigin) return;
      if (evt.source !== iframeRef.current?.contentWindow) return;
      const data = evt.data;
      if (!isShopBridgeMessage(data)) return;
      const msg = data as ShopBridgeMessage;

      if (msg.event === 'cart_snapshot') {
        applyCartSnapshot(msg.payload);
      }
      if (msg.event === 'order_success') {
        applyOrderSuccess(msg.payload);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [applyCartSnapshot, applyOrderSuccess, shopOrigin]);

  const value = useMemo<ShopContextValue>(
    () => ({
      aurora_uid: auroraUid,
      cart: persisted.cart,
      recent_orders: persisted.recent_orders,
      shop_open: shopOpen,
      openShop,
      openPdp,
      openCart,
      openOrders,
      closeShop,
      sendToShop,
    }),
    [auroraUid, closeShop, openCart, openOrders, openPdp, openShop, persisted.cart, persisted.recent_orders, sendToShop, shopOpen],
  );

  return (
    <ShopContext.Provider value={value}>
      {children}
      <ShopDrawer
        open={shopOpen}
        url={shopUrl}
        title={shopTitle}
        onOpenChange={(next) => {
          if (!next) closeShop();
          else setShopOpen(true);
        }}
        onIframe={handleIframeRef}
        language={langPref === 'cn' ? 'CN' : 'EN'}
      />
    </ShopContext.Provider>
  );
}

export const useShop = (): ShopContextValue => {
  const ctx = React.useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within <ShopProvider>');
  return ctx;
};
