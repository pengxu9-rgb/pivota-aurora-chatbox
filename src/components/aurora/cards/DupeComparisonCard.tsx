import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type DupeProduct = {
  imageUrl?: string;
  brand: string;
  name: string;
  price?: number;
  currency?: string;
};

export interface DupeComparisonCardProps {
  className?: string;
  original: DupeProduct;
  dupe: DupeProduct;
  savingsLabel?: string; // e.g. "Save $250"
  similarity?: number; // 0-100
  missingActives?: string[];
  addedBenefits?: string[];
  selected?: 'original' | 'dupe';
  labels?: Partial<{
    similarity: string;
    tradeoffsTitle: string;
    missingActives: string;
    addedBenefits: string;
    switchToDupe: string;
    keepOriginal: string;
  }>;
  onSwitchToDupe?: () => void;
  onKeepOriginal?: () => void;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatPrice(price: number | undefined, currency: string | undefined) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return 'Price unknown';
  const curr = currency?.trim() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `$${price.toFixed(0)}`;
  }
}

function ProductCol({ product, selected }: { product: DupeProduct; selected?: boolean }) {
  return (
    <div className={cn('space-y-2 rounded-xl p-2', selected ? 'ring-1 ring-primary/40 bg-primary/5' : 'bg-transparent')}>
      <div className="flex gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-lg border border-border/60 bg-muted/30 flex-shrink-0">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground truncate">{product.brand}</div>
          <div className="font-semibold text-foreground leading-snug line-clamp-2">{product.name}</div>
        </div>
      </div>
      <div className="text-lg font-semibold text-foreground">{formatPrice(product.price, product.currency)}</div>
    </div>
  );
}

export function DupeComparisonCard({
  className,
  original,
  dupe,
  savingsLabel = 'Save',
  similarity,
  missingActives = [],
  addedBenefits = [],
  selected,
  labels,
  onSwitchToDupe,
  onKeepOriginal,
}: DupeComparisonCardProps) {
  const similarityPct = typeof similarity === 'number' && Number.isFinite(similarity) ? clampPercent(similarity) : undefined;
  const copy = {
    similarity: labels?.similarity ?? 'Similarity',
    tradeoffsTitle: labels?.tradeoffsTitle ?? 'Trade-offs Analysis',
    missingActives: labels?.missingActives ?? 'Missing Actives',
    addedBenefits: labels?.addedBenefits ?? 'Added Benefits',
    switchToDupe: labels?.switchToDupe ?? 'Switch to Dupe',
    keepOriginal: labels?.keepOriginal ?? 'Keep Original',
  };

  const similarityIndicatorClassName = useMemo(() => {
    if (typeof similarityPct !== 'number') return 'bg-muted-foreground/30';
    if (similarityPct > 90) return 'bg-emerald-500';
    if (similarityPct >= 70) return 'bg-amber-500';
    return 'bg-rose-500';
  }, [similarityPct]);

  return (
    <Card className={cn('w-full bg-white/90 backdrop-blur-sm border-border/70 shadow-card', className)}>
      <CardContent className="p-4 space-y-4">
        <div className="relative">
          <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-start">
            <ProductCol product={original} selected={selected === 'original'} />
            <Separator orientation="vertical" className="self-stretch" />
            <ProductCol product={dupe} selected={selected === 'dupe'} />
          </div>

          <Badge className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-semibold bg-foreground text-background shadow-sm">
            {savingsLabel}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{copy.similarity}</span>
            <span className="font-semibold text-foreground">{typeof similarityPct === 'number' ? `${similarityPct}%` : '—'}</span>
          </div>
          <Progress value={similarityPct ?? 0} className="h-2" indicatorClassName={similarityIndicatorClassName} />
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="tradeoffs" className="border-border/60">
            <AccordionTrigger className="text-sm font-semibold">{copy.tradeoffsTitle}</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{copy.missingActives}</div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(missingActives.length ? missingActives : ['—']).map((item) => (
                      <li key={item} className="text-rose-500">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{copy.addedBenefits}</div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(addedBenefits.length ? addedBenefits : ['—']).map((item) => (
                      <li key={item} className="text-emerald-600">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={onSwitchToDupe}>
            {copy.switchToDupe}
          </Button>
          <Button variant="ghost" className="flex-1" onClick={onKeepOriginal}>
            {copy.keepOriginal}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
