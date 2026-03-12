import React, { useMemo } from 'react';
import { ShoppingCart, X } from 'lucide-react';

import { Drawer, DrawerClose, DrawerContent } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useShop } from '@/contexts/shop';
import { useLanguage } from '@/contexts/LanguageContext';

function formatMoney(value: number, currency?: string) {
  if (!Number.isFinite(value)) return '—';
  const curr = String(currency || '').trim().toUpperCase() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: curr, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatUpdatedAt(value: string | null) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toLocaleString();
  } catch {
    return null;
  }
}

export function AuroraCartPreviewDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const shop = useShop();
  const { language, t } = useLanguage();
  const items = useMemo(() => shop.cart?.items ?? [], [shop.cart?.items]);
  const itemCount = Math.max(0, Number(shop.cart?.item_count) || 0);

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    const currency = items.find((it) => it.currency)?.currency || undefined;
    return { subtotal, currency };
  }, [items]);

  const updatedAt = useMemo(() => formatUpdatedAt(shop.cart?.updated_at ?? null), [shop.cart?.updated_at]);

  const onCheckout = () => {
    const orderItems = items.map((it) => ({
      product_id: it.product_id || it.id,
      variant_id: it.variant_id || it.product_id || it.id,
      sku: it.sku,
      merchant_id: it.merchant_id,
      offer_id: it.offer_id,
      title: it.title,
      quantity: Math.max(1, Number(it.quantity) || 1),
      unit_price: Number(it.price) || 0,
      currency: it.currency,
      image_url: it.image_url,
    }));
    if (!orderItems.length) return;
    const sp = new URLSearchParams();
    sp.set('items', JSON.stringify(orderItems));
    if (typeof window !== 'undefined') {
      sp.set('return', window.location.href);
    }
    onOpenChange(false);
    shop.openShop({
      url: `/order?${sp.toString()}`,
      title: t('s6.btn.checkout'),
    });
  };

  const onEditCart = () => {
    onOpenChange(false);
    shop.openCart();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapPoints={[0.6, 1]} fadeFromIndex={0}>
      <DrawerContent className="mt-0 h-[100dvh] max-h-[100dvh] rounded-t-3xl border border-border/50 bg-card/95 backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold text-foreground">{t('shop.cart_title')}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {itemCount
                    ? t('shop.item_count', { n: itemCount })
                    : t('shop.empty_short')}
                  {updatedAt ? <span className="ml-2 hidden sm:inline">{'\u00B7'} {updatedAt}</span> : null}
                </div>
              </div>
            </div>

            <DrawerClose asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-foreground/80"
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </DrawerClose>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {items.length ? (
              <div className="space-y-3">
                {items.slice(0, 20).map((it) => {
                  const title = String(it.title || '').trim() || t('shop.item');
                  const qty = Math.max(1, Number(it.quantity) || 1);
                  const line = (Number(it.price) || 0) * qty;
                  const canOpenPdp = Boolean(String(it.product_id || '').trim());
                  return (
                    <div key={it.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 shadow-sm">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="relative h-12 w-12 flex-none overflow-hidden rounded-xl border border-border/50 bg-muted/30">
                          {it.image_url ? (
                            <img src={it.image_url} alt={title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">{title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="whitespace-nowrap">
                              {t('shop.qty', { n: qty })}
                            </span>
                            <span className="whitespace-nowrap">{formatMoney(line, it.currency)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-none flex-col items-end gap-2">
                        <button
                          type="button"
                          className={cn('chip-button', !canOpenPdp ? 'opacity-60' : '')}
                          disabled={!canOpenPdp}
                          onClick={() => {
                            if (!it.product_id) return;
                            shop.openPdp({ target: { product_id: it.product_id, merchant_id: it.merchant_id ?? null }, title });
                            onOpenChange(false);
                          }}
                        >
                          {t('shop.view')}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {items.length > 20 ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    {t('shop.showing_first_20')}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-border/60 bg-muted/20 p-6 text-center">
                <div className="text-sm font-semibold text-foreground">{t('shop.empty_cart')}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t('shop.empty_cart_desc')}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-background/60 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('shop.subtotal')}</span>
              <span className="font-semibold text-foreground">{formatMoney(totals.subtotal, totals.currency)}</span>
            </div>

            <button
              type="button"
              className={cn(
                'mt-3 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-card',
                'active:scale-[0.99]',
                !itemCount ? 'opacity-60' : '',
              )}
              disabled={!itemCount}
              onClick={onCheckout}
            >
              {t('shop.checkout_now')}
            </button>

            <button
              type="button"
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-sm font-semibold text-foreground/80"
              onClick={onEditCart}
              disabled={!itemCount}
            >
              {t('shop.edit_cart')}
            </button>

            <button
              type="button"
              className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-border/60 bg-muted/40 text-sm font-semibold text-foreground/80"
              onClick={() => onOpenChange(false)}
            >
              {t('shop.keep_chatting')}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
