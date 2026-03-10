import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  isComparableProductLike,
  looksLikeSelfRef,
  readComparableIdentity,
  type ProductLike as GuardProductLike,
} from '@/lib/dupeCompareGuards';
import type { Language } from '@/lib/types';
import { cn } from '@/lib/utils';

type ProductLike = GuardProductLike;

type AlternativeLike = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function uniqueStrings(values: unknown, max = 3): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const s = asString(raw);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function productLabel(product: ProductLike): { brand: string; name: string } {
  const identity = readComparableIdentity(product);
  return { brand: identity.brand || '', name: identity.name || '' };
}

function compareUnavailableReason(original: ProductLike, dupe: ProductLike, language: Language): string {
  if (!isComparableProductLike(original)) {
    return language === 'CN' ? '目标商品信息不足，暂时无法对比' : 'Need a clearer target product';
  }
  if (!isComparableProductLike(dupe)) {
    return language === 'CN' ? '候选商品信息不足，暂时无法对比' : 'Candidate details are incomplete';
  }
  if (looksLikeSelfRef(original, dupe)) {
    return language === 'CN' ? '这是同一款商品，无法对比' : 'This is the same product';
  }
  return '';
}

function kindBadge(kindRaw: unknown, language: Language): { label: string; tone: 'default' | 'secondary' } {
  const k = asString(kindRaw).toLowerCase();
  if (k === 'dupe') return { label: language === 'CN' ? '平替' : 'Dupe', tone: 'default' };
  if (k === 'premium') return { label: language === 'CN' ? '升级' : 'Premium', tone: 'secondary' };
  return { label: language === 'CN' ? '同类' : 'Comparable', tone: 'secondary' };
}

function SimilarityBadge({ value }: { value: unknown }) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  const pct = Math.max(0, Math.min(100, Math.round(num)));
  return (
    <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
      {pct}%
    </Badge>
  );
}

function AlternativeRow({
  item,
  original,
  language,
  onCompare,
}: {
  item: AlternativeLike;
  original: ProductLike;
  language: Language;
  onCompare?: (args: { original: ProductLike; dupe: ProductLike }) => void;
}) {
  const product = (item && typeof item === 'object' ? (item.product as any) : null) as ProductLike;
  const { brand, name } = productLabel(product);
  const { label: kindLabel, tone } = kindBadge((item as any).kind, language);
  const unavailableReason = onCompare ? compareUnavailableReason(original, product, language) : '';

  const reasons = uniqueStrings((item as any).reasons, 2);
  const tradeoffs = uniqueStrings((item as any).tradeoffs, 1);

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 shadow-card">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tone === 'default' ? 'default' : 'secondary'} className="rounded-full text-[10px] font-semibold">
            {kindLabel}
          </Badge>
          <SimilarityBadge value={(item as any).similarity} />
        </div>
        <div className="min-w-0">
          {brand ? <div className="text-[11px] font-semibold text-muted-foreground truncate">{brand}</div> : null}
          <div className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {name || (language === 'CN' ? '未知商品' : 'Unknown product')}
          </div>
        </div>
        {reasons.length ? (
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {tradeoffs.length ? <li key={tradeoffs[0]}>{tradeoffs[0]}</li> : null}
          </ul>
        ) : tradeoffs.length ? (
          <div className="text-xs text-muted-foreground">{tradeoffs[0]}</div>
        ) : null}
      </div>

      {onCompare ? (
        <div className="shrink-0 space-y-1 text-right">
          <Button
            type="button"
            variant="secondary"
            className="h-9 rounded-xl px-3 text-xs font-semibold"
            disabled={Boolean(unavailableReason)}
            onClick={() => {
              if (unavailableReason) return;
              onCompare({ original, dupe: product });
            }}
          >
            {language === 'CN' ? '对比' : 'Compare'}
          </Button>
          {unavailableReason ? (
            <div className="max-w-28 text-[11px] leading-tight text-muted-foreground">
              {unavailableReason}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DupeSuggestCard({
  className,
  original,
  dupes,
  comparables,
  language,
  anchorResolutionStatus,
  quality,
  onCompare,
}: {
  className?: string;
  original: ProductLike;
  dupes: AlternativeLike[];
  comparables: AlternativeLike[];
  language: Language;
  anchorResolutionStatus?: string;
  quality?: Record<string, unknown>;
  onCompare?: (args: { original: ProductLike; dupe: ProductLike }) => void;
}) {
  const { brand, name } = productLabel(original);
  const title =
    language === 'CN'
      ? `平替与对标：${[brand, name].filter(Boolean).join(' ') || '目标商品'}`
      : `Dupes + comparables: ${[brand, name].filter(Boolean).join(' ') || 'target product'}`;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
        <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? 'Find Dupes' : 'Find Dupes'}</div>
        <div className="mt-1 text-sm font-semibold text-foreground">{title}</div>
        {(anchorResolutionStatus === 'failed' || (original && typeof original === 'object' && (original as any)._stub)) ? (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800">
            {language === 'CN'
              ? '未能完全解析目标商品信息，结果可能不够精准。请尝试提供更具体的商品名称或链接。'
              : 'Could not fully resolve the target product. Results may be less precise. Try a more specific product name or link.'}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '更便宜平替' : 'Cheaper dupes'}</div>
          <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
            {dupes.length}
          </Badge>
        </div>
        {dupes.length ? (
          <div className="space-y-2">
            {dupes.map((it, idx) => (
              <AlternativeRow
                key={`${asString((it as any)?.product?.sku_id || (it as any)?.product?.product_id || idx)}`}
                item={it}
                original={original}
                language={language}
                onCompare={onCompare}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            {language === 'CN' ? '暂时没有找到合适的平替。你可以换一个更具体的商品名或链接。' : 'No dupes yet. Try a more specific product name or link.'}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '同类对标 / 升级' : 'Comparables / premium'}</div>
          <Badge variant="outline" className="rounded-full text-[10px] font-semibold">
            {comparables.length}
          </Badge>
        </div>
        {comparables.length ? (
          <div className="space-y-2">
            {comparables.map((it, idx) => (
              <AlternativeRow
                key={`${asString((it as any)?.product?.sku_id || (it as any)?.product?.product_id || idx)}`}
                item={it}
                original={original}
                language={language}
                onCompare={onCompare}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            {language === 'CN' ? '暂时没有找到同类对标。' : 'No comparables yet.'}
          </div>
        )}
      </div>
    </div>
  );
}
