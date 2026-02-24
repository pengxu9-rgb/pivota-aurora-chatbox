import React from 'react';

import {
  emitAuroraIngredientExternalFallbackUsed,
  emitAuroraIngredientProductClick,
  emitAuroraIngredientProductImpression,
  emitAuroraIngredientProductOpenAttempt,
  emitAuroraIngredientProductOpenResult,
  emitAuroraIngredientPlanProductTap,
  type AnalyticsContext,
} from '@/lib/auroraAnalytics';
import type { Language } from '@/lib/types';

type Dict = Record<string, unknown>;

const asObject = (value: unknown): Dict | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Dict;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => {
  if (value == null) return '';
  const text = String(value).trim();
  return text;
};

const asNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toStringList = (value: unknown, max = 6): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    const text = asString(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
};

const normalizeIntensityLevel = (token: string): 'gentle' | 'balanced' | 'active' => {
  const normalized = token.toLowerCase();
  if (normalized === 'gentle' || normalized === 'balanced' || normalized === 'active') return normalized;
  return 'balanced';
};

const getIntensityCopy = (
  level: 'gentle' | 'balanced' | 'active',
  language: Language,
): { label: string; explanation: string } => {
  if (language === 'CN') {
    if (level === 'gentle') return { label: '温和', explanation: '以修护屏障和降低刺激为主。' };
    if (level === 'active') return { label: '积极', explanation: '更聚焦问题处理，同时加强耐受监测。' };
    return { label: '平衡', explanation: '在修护与处理之间保持中等强度。' };
  }
  if (level === 'gentle') return { label: 'Gentle', explanation: 'Barrier-first with lower irritation risk.' };
  if (level === 'active') return { label: 'Active', explanation: 'Targeted treatment with tighter tolerance monitoring.' };
  return { label: 'Balanced', explanation: 'Moderate treatment intensity with repair support.' };
};

const normalizePriorityLevel = (levelToken: string, score: number | null): 'high' | 'medium' | 'low' => {
  const level = levelToken.toLowerCase();
  if (level === 'high' || level === 'medium' || level === 'low') return level;
  if (score == null) return 'medium';
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
};

const priorityLabel = (level: 'high' | 'medium' | 'low', language: Language): string => {
  if (language === 'CN') {
    if (level === 'high') return '高优先级';
    if (level === 'low') return '低优先级';
    return '中优先级';
  }
  if (level === 'high') return 'High priority';
  if (level === 'low') return 'Low priority';
  return 'Medium priority';
};

const renderPrice = (price: number | null, currency: string): string | null => {
  if (price == null) return null;
  const code = currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(price);
  } catch {
    return `${code} ${price.toFixed(2)}`;
  }
};

const normalizeUrl = (value: unknown): string | null => {
  const text = asString(value);
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) return null;
  return text;
};

const sourceLabel = (source: string, language: Language): string => {
  const token = source.toLowerCase();
  if (token === 'amazon') return 'Amazon';
  if (token === 'reddit') return 'Reddit';
  if (token === 'xiaohongshu' || token === 'xhs') return language === 'CN' ? '小红书' : 'Xiaohongshu';
  if (token === 'google') return 'Google';
  if (token === 'kb') return language === 'CN' ? '知识库' : 'KB';
  return source || (language === 'CN' ? '外部' : 'External');
};

const renderRating = (ratingValue: number | null, ratingCount: number | null): string | null => {
  if (ratingValue == null) return null;
  if (ratingCount == null || ratingCount <= 0) return `${ratingValue.toFixed(1)}`;
  return `${ratingValue.toFixed(1)} (${ratingCount})`;
};

const buildGoogleSearchUrl = (query: string): string | null => {
  const text = String(query || '').trim();
  if (!text) return null;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
};

function IngredientProducts({
  ingredientId,
  ingredientName,
  products,
  language,
  analyticsCtx,
  cardId,
}: {
  ingredientId: string;
  ingredientName?: string;
  products: Dict | null;
  language: Language;
  analyticsCtx?: AnalyticsContext;
  cardId?: string;
}) {
  const normalizedIngredientName = asString(ingredientName) || asString(ingredientId);
  const competitors = asArray(products?.competitors).map(asObject).filter(Boolean) as Dict[];
  const dupes = asArray(products?.dupes).map(asObject).filter(Boolean) as Dict[];
  const rows = [
    ...competitors.slice(0, 2).map((item) => ({ ...item, source_block: asString(item.source_block) || 'competitor' })),
    ...dupes.slice(0, 1).map((item) => ({ ...item, source_block: asString(item.source_block) || 'dupe' })),
  ].map((row) => {
    const productId = asString(row.product_id);
    const productName = asString(row.name) || asString(row.title) || (language === 'CN' ? '推荐商品' : 'Suggested product');
    const brand = asString(row.brand);
    const source = asString(row.source) || 'kb';
    const sourceBlock = asString(row.source_block) || 'competitor';
    const fallbackType = asString(row.fallback_type) || 'catalog';
    const price = asNumber(row.price);
    const currency = asString(row.currency) || 'USD';
    const priceTier = asString(row.price_tier) || null;
    const reason = asString(row.why_match);
    const thumbUrl = normalizeUrl(row.thumb_url) || normalizeUrl(row.image_url);
    const ratingValue = asNumber(row.rating_value);
    const ratingCount = asNumber(row.rating_count);
    const pdpUrl = normalizeUrl(row.pdp_url);
    const searchQuery = [brand, productName, normalizedIngredientName].filter(Boolean).join(' ');
    const googleFallbackUrl = buildGoogleSearchUrl(searchQuery || normalizedIngredientName);
    const openUrl = pdpUrl || googleFallbackUrl;
    return {
      productId,
      productName,
      brand,
      source,
      sourceBlock,
      fallbackType,
      price,
      currency,
      priceTier,
      reason,
      thumbUrl,
      ratingValue,
      ratingCount,
      pdpUrl,
      googleFallbackUrl,
      openUrl,
    };
  });

  const fallbackOnlyUrl = rows.length ? null : buildGoogleSearchUrl(`${normalizedIngredientName} skincare product`);

  React.useEffect(() => {
    if (!analyticsCtx) return;
    if (!rows.length) {
      if (fallbackOnlyUrl) {
        emitAuroraIngredientExternalFallbackUsed(analyticsCtx, {
          card_id: cardId ?? null,
          ingredient_id: ingredientId,
          source: 'google',
          fallback_type: 'search',
        });
      }
      return;
    }
    rows.forEach((row) => {
      emitAuroraIngredientProductImpression(analyticsCtx, {
        card_id: cardId ?? null,
        ingredient_id: ingredientId,
        product_id: row.productId || null,
        source: row.source || null,
        source_block: row.sourceBlock || null,
        fallback_type: row.fallbackType || null,
        price: row.price,
        currency: row.currency,
      });
    });
    const fallbackRows = rows.filter((row) => row.fallbackType !== 'catalog' || row.source !== 'kb');
    fallbackRows.forEach((row) => {
      emitAuroraIngredientExternalFallbackUsed(analyticsCtx, {
        card_id: cardId ?? null,
        ingredient_id: ingredientId,
        source: row.source || null,
        fallback_type: row.fallbackType || null,
      });
    });
  }, [analyticsCtx, cardId, fallbackOnlyUrl, ingredientId, rows]);

  const openExternalWithFallback = (url: string | null) => {
    if (!url) {
      return {
        success: false,
        blockedReason: 'missing_url',
        openMode: 'window_open' as const,
      };
    }
    if (typeof window === 'undefined') {
      return {
        success: false,
        blockedReason: 'window_unavailable',
        openMode: 'window_open' as const,
      };
    }

    if (typeof window.open !== 'function') {
      try {
        window.location.assign(url);
        return { success: true, blockedReason: null, openMode: 'same_tab_fallback' as const };
      } catch {
        return { success: false, blockedReason: 'navigation_failed', openMode: 'same_tab_fallback' as const };
      }
    }

    try {
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (popup) return { success: true, blockedReason: null, openMode: 'window_open' as const };
      try {
        window.location.assign(url);
        return { success: true, blockedReason: 'popup_blocked', openMode: 'same_tab_fallback' as const };
      } catch {
        return { success: false, blockedReason: 'popup_blocked', openMode: 'same_tab_fallback' as const };
      }
    } catch {
      try {
        window.location.assign(url);
        return { success: true, blockedReason: 'window_open_error', openMode: 'same_tab_fallback' as const };
      } catch {
        return { success: false, blockedReason: 'window_open_error', openMode: 'same_tab_fallback' as const };
      }
    }
  };

  if (!rows.length) {
    if (!fallbackOnlyUrl) return null;
    return (
      <div className="mt-2">
        <a
          href={fallbackOnlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-xl border border-border/60 bg-muted/20 p-3 text-left hover:bg-muted/30"
          onClick={(event) => {
            if (analyticsCtx) {
              emitAuroraIngredientProductClick(analyticsCtx, {
                card_id: cardId ?? null,
                ingredient_id: ingredientId,
                product_id: null,
                source: 'google',
                source_block: 'fallback',
                fallback_type: 'search',
                price: null,
                currency: null,
                pdp_url: fallbackOnlyUrl,
              });
              emitAuroraIngredientProductOpenAttempt(analyticsCtx, {
                card_id: cardId ?? null,
                ingredient_id: ingredientId,
                product_id: null,
                source: 'google',
                source_block: 'fallback',
                fallback_type: 'search',
                price: null,
                currency: null,
                pdp_url: fallbackOnlyUrl,
                open_target: 'external',
              });
            }
            event.preventDefault();
            const openResult = openExternalWithFallback(fallbackOnlyUrl);
            if (analyticsCtx) {
              emitAuroraIngredientProductOpenResult(analyticsCtx, {
                card_id: cardId ?? null,
                ingredient_id: ingredientId,
                product_id: null,
                source: 'google',
                source_block: 'fallback',
                fallback_type: 'search',
                price: null,
                currency: null,
                pdp_url: fallbackOnlyUrl,
                success: openResult.success,
                blocked_reason: openResult.blockedReason,
                open_mode: openResult.openMode,
              });
            }
          }}
        >
          <div className="text-sm font-medium text-foreground">
            {language === 'CN' ? '暂无结构化商品，查看 Google 结果' : 'No structured product yet, open Google results'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{normalizedIngredientName}</div>
        </a>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-1 gap-2">
      {rows.map((row, idx) => {
        const priceText = renderPrice(row.price, row.currency);
        const ratingText = renderRating(row.ratingValue, row.ratingCount);
        const sourceText = sourceLabel(row.source, language);
        const sourceBlockText = row.sourceBlock === 'dupe'
          ? (language === 'CN' ? '平替' : 'Dupe')
          : (language === 'CN' ? '同类' : 'Competitor');
        const sourceBadgeText = `${sourceBlockText} · ${sourceText}`;
        const openLabel = row.pdpUrl
          ? language === 'CN' ? '打开商品页' : 'Open PDP'
          : language === 'CN' ? '查看 Google 结果' : 'Open Google result';
        return (
          <a
            key={`${ingredientId}_${row.productId || row.productName}_${idx}`}
            href={row.openUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-xl border border-border/60 bg-muted/20 p-3 text-left hover:bg-muted/30"
            onClick={(event) => {
              if (analyticsCtx) {
                emitAuroraIngredientPlanProductTap(analyticsCtx, {
                  card_id: cardId ?? null,
                  ingredient_id: ingredientId,
                  product_id: row.productId || null,
                  source_block: row.sourceBlock,
                  price_tier: row.priceTier,
                  price: row.price,
                  currency: row.currency,
                  title: row.productName,
                });
                emitAuroraIngredientProductClick(analyticsCtx, {
                  card_id: cardId ?? null,
                  ingredient_id: ingredientId,
                  product_id: row.productId || null,
                  source: row.source || null,
                  source_block: row.sourceBlock || null,
                  fallback_type: row.fallbackType || null,
                  price: row.price,
                  currency: row.currency,
                  pdp_url: row.openUrl || null,
                });
                emitAuroraIngredientProductOpenAttempt(analyticsCtx, {
                  card_id: cardId ?? null,
                  ingredient_id: ingredientId,
                  product_id: row.productId || null,
                  source: row.source || null,
                  source_block: row.sourceBlock || null,
                  fallback_type: row.fallbackType || null,
                  price: row.price,
                  currency: row.currency,
                  pdp_url: row.openUrl || null,
                  open_target: 'external',
                });
              }

              event.preventDefault();
              const openResult = openExternalWithFallback(row.openUrl);
              if (analyticsCtx) {
                emitAuroraIngredientProductOpenResult(analyticsCtx, {
                  card_id: cardId ?? null,
                  ingredient_id: ingredientId,
                  product_id: row.productId || null,
                  source: row.source || null,
                  source_block: row.sourceBlock || null,
                  fallback_type: row.fallbackType || null,
                  price: row.price,
                  currency: row.currency,
                  pdp_url: row.openUrl || null,
                  success: openResult.success,
                  blocked_reason: openResult.blockedReason,
                  open_mode: openResult.openMode,
                });
              }
            }}
          >
            <div className="flex items-start gap-3">
              {row.thumbUrl ? (
                <img
                  src={row.thumbUrl}
                  alt={row.productName}
                  className="h-12 w-12 shrink-0 rounded-lg border border-border/50 object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-lg border border-border/50 bg-muted/40" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-foreground">{row.productName}</div>
                  <div className="text-[11px] text-muted-foreground">{openLabel}</div>
                </div>
                {row.brand ? <div className="mt-0.5 text-xs text-muted-foreground">{row.brand}</div> : null}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-muted-foreground">
                    {sourceBadgeText}
                  </span>
                  {row.priceTier ? (
                    <span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-muted-foreground">
                      {row.priceTier}
                    </span>
                  ) : null}
                  {priceText ? <span className="text-foreground/90">{priceText}</span> : null}
                  {ratingText ? <span className="text-muted-foreground">Rating {ratingText}</span> : null}
                </div>
                {row.reason ? <div className="mt-1 text-xs text-muted-foreground">{row.reason}</div> : null}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function IngredientPlanCard({
  payload,
  language,
  variant,
  analyticsCtx,
  cardId,
}: {
  payload: unknown;
  language: Language;
  variant: 'v1' | 'v2';
  analyticsCtx?: AnalyticsContext;
  cardId?: string;
}) {
  const root = asObject(payload) || {};
  if (variant === 'v2') {
    const intensityObj = asObject(root.intensity) || {};
    const intensityLevel = normalizeIntensityLevel(asString(intensityObj.level));
    const defaultIntensity = getIntensityCopy(intensityLevel, language);
    const intensityLabel = asString(intensityObj.label) || defaultIntensity.label;
    const intensityExplanation = asString(intensityObj.explanation) || defaultIntensity.explanation;
    const targets = asArray(root.targets).map(asObject).filter(Boolean) as Dict[];
    const avoid = asArray(root.avoid).map(asObject).filter(Boolean) as Dict[];
    const conflicts = asArray(root.conflicts).map(asObject).filter(Boolean) as Dict[];
    const budgetContext = asObject(root.budget_context);
    const effectiveTier = asString(budgetContext?.effective_tier);
    const diversifiedWhenUnknown = budgetContext?.diversified_when_unknown === true;

    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
          <div className="text-xs font-semibold text-foreground">
            {language === 'CN' ? `强度：${intensityLabel}` : `Intensity: ${intensityLabel}`}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{intensityExplanation}</div>
          {effectiveTier ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {language === 'CN' ? `预算偏好：${effectiveTier}` : `Budget context: ${effectiveTier}`}
              {diversifiedWhenUnknown ? language === 'CN' ? '（未知时已做价位分散）' : ' (diversified for unknown budget)' : ''}
            </div>
          ) : null}
        </div>

        {targets.length ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '推荐成分与商品' : 'Target ingredients + products'}</div>
            {targets.slice(0, 8).map((target, idx) => {
              const ingredientId = asString(target.ingredient_id) || `ingredient_${idx + 1}`;
              const ingredientName = asString(target.ingredient_name) || ingredientId;
              const score = asNumber(target.priority_score_0_100);
              const level = normalizePriorityLevel(asString(target.priority_level), score);
              const why = toStringList(target.why, 3);
              const guidance = toStringList(target.usage_guidance, 3);
              const products = asObject(target.products);
              return (
                <div key={`${ingredientId}_${idx}`} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">{ingredientName}</div>
                    <div className="text-[11px] text-muted-foreground">{priorityLabel(level, language)}</div>
                  </div>
                  {why.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                      {why.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {guidance.length ? (
                    <div className="mt-2 rounded-lg border border-border/60 bg-background/80 px-2 py-1.5 text-xs text-muted-foreground">
                      {language === 'CN' ? '用法：' : 'How to use: '}
                      {guidance.join(language === 'CN' ? '；' : '; ')}
                    </div>
                  ) : null}
                  <IngredientProducts
                    ingredientId={ingredientId}
                    ingredientName={ingredientName}
                    products={products}
                    language={language}
                    analyticsCtx={analyticsCtx}
                    cardId={cardId}
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {avoid.length ? (
          <div>
            <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '需规避/谨慎' : 'Avoid / caution'}</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
              {avoid.slice(0, 6).map((item, idx) => {
                const ingredientName = asString(item.ingredient_name) || asString(item.ingredient_id) || `ingredient_${idx + 1}`;
                const reasons = toStringList(item.reason, 2);
                return (
                  <li key={`${ingredientName}_${idx}`}>
                    {ingredientName}
                    {reasons.length ? ` · ${reasons.join(language === 'CN' ? '；' : '; ')}` : ''}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {conflicts.length ? (
          <div>
            <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '冲突说明' : 'Conflicts'}</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
              {conflicts.slice(0, 4).map((item, idx) => (
                <li key={`conflict_${idx}`}>{asString(item.description) || asString(item.message)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const legacyPlan = asObject(root.plan) || root;
  const intensityToken = normalizeIntensityLevel(asString(legacyPlan.intensity) || asString(root.intensity));
  const intensity = getIntensityCopy(intensityToken, language);
  const targets = asArray(legacyPlan.targets ?? root.targets).map(asObject).filter(Boolean) as Dict[];
  const avoid = asArray(legacyPlan.avoid ?? root.avoid).map(asObject).filter(Boolean) as Dict[];
  const conflicts = asArray(legacyPlan.conflicts ?? root.conflicts).map(asObject).filter(Boolean) as Dict[];

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
        <div className="text-xs font-semibold text-foreground">
          {language === 'CN' ? `强度：${intensity.label}` : `Intensity: ${intensity.label}`}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{intensity.explanation}</div>
      </div>
      {targets.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '推荐成分' : 'Target ingredients'}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {targets.slice(0, 8).map((item, idx) => {
              const ingredientId = asString(item.ingredient_name) || asString(item.ingredient_id) || asString(item.ingredientId) || `ingredient_${idx + 1}`;
              const score = asNumber(item.priority_score_0_100) ?? asNumber(item.priority);
              const level = normalizePriorityLevel(asString(item.priority_level), score);
              return (
                <li key={`${ingredientId}_${idx}`}>
                  {ingredientId} · {priorityLabel(level, language)}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {avoid.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '需规避/谨慎' : 'Avoid / caution'}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {avoid.slice(0, 6).map((item, idx) => (
              <li key={`avoid_${idx}`}>
                {asString(item.ingredient_name) || asString(item.ingredient_id) || asString(item.ingredientId) || 'ingredient'}
                {asString(item.severity) ? ` · ${asString(item.severity)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {conflicts.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '冲突说明' : 'Conflicts'}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {conflicts.slice(0, 4).map((item, idx) => (
              <li key={`legacy_conflict_${idx}`}>{asString(item.description) || asString(item.message)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
