import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { X } from 'lucide-react';

export function ShopDrawer({
  open,
  url,
  title,
  epoch,
  onOpenChange,
  onIframe,
  language,
}: {
  open: boolean;
  url: string | null;
  title: string;
  epoch: number;
  onOpenChange: (open: boolean, epoch: number) => void;
  onIframe: (iframe: HTMLIFrameElement | null) => void;
  language: 'EN' | 'CN';
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeightPx, setContentHeightPx] = useState(0);
  const [snapPoint, setSnapPoint] = useState<number | string | null>(0.6);

  useEffect(() => {
    if (!open) {
      setSnapPoint(0.6);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setContentHeightPx(Math.max(0, Math.round(rect.height)));
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    window.addEventListener('resize', update);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, [open]);

  const bottomPad = useMemo(() => {
    const snap =
      typeof snapPoint === 'number'
        ? snapPoint
        : snapPoint != null
          ? Number(snapPoint)
          : NaN;
    if (!Number.isFinite(snap)) return '0px';
    if (snap >= 0.98) return '0px';

    const offscreen = Math.max(0, 1 - snap);
    const heightPx =
      contentHeightPx ||
      (() => {
        try {
          const vv = window.visualViewport;
          const h = vv && typeof vv.height === 'number' ? vv.height : window.innerHeight;
          return Math.max(0, Math.round(h));
        } catch {
          return 0;
        }
      })();
    if (heightPx > 0) return `${Math.round(offscreen * heightPx)}px`;

    const dvh = Math.round(offscreen * 1000) / 10;
    return `${dvh}dvh`;
  }, [contentHeightPx, snapPoint]);

  if (!open && !url) return null;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next, epoch);
        if (!next) {
          onIframe(null);
        }
      }}
      snapPoints={[0.6, 1]}
      activeSnapPoint={snapPoint}
      setActiveSnapPoint={setSnapPoint}
      fadeFromIndex={0}
    >
      <DrawerContent
        ref={contentRef}
        className="mt-0 h-[100dvh] max-h-[100dvh] flex flex-col rounded-t-3xl border border-border/50 bg-card/95 backdrop-blur-xl"
        style={{ paddingBottom: bottomPad }}
      >
        <DrawerTitle className="sr-only">{title || (language === 'CN' ? '购物' : 'Shopping')}</DrawerTitle>
        <DrawerDescription className="sr-only">
          {language === 'CN' ? '商品详情抽屉' : 'Product details drawer'}
        </DrawerDescription>
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-2">
          <div className="text-sm font-semibold text-foreground">{title || (language === 'CN' ? '购物' : 'Shopping')}</div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-foreground/80"
            aria-label={language === 'CN' ? '关闭' : 'Close'}
            onClick={() => {
              onOpenChange(false, epoch);
              onIframe(null);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {url ? (
          <div className="flex-1 overflow-hidden rounded-t-2xl border-t border-border/50 bg-background">
            <iframe
              ref={onIframe}
              key={url}
              src={url}
              title={title || (language === 'CN' ? '购物' : 'Shopping')}
              className="h-full w-full"
              data-vaul-no-drag
            />
          </div>
        ) : (
          <div className="flex-1 px-4 py-6 text-sm text-muted-foreground">{language === 'CN' ? '加载中…' : 'Loading…'}</div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
