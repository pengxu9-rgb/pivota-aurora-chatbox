import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
  priceLabel?: string | null;
  pricePosition?: string | null;
  roleLabel?: string | null;
  summary?: string | null;
  supportText?: string | null;
  chips?: string[];
  badgeLabel?: string | null;
  primary?: boolean;
  openLabel: string;
  openAriaLabel?: string | null;
  secondaryLabel?: string | null;
  secondaryAriaLabel?: string | null;
  openDisabled?: boolean;
  secondaryDisabled?: boolean;
  onOpen?: () => void;
  onSecondary?: () => void;
};

export function AuroraRecommendationProductCard({
  name,
  brand,
  imageUrl,
  priceLabel,
  pricePosition,
  roleLabel,
  summary,
  supportText,
  chips = [],
  badgeLabel,
  primary = false,
  openLabel,
  openAriaLabel,
  secondaryLabel,
  secondaryAriaLabel,
  openDisabled = false,
  secondaryDisabled = false,
  onOpen,
  onSecondary,
}: Props) {
  const canOpen = Boolean(onOpen) && !openDisabled;
  const canSecondary = Boolean(onSecondary) && Boolean(secondaryLabel) && !secondaryDisabled;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[26px] border bg-background/90 shadow-sm',
        primary ? 'border-orange-300/60 ring-1 ring-orange-200/60' : 'border-border/60',
      )}
    >
      <div className={cn('grid gap-4 p-4', primary ? 'md:grid-cols-[132px_minmax(0,1fr)]' : 'md:grid-cols-[104px_minmax(0,1fr)]')}>
        <div className={cn('relative overflow-hidden rounded-[22px] border', primary ? 'h-32 border-orange-200/70 bg-orange-50/70' : 'h-28 border-border/60 bg-muted/35')}>
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Sparkles className={cn('h-7 w-7', primary ? 'text-orange-500/70' : 'text-muted-foreground')} />
            </div>
          )}
          {badgeLabel ? (
            <div className="absolute left-3 top-3 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-background">
              {badgeLabel}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {roleLabel ? (
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {roleLabel}
                  </span>
                ) : null}
                {pricePosition ? (
                  <span className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {pricePosition}
                  </span>
                ) : null}
              </div>
              {brand ? <div className="text-xs font-medium text-muted-foreground">{brand}</div> : null}
              <div className={cn('text-foreground', primary ? 'text-xl font-semibold leading-tight' : 'text-base font-semibold leading-snug')}>
                {name}
              </div>
            </div>
            {priceLabel ? (
              <div className={cn('shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold', primary ? 'bg-orange-100 text-orange-700' : 'bg-muted text-foreground')}>
                {priceLabel}
              </div>
            ) : null}
          </div>

          {summary ? (
            <p className={cn('text-foreground/90', primary ? 'text-sm leading-6' : 'text-sm leading-5')}>
              {summary}
            </p>
          ) : null}
          {supportText ? (
            <p className="text-xs leading-5 text-muted-foreground">{supportText}</p>
          ) : null}

          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chips.slice(0, primary ? 4 : 3).map((chip) => (
                <span
                  key={chip}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                    primary ? 'border-orange-200/70 bg-orange-50/70 text-orange-800' : 'border-border/60 bg-muted/40 text-muted-foreground',
                  )}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className={cn('chip-button inline-flex items-center gap-1.5', primary ? 'chip-button-primary' : '')}
              aria-label={openAriaLabel || undefined}
              disabled={!canOpen}
              onClick={onOpen}
            >
              {openLabel}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            {secondaryLabel ? (
              <button
                type="button"
                className="chip-button chip-button-outline"
                aria-label={secondaryAriaLabel || undefined}
                disabled={!canSecondary}
                onClick={onSecondary}
              >
                {secondaryLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
