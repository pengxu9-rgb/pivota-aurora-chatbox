import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type IngredientContext = {
  head?: string[];
  hero_actives?: unknown;
  highlights?: string[];
};

type SocialStats = {
  platform_scores?: Record<string, number>;
  RED_score?: number;
  Reddit_score?: number;
  burn_rate?: number;
  key_phrases?: Partial<Record<string, string[]>>;
};

type EvidencePack = {
  keyActives?: string[];
  textureFinish?: string[];
  sensitivityFlags?: string[];
  pairingRules?: string[];
  comparisonNotes?: string[];
  citations?: string[];
};

type DupeProduct = {
  imageUrl?: string;
  brand: string;
  name: string;
  price?: number;
  currency?: string;
  mechanism?: Record<string, number>;
  experience?: Record<string, any>;
  risk_flags?: string[];
  social_stats?: SocialStats;
  key_actives?: string[];
  evidence_pack?: EvidencePack;
  ingredients?: IngredientContext;
};

export interface DupeComparisonCardProps {
  className?: string;
  original: DupeProduct;
  dupe: DupeProduct;
  savingsLabel?: string; // e.g. "Save $250"
  similarity?: number; // 0-100
  tradeoffNote?: string;
  missingActives?: string[];
  addedBenefits?: string[];
  selected?: 'original' | 'dupe';
  labels?: Partial<{
    similarity: string;
    tradeoffsTitle: string;
    evidenceTitle: string;
    scienceLabel: string;
    socialLabel: string;
    keyActives: string;
    riskFlags: string;
    ingredientHighlights: string;
    citations: string;
    tradeoffNote: string;
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

function isInternalKbCitationId(raw: string): boolean {
  const v = String(raw || '').trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower.startsWith('kb:')) return true;
  if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)) return true;
  return false;
}

function normalizePercentFrom01(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  // Support either 0-1 or 0-100 inputs.
  const scaled = value > 1 ? value : value * 100;
  return clampPercent(scaled);
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

const MECHANISM_LABELS: Record<string, string> = {
  oil_control: 'Oil control',
  soothing: 'Soothing',
  repair: 'Barrier repair',
  redness: 'Redness',
  acne_comedonal: 'Acne control',
  brightening: 'Brightening',
  anti_aging: 'Anti-aging',
  hydrating: 'Hydration',
};

function topMechanisms(mechanism: Record<string, number> | undefined, limit = 2) {
  if (!mechanism) return [];
  const entries = Object.entries(mechanism)
    .map(([key, raw]) => ({ key, label: MECHANISM_LABELS[key] ?? key, pct: normalizePercentFrom01(raw) }))
    .filter((e) => typeof e.pct === 'number')
    .sort((a, b) => (b.pct as number) - (a.pct as number));
  return entries.slice(0, limit) as Array<{ key: string; label: string; pct: number }>;
}

function uniqueStrings(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const v = String(raw ?? '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function extractKeyActives(product: DupeProduct) {
  const direct = uniqueStrings(product.key_actives);
  if (direct.length) return direct;
  return uniqueStrings(product.evidence_pack?.keyActives);
}

function extractRiskFlags(product: DupeProduct) {
  const a = uniqueStrings(product.risk_flags);
  const b = uniqueStrings(product.evidence_pack?.sensitivityFlags);
  const merged = [...a, ...b];
  return uniqueStrings(merged);
}

function extractIngredientHighlights(product: DupeProduct) {
  const highlights = uniqueStrings(product.ingredients?.highlights);
  if (highlights.length) return highlights.slice(0, 3);

  const hero = product.ingredients?.hero_actives;
  if (Array.isArray(hero)) {
    const names = hero
      .map((h) => (h && typeof h === 'object' && 'name' in h ? String((h as any).name ?? '') : String(h ?? '')))
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length) return uniqueStrings(names).slice(0, 3);
  }
  return [];
}

function socialSnapshot(product: DupeProduct) {
  const ss = product.social_stats;
  if (!ss) return null;

  const red = normalizePercentFrom01(ss.RED_score ?? ss.platform_scores?.RED);
  const reddit = normalizePercentFrom01(ss.Reddit_score ?? ss.platform_scores?.Reddit);
  const burn = normalizePercentFrom01(ss.burn_rate);

  const phrases = uniqueStrings(ss.key_phrases?.RED ?? ss.key_phrases?.Reddit).slice(0, 4);

  return { red, reddit, burn, phrases };
}

function ProductCol({ product, selected }: { product: DupeProduct; selected?: boolean }) {
  const tops = topMechanisms(product.mechanism, 2);

  return (
    <div
      className={cn(
        'min-w-0 space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3',
        selected ? 'ring-1 ring-primary/40 bg-primary/5' : '',
      )}
    >
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

      {tops.length ? (
        <div className="flex flex-wrap gap-1">
          {tops.map((m) => (
            <Badge key={m.key} variant="secondary" className="rounded-full text-[10px] font-semibold">
              {m.label} {m.pct}%
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DupeComparisonCard({
  className,
  original,
  dupe,
  savingsLabel = 'Save',
  similarity,
  tradeoffNote,
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
    evidenceTitle: labels?.evidenceTitle ?? 'Evidence & Signals',
    scienceLabel: labels?.scienceLabel ?? 'Science',
    socialLabel: labels?.socialLabel ?? 'Social',
    keyActives: labels?.keyActives ?? 'Key actives',
    riskFlags: labels?.riskFlags ?? 'Risks',
    ingredientHighlights: labels?.ingredientHighlights ?? 'Ingredient highlights',
    citations: labels?.citations ?? 'Citations',
    tradeoffNote: labels?.tradeoffNote ?? 'Trade-off',
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

  const originalActives = useMemo(() => extractKeyActives(original).slice(0, 6), [original]);
  const dupeActives = useMemo(() => extractKeyActives(dupe).slice(0, 6), [dupe]);
  const originalRisks = useMemo(() => extractRiskFlags(original).slice(0, 8), [original]);
  const dupeRisks = useMemo(() => extractRiskFlags(dupe).slice(0, 8), [dupe]);
  const originalHighlights = useMemo(() => extractIngredientHighlights(original), [original]);
  const dupeHighlights = useMemo(() => extractIngredientHighlights(dupe), [dupe]);
  const originalSocial = useMemo(() => socialSnapshot(original), [original]);
  const dupeSocial = useMemo(() => socialSnapshot(dupe), [dupe]);
  const originalCitations = useMemo(
    () => uniqueStrings(original.evidence_pack?.citations).filter((c) => !isInternalKbCitationId(c)).slice(0, 4),
    [original],
  );
  const dupeCitations = useMemo(
    () => uniqueStrings(dupe.evidence_pack?.citations).filter((c) => !isInternalKbCitationId(c)).slice(0, 4),
    [dupe],
  );

  return (
    <Card className={cn('w-full bg-white/90 backdrop-blur-sm border-border/70 shadow-card', className)}>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr),auto,minmax(0,1fr)] gap-3 items-start">
          <ProductCol product={original} selected={selected === 'original'} />
          <Separator orientation="vertical" className="self-stretch" />
          <ProductCol product={dupe} selected={selected === 'dupe'} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{copy.similarity}</span>
            <div className="flex items-center gap-2">
              {savingsLabel && savingsLabel.trim() && savingsLabel !== 'Save' && savingsLabel !== '省钱' ? (
                <Badge variant="secondary" className="rounded-full text-[10px] font-semibold">
                  {savingsLabel}
                </Badge>
              ) : null}
              <span className="font-semibold text-foreground">{typeof similarityPct === 'number' ? `${similarityPct}%` : '—'}</span>
            </div>
          </div>
          <Progress value={similarityPct ?? 0} className="h-2" indicatorClassName={similarityIndicatorClassName} />
        </div>

        {tradeoffNote && tradeoffNote.trim() ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{copy.tradeoffNote}:</span> {tradeoffNote.trim()}
          </div>
        ) : null}

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

          <AccordionItem value="evidence" className="border-border/60">
            <AccordionTrigger className="text-sm font-semibold">{copy.evidenceTitle}</AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { title: original.brand, product: original, actives: originalActives, risks: originalRisks, highlights: originalHighlights, social: originalSocial, citations: originalCitations },
                  { title: dupe.brand, product: dupe, actives: dupeActives, risks: dupeRisks, highlights: dupeHighlights, social: dupeSocial, citations: dupeCitations },
                ].map((col) => (
                  <div key={col.title} className="rounded-xl border border-border/70 bg-muted/10 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.product.brand}</div>
                    <div className="mt-0.5 text-sm font-semibold text-foreground line-clamp-2">{col.product.name}</div>

                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.scienceLabel}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {topMechanisms(col.product.mechanism, 3).map((m) => (
                            <Badge key={m.key} variant="secondary" className="rounded-full text-[10px] font-semibold">
                              {m.label} {m.pct}%
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.keyActives}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(col.actives.length ? col.actives : ['—']).map((a) => (
                            <Badge key={a} variant="secondary" className="rounded-full text-[10px]">
                              {a}
                            </Badge>
                          ))}
                        </div>

                        {col.highlights.length ? (
                          <>
                            <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.ingredientHighlights}</div>
                            <ul className="mt-1 space-y-0.5 text-sm text-foreground">
                              {col.highlights.map((h) => (
                                <li key={h} className="text-muted-foreground">
                                  {h}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}

                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.riskFlags}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(col.risks.length ? col.risks : ['—']).map((r) => (
                            <Badge
                              key={r}
                              variant="secondary"
                              className={cn(
                                'rounded-full text-[10px]',
                                r.includes('high') || r.includes('irrit') ? 'bg-rose-500/15 text-rose-600' : '',
                              )}
                            >
                              {r}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.socialLabel}</div>
                        {col.social ? (
                          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-lg bg-muted/30 p-2">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">RED</div>
                              <div className="mt-0.5 font-semibold text-foreground">{col.social.red ?? '—'}%</div>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-2">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reddit</div>
                              <div className="mt-0.5 font-semibold text-foreground">{col.social.reddit ?? '—'}%</div>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-2">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Burn</div>
                              <div className="mt-0.5 font-semibold text-foreground">{col.social.burn ?? '—'}%</div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-muted-foreground">—</div>
                        )}

                        {col.social?.phrases?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {col.social.phrases.map((p) => (
                              <Badge key={p} variant="secondary" className="rounded-full text-[10px]">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {col.citations.length ? (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.citations}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{col.citations.join(' · ')}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {onSwitchToDupe || onKeepOriginal ? (
          <div className="flex gap-2 pt-1">
            {onSwitchToDupe ? (
              <Button className="flex-1" onClick={onSwitchToDupe}>
                {copy.switchToDupe}
              </Button>
            ) : null}
            {onKeepOriginal ? (
              <Button variant="ghost" className="flex-1" onClick={onKeepOriginal}>
                {copy.keepOriginal}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
