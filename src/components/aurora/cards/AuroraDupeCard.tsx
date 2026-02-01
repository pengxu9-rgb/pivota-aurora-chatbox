import React, { useState, useMemo } from 'react';
import { Language, ProductPair, CheckoutRouteAnalysis } from '@/lib/types';
import { t } from '@/lib/i18n';
import { GitCompareArrows, Crown, Sparkles, ChevronDown, ChevronUp, ShoppingCart, ExternalLink, Info } from 'lucide-react';
import * as orchestrator from '@/lib/mockOrchestrator';
import { DupeComparisonCard } from '@/components/aurora/cards/DupeComparisonCard';

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getOfferPrice(price: number | undefined) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return undefined;
  return price;
}

function formatMoney(price: number | undefined, currency: string | undefined) {
  const safe = getOfferPrice(price);
  if (typeof safe !== 'number') return '—';
  const curr = currency?.trim() || 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: curr, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe);
  } catch {
    return `$${safe.toFixed(2)}`;
  }
}

function computeFitTagSimilarity(aTags: string[], bTags: string[]) {
  const a = new Set(aTags.map((t) => t.toLowerCase().trim()).filter(Boolean));
  const b = new Set(bTags.map((t) => t.toLowerCase().trim()).filter(Boolean));
  if (a.size === 0 || b.size === 0) return undefined;
  let intersection = 0;
  for (const v of a) if (b.has(v)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  if (!union) return undefined;
  return clampPercent((intersection / union) * 100);
}

function getPairSimilarity(pair: ProductPair) {
  const raw = (pair as any)?.similarity ?? (pair as any)?.similarity_score ?? (pair as any)?.similarityPercent;
  if (typeof raw === 'number' && Number.isFinite(raw)) return clampPercent(raw);
  return computeFitTagSimilarity(pair.premium.product.fit_tags ?? [], pair.dupe.product.fit_tags ?? []);
}

function uniqueTokens(items: unknown): string[] {
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

function extractKeyActives(product: any): string[] {
  const direct = uniqueTokens(product?.key_actives);
  if (direct.length) return direct;

  const packActives = uniqueTokens(product?.evidence_pack?.keyActives);
  if (packActives.length) return packActives;

  const tags = uniqueTokens(product?.fit_tags);
  return tags;
}

interface AuroraDupeCardProps {
  payload: {
    pairs: ProductPair[];
    routine: 'am' | 'pm';
    session: any;
  };
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

export function AuroraDupeCard({ payload, onAction, language }: AuroraDupeCardProps) {
  const { pairs, routine } = payload;
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, 'premium' | 'dupe'>>({});

  // Analyze checkout routes based on current selections
  const routeAnalysis: CheckoutRouteAnalysis = useMemo(() => {
    return orchestrator.analyzeCheckoutRoutes(pairs, selections);
  }, [pairs, selections]);

  // Calculate totals
  const premiumTotal = pairs.reduce((sum, pair) => {
    const price = getOfferPrice(pair.premium.offers[0]?.price) ?? 0;
    return sum + (selections[pair.category] === 'premium' || !selections[pair.category] ? price : 0);
  }, 0);

  const dupeTotal = pairs.reduce((sum, pair) => {
    const price = getOfferPrice(pair.dupe.offers[0]?.price) ?? 0;
    return sum + (selections[pair.category] === 'dupe' ? price : 0);
  }, 0);

  const currentTotal = pairs.reduce((sum, pair) => {
    const selected = selections[pair.category] || 'dupe';
    const price = selected === 'premium'
      ? getOfferPrice(pair.premium.offers[0]?.price) ?? 0
      : getOfferPrice(pair.dupe.offers[0]?.price) ?? 0;
    return sum + price;
  }, 0);

  const handleSelect = (pair: ProductPair, type: 'premium' | 'dupe') => {
    setSelections(prev => ({ ...prev, [pair.category]: type }));

    const selectedProduct = type === 'premium' ? pair.premium.product : pair.dupe.product;
    const selectedOffer = (type === 'premium' ? pair.premium.offers : pair.dupe.offers)[0];

    const actionPrefix = type === 'premium' ? 'select_premium_' : 'select_dupe_';
    onAction(`${actionPrefix}${selectedProduct.sku_id}`, {
      category: pair.category,
      type,
      sku_id: selectedProduct.sku_id,
      offer_id: selectedOffer?.offer_id,
    });
  };

  const handleCheckout = () => {
    if (routeAnalysis.routeType === 'all_internal') {
      onAction('checkout_confirm', { internalItems: routeAnalysis.internalOffers, selections });
    } else if (routeAnalysis.routeType === 'all_affiliate') {
      onAction('set_open_affiliate_list', { 
        affiliateItems: routeAnalysis.affiliateOffers,
        selections 
      });
    } else {
      // Mixed: checkout internal first, then show affiliate
      onAction('set_checkout_internal_only', { 
        internalItems: routeAnalysis.internalOffers,
        affiliateItems: routeAnalysis.affiliateOffers,
        selections 
      });
    }
  };

  const [activePreference, setActivePreference] = useState<string | null>(null);

  const handlePreferenceClick = (pref: string) => {
    setActivePreference(pref);
    onAction(pref === 'fastest' ? 'pref_fastest_delivery' : `pref_${pref}`);
  };

  return (
    <div className="chat-card-elevated space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl icon-container flex items-center justify-center">
            {routine === 'am' ? '☀️' : '🌙'}
          </div>
          <div>
            <p className="section-label">
              {language === 'EN' ? 'DUPE DISCOVERY' : '平替发现'}
            </p>
            <h3 className="text-sm font-semibold text-foreground">
              {routine === 'am' 
                ? (language === 'EN' ? 'Morning Routine' : '早间护肤')
                : (language === 'EN' ? 'Evening Routine' : '晚间护肤')
              }
            </h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {language === 'EN' ? 'Your Total' : '你的总计'}
          </p>
          <p className="text-lg font-bold text-foreground font-mono-nums">
            {formatMoney(currentTotal, 'USD')}
          </p>
        </div>
      </div>

      {/* Comparison Summary */}
      <div className="flex gap-2 text-xs">
        <div className="flex-1 p-2 rounded-lg bg-warning/10 border border-warning/20 text-center">
          <Crown className="w-4 h-4 text-warning mx-auto mb-1" />
          <p className="text-muted-foreground">{language === 'EN' ? 'Premium' : '高端'}</p>
          <p className="font-semibold text-foreground font-mono-nums">{formatMoney(premiumTotal, 'USD')}</p>
        </div>
        <div className="flex items-center">
          <GitCompareArrows className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 p-2 rounded-lg bg-success/10 border border-success/20 text-center">
          <Sparkles className="w-4 h-4 text-success mx-auto mb-1" />
          <p className="text-muted-foreground">{language === 'EN' ? 'Dupe' : '平替'}</p>
          <p className="font-semibold text-foreground font-mono-nums">{formatMoney(dupeTotal, 'USD')}</p>
        </div>
      </div>

      {/* Preference Chips */}
      <div className="flex flex-wrap gap-2">
        {(['cheaper', 'gentler', 'fastest'] as const).map((pref) => (
          <button
            key={pref}
            onClick={() => handlePreferenceClick(pref)}
            className={`chip-button ${activePreference === pref ? 'chip-button-primary' : ''}`}
          >
            {pref === 'cheaper' 
              ? (language === 'EN' ? '💰 Cheaper' : '💰 更便宜')
              : pref === 'gentler'
              ? (language === 'EN' ? '🌿 Gentler' : '🌿 更温和')
              : (language === 'EN' ? '⚡ Fastest' : '⚡ 最快到货')
            }
          </button>
        ))}
      </div>

      {/* Product Pairs */}
      <div className="space-y-3">
        {pairs.map((pair) => {
          const similarity = getPairSimilarity(pair);
          const isExpanded = expandedPair === pair.category;
          const selected = selections[pair.category] || 'dupe';
          const selectedOffer = selected === 'premium' ? pair.premium.offers[0] : pair.dupe.offers[0];
          const isAffiliate = selectedOffer?.purchase_route === 'affiliate_outbound';
          const premiumOffer = pair.premium.offers[0];
          const dupeOffer = pair.dupe.offers[0];
          const savings =
            typeof getOfferPrice(premiumOffer?.price) === 'number' && typeof getOfferPrice(dupeOffer?.price) === 'number'
              ? (getOfferPrice(premiumOffer?.price) as number) - (getOfferPrice(dupeOffer?.price) as number)
              : undefined;
          const savingsLabel =
            typeof savings === 'number' && Number.isFinite(savings) && savings > 0
              ? language === 'EN'
                ? `Save $${Math.round(savings)}`
                : `省 $${Math.round(savings)}`
              : language === 'EN'
              ? 'Save'
              : '省钱';

          const premiumActives = extractKeyActives(pair.premium.product);
          const dupeActives = extractKeyActives(pair.dupe.product);
          const missingActives = premiumActives.filter((tag) => !dupeActives.includes(tag)).slice(0, 8);
          const addedBenefits = dupeActives.filter((tag) => !premiumActives.includes(tag)).slice(0, 8);
          const tradeoffNote =
            (pair as any)?.tradeoff_note ??
            (pair as any)?.tradeoffNote ??
            (pair as any)?.tradeoff ??
            undefined;
          
          return (
            <div 
              key={pair.category}
              className="rounded-xl border border-border overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => setExpandedPair(isExpanded ? null : pair.category)}
                className="w-full p-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {t(`product.category.${pair.category}`, language)}
                  </span>
                  {typeof similarity === 'number' ? (
                    <span className="signal-pill signal-pill-primary text-[10px]">
                      {similarity}% {language === 'EN' ? 'similar' : '相似'}
                    </span>
                  ) : null}
                  {isAffiliate && (
                    <span className="signal-pill text-[10px] flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      {language === 'EN' ? 'External' : '外链'}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded ? (
                <div className="p-3">
                  <DupeComparisonCard
                    original={{
                      imageUrl: pair.premium.product.image_url,
                      brand: pair.premium.product.brand,
                      name: pair.premium.product.name,
                      price: premiumOffer?.price,
                      currency: premiumOffer?.currency,
                      mechanism: (pair.premium.product as any)?.mechanism,
                      experience: (pair.premium.product as any)?.experience,
                      risk_flags: (pair.premium.product as any)?.risk_flags,
                      social_stats: (pair.premium.product as any)?.social_stats,
                      key_actives: premiumActives,
                      evidence_pack: (pair.premium.product as any)?.evidence_pack,
                      ingredients: (pair.premium.product as any)?.ingredients,
                    }}
                    dupe={{
                      imageUrl: pair.dupe.product.image_url,
                      brand: pair.dupe.product.brand,
                      name: pair.dupe.product.name,
                      price: dupeOffer?.price,
                      currency: dupeOffer?.currency,
                      mechanism: (pair.dupe.product as any)?.mechanism,
                      experience: (pair.dupe.product as any)?.experience,
                      risk_flags: (pair.dupe.product as any)?.risk_flags,
                      social_stats: (pair.dupe.product as any)?.social_stats,
                      key_actives: dupeActives,
                      evidence_pack: (pair.dupe.product as any)?.evidence_pack,
                      ingredients: (pair.dupe.product as any)?.ingredients,
                    }}
                    savingsLabel={savingsLabel}
                    similarity={similarity}
                    tradeoffNote={typeof tradeoffNote === 'string' ? tradeoffNote : undefined}
                    missingActives={missingActives}
                    addedBenefits={addedBenefits}
                    selected={selected === 'premium' ? 'original' : 'dupe'}
                    labels={{
                      similarity: language === 'EN' ? 'Similarity' : '相似度',
                      tradeoffsTitle: language === 'EN' ? 'Trade-offs Analysis' : '差异分析',
                      evidenceTitle: language === 'EN' ? 'Evidence & Signals' : '依据与信号',
                      scienceLabel: language === 'EN' ? 'Science' : '科学',
                      socialLabel: language === 'EN' ? 'Social' : '社媒',
                      keyActives: language === 'EN' ? 'Key actives' : '关键活性',
                      riskFlags: language === 'EN' ? 'Risks' : '风险点',
                      ingredientHighlights: language === 'EN' ? 'Ingredient highlights' : '成分亮点',
                      citations: language === 'EN' ? 'Citations' : 'KB 引用',
                      tradeoffNote: language === 'EN' ? 'Trade-off' : '权衡',
                      missingActives: language === 'EN' ? 'Missing Actives' : '缺少点',
                      addedBenefits: language === 'EN' ? 'Added Benefits' : '新增点',
                      switchToDupe: language === 'EN' ? 'Switch to Dupe' : '选择平替',
                      keepOriginal: language === 'EN' ? 'Keep Original' : '保留原版',
                    }}
                    onSwitchToDupe={() => handleSelect(pair, 'dupe')}
                    onKeepOriginal={() => handleSelect(pair, 'premium')}
                  />
                </div>
              ) : (
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selected === 'premium' ? (
                      <Crown className="w-4 h-4 text-warning" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-success" />
                    )}
                    <span className="text-sm text-foreground">
                      {selected === 'premium' ? pair.premium.product.brand : pair.dupe.product.brand}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground font-mono-nums">
                    {formatMoney(selected === 'premium' ? premiumOffer?.price : dupeOffer?.price, selectedOffer?.currency)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Checkout Route Info */}
      {routeAnalysis.routeType !== 'all_internal' && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50 flex items-start gap-2">
          <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            {routeAnalysis.routeType === 'mixed' ? (
              language === 'EN'
                ? `${routeAnalysis.internalOffers.length} item(s) can be purchased here. ${routeAnalysis.affiliateOffers.length} item(s) will open retailer sites (affiliate links; no price change).`
                : `${routeAnalysis.internalOffers.length} 件商品可在此购买。${routeAnalysis.affiliateOffers.length} 件将跳转零售商网站（联盟链接，价格不变）。`
            ) : (
              language === 'EN'
                ? 'All items will open retailer sites (affiliate links; no price change for you).'
                : '所有商品将跳转至零售商网站（联盟链接，价格不变）。'
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-border">
        {routeAnalysis.routeType === 'all_internal' ? (
          <button
            onClick={handleCheckout}
            className="action-button action-button-secondary w-full flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            {language === 'EN' ? 'Checkout (optional)' : '结账（可选）'} · ${currentTotal.toFixed(2)}
          </button>
        ) : routeAnalysis.routeType === 'mixed' ? (
          <div className="space-y-2">
            <button
              onClick={() => onAction('set_open_affiliate_list', { 
                affiliateItems: routeAnalysis.affiliateOffers,
                selections 
              })}
              className="action-button action-button-primary w-full flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {language === 'EN' 
                ? `Open retailer links (${routeAnalysis.affiliateOffers.length})`
                : `打开零售商链接 (${routeAnalysis.affiliateOffers.length})`
              }
            </button>
            <button
              onClick={() => onAction('set_checkout_internal_only', { 
                internalItems: routeAnalysis.internalOffers,
                affiliateItems: routeAnalysis.affiliateOffers,
                selections 
              })}
              className="action-button action-button-secondary w-full flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              {language === 'EN' 
                ? `Checkout available items (optional): ${routeAnalysis.internalOffers.length}`
                : `结账可购商品（可选）：${routeAnalysis.internalOffers.length} 件`
              }
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAction('set_open_affiliate_list', { 
              affiliateItems: routeAnalysis.affiliateOffers,
              selections 
            })}
            className="action-button action-button-primary w-full flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            {language === 'EN' ? 'Open retailer links' : '打开零售商链接'} · ${currentTotal.toFixed(2)}
          </button>
        )}
      </div>
    </div>
  );
}
