import React, { useMemo } from 'react';

import {
  emitDiscoveryLinkOpenAttempt,
  emitDiscoveryLinkOpenResult,
  emitIngredientProductOpenAttempt,
  emitIngredientProductOpenResult,
  type AnalyticsContext,
} from '@/lib/auroraAnalytics';
import { buildPdpUrl, extractPdpTargetFromProductGroupId } from '@/lib/pivotaShop';
import type { Language } from '@/lib/types';

type ProductLike = {
  product_id?: string;
  merchant_id?: string;
  title?: string;
  name?: string;
  brand?: string;
  source?: string;
  source_block?: string;
  why_match?: string;
  price?: unknown;
  currency?: string;
  price_tier?: string;
  pdp_url?: string;
  url?: string;
  product_url?: string;
  purchase_path?: string;
  product_ref?: { product_id?: string; merchant_id?: string };
  canonical_product_ref?: { product_id?: string; merchant_id?: string };
  subject_product_group_id?: string;
  product_group_id?: string;
  pdp_open?: {
    path?: string;
    subject?: { id?: string; product_group_id?: string };
    product_ref?: { product_id?: string; merchant_id?: string };
    external?: { url?: string };
  };
};

type IngredientTargetLike = {
  ingredient_id?: string;
  ingredient_name?: string;
  ingredient?: string;
  display_name?: string;
  priority_level?: string;
  priority_score_0_100?: number;
  why?: unknown;
  usage_guidance?: unknown;
  products?: {
    competitors?: ProductLike[];
    dupes?: ProductLike[];
  };
};

type PlanVariant = 'v1' | 'v2';
type ProductBucket = 'competitors' | 'dupes' | 'external_search_ctas';
type OpenResult = 'success_new_tab' | 'success_same_tab_fallback' | 'blocked_popup' | 'blocked_invalid_url' | 'failed_unknown';

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => {
  if (value == null) return '';
  return String(value).trim();
};

const asNonEmptyString = (value: unknown): string | null => {
  const text = asString(value);
  return text || null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const amount = Number((value as { amount?: unknown }).amount);
    return Number.isFinite(amount) ? amount : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringList = (value: unknown, max = 3): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    const text = asString(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
};

const asTargets = (value: unknown): IngredientTargetLike[] =>
  asArray(value)
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? (item as IngredientTargetLike) : null))
    .filter(Boolean) as IngredientTargetLike[];

const asProductRows = (value: unknown): ProductLike[] =>
  asArray(value)
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? (item as ProductLike) : null))
    .filter(Boolean) as ProductLike[];

const safeUrl = (value: unknown): string => {
  const text = asString(value);
  if (!text || !/^https?:\/\//i.test(text)) return '';
  try {
    new URL(text);
    return text;
  } catch {
    return '';
  }
};

const readRefTarget = (raw: unknown): { product_id: string; merchant_id?: string } | null => {
  const ref = asObject(raw);
  if (!ref) return null;
  const productId = asNonEmptyString(ref.product_id) || asNonEmptyString(ref.productId);
  const merchantId = asNonEmptyString(ref.merchant_id) || asNonEmptyString(ref.merchantId);
  if (!productId) return null;
  return merchantId ? { product_id: productId, merchant_id: merchantId } : { product_id: productId };
};

const deriveInternalPdpUrlFromContract = (row: ProductLike): string => {
  const pdpOpen = asObject(row.pdp_open) || asObject((row as { pdpOpen?: unknown }).pdpOpen);
  const directRef =
    readRefTarget(pdpOpen?.product_ref) || readRefTarget(row.product_ref) || readRefTarget(row.canonical_product_ref);
  if (directRef?.product_id) return safeUrl(buildPdpUrl(directRef));

  const subject = asObject(pdpOpen?.subject);
  const groupId =
    asNonEmptyString(subject?.id) ||
    asNonEmptyString(subject?.product_group_id) ||
    asNonEmptyString(row.subject_product_group_id) ||
    asNonEmptyString(row.product_group_id);
  const targetFromGroup = extractPdpTargetFromProductGroupId(groupId);
  return targetFromGroup?.product_id ? safeUrl(buildPdpUrl(targetFromGroup)) : '';
};

const productOpenUrl = (row: ProductLike): string =>
  safeUrl(row.pdp_url) ||
  safeUrl(row.url) ||
  safeUrl(row.product_url) ||
  safeUrl(row.purchase_path) ||
  deriveInternalPdpUrlFromContract(row) ||
  safeUrl(row.pdp_open?.external?.url);

function openWithAnchorFallback(url: string): { result: OpenResult; blockedReason?: string } {
  if (!url) return { result: 'blocked_invalid_url', blockedReason: 'invalid_url' };
  try {
    const opened = Boolean(window.open(url, '_blank', 'noopener,noreferrer'));
    if (opened) return { result: 'success_new_tab' };
    try {
      window.location.assign(url);
      return { result: 'success_same_tab_fallback', blockedReason: 'popup_blocked_fallback_same_tab' };
    } catch {
      return { result: 'blocked_popup', blockedReason: 'popup_blocked_and_fallback_failed' };
    }
  } catch {
    return { result: 'failed_unknown', blockedReason: 'open_exception' };
  }
}

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

function ProductCard({
  row,
  bucket,
  language,
  labels,
  onOpenProduct,
}: {
  row: ProductLike;
  bucket: ProductBucket;
  language: Language;
  labels: {
    linkUnavailable: string;
    openProduct: string;
    openSearch: string;
    primaryBadge: string;
    alternativeBadge: string;
    searchBadge: string;
  };
  onOpenProduct: (row: ProductLike, source: ProductBucket) => void;
}) {
  const name = asString(row.title || row.name) || 'product';
  const brand = asString(row.brand);
  const source = asString(row.source);
  const whyMatch = asString(row.why_match);
  const price = asNumber(row.price);
  const currency = asString(row.currency) || 'USD';
  const priceText = renderPrice(price, currency);
  const url = productOpenUrl(row);
  const badge =
    bucket === 'competitors'
      ? labels.primaryBadge
      : bucket === 'dupes'
        ? labels.alternativeBadge
        : labels.searchBadge;
  const metaLine = [brand, source].filter(Boolean).join(' · ');
  const actionLabel = bucket === 'external_search_ctas' ? labels.openSearch : labels.openProduct;

  return (
    <div className="rounded-2xl border border-border/60 bg-background/90 p-3 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{name}</div>
          {metaLine ? <div className="mt-0.5 text-xs text-muted-foreground">{metaLine}</div> : null}
        </div>
        <div className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
          {badge}
        </div>
      </div>

      {whyMatch ? <div className="mt-2 text-xs leading-5 text-muted-foreground">{whyMatch}</div> : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-foreground/80">{priceText || ''}</div>
        {url ? (
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-foreground/15 bg-foreground px-3 py-1 text-xs font-medium text-background transition hover:opacity-90"
            aria-label={`${actionLabel}: ${name}`}
            onClick={() => onOpenProduct(row, bucket)}
          >
            {actionLabel}
          </button>
        ) : (
          <div className="text-xs text-muted-foreground">{labels.linkUnavailable}</div>
        )}
      </div>
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
  payload: Record<string, unknown>;
  language: Language;
  variant?: PlanVariant;
  analyticsCtx?: AnalyticsContext;
  cardId?: string;
}) {
  const previewOnly = payload.preview_only === true;
  const resolvedVariant = variant || 'v2';
  const targets = asTargets(payload.targets);
  const externalSearchCtas = asProductRows(payload.external_search_ctas);
  const intensityObj = asObject(payload.intensity) || {};
  const intensityLevel = normalizeIntensityLevel(asString(intensityObj.level));
  const defaultIntensity = getIntensityCopy(intensityLevel, language);
  const intensityLabel = asString(intensityObj.label) || defaultIntensity.label;
  const intensityExplanation = asString(intensityObj.explanation) || defaultIntensity.explanation;
  const budgetContext = asObject(payload.budget_context);
  const effectiveTier = asString(budgetContext?.effective_tier);
  const diversifiedWhenUnknown = budgetContext?.diversified_when_unknown === true;
  const avoid = asArray(payload.avoid).map(asObject).filter(Boolean) as Array<Record<string, unknown>>;
  const conflicts = asArray(payload.conflicts).map(asObject).filter(Boolean) as Array<Record<string, unknown>>;

  const labels =
    language === 'CN'
      ? {
          title: '目标成分与产品',
          preview: '补全 AM/PM routine 后将解锁个性化产品推荐。',
          competitors: '主选',
          dupes: '平替',
          linkUnavailable: '链接暂不可用',
          search: '外部检索',
          intensity: '强度',
          budget: '预算偏好',
          diversifiedUnknown: '（未知时已做价位分散）',
          usage: '用法',
          avoidTitle: '需规避/谨慎',
          conflictsTitle: '冲突说明',
          openProduct: '查看商品',
          openSearch: '打开搜索',
          primaryBadge: '主选',
          alternativeBadge: '平替',
          searchBadge: '检索',
        }
      : {
          title: 'Target ingredients + products',
          preview: 'Complete AM/PM routine to unlock personalized product picks.',
          competitors: 'Primary picks',
          dupes: 'Alternatives',
          linkUnavailable: 'Link unavailable',
          search: 'External search',
          intensity: 'Intensity',
          budget: 'Budget context',
          diversifiedUnknown: '(diversified for unknown budget)',
          usage: 'How to use',
          avoidTitle: 'Avoid / caution',
          conflictsTitle: 'Conflicts',
          openProduct: 'Open product',
          openSearch: 'Open search',
          primaryBadge: 'Primary',
          alternativeBadge: 'Alternative',
          searchBadge: 'Search',
        };

  const sections = useMemo(
    () =>
      targets.map((target, index) => {
        const ingredient =
          asString(target.ingredient_name) ||
          asString(target.ingredient) ||
          asString(target.display_name) ||
          `target_${index + 1}`;
        const score = asNumber(target.priority_score_0_100);
        const level = normalizePriorityLevel(asString(target.priority_level), score);
        const why = toStringList(target.why, 3);
        const guidance = toStringList(target.usage_guidance, 3);
        const competitors = asProductRows(target.products?.competitors);
        const dupes = asProductRows(target.products?.dupes);
        return { ingredient, level, why, guidance, competitors, dupes };
      }),
    [targets],
  );

  const onOpenProduct = (row: ProductLike, source: ProductBucket) => {
    const url = productOpenUrl(row);
    const productId = asString(row.product_id) || null;
    const isDiscovery = source === 'external_search_ctas';

    if (analyticsCtx && isDiscovery) {
      emitDiscoveryLinkOpenAttempt(analyticsCtx, {
        card_id: cardId ?? null,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
      });
    } else if (analyticsCtx) {
      emitIngredientProductOpenAttempt(analyticsCtx, {
        card_id: cardId ?? null,
        product_id: productId,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
      });
    }

    const openResult = openWithAnchorFallback(url);

    if (analyticsCtx && isDiscovery) {
      emitDiscoveryLinkOpenResult(analyticsCtx, {
        card_id: cardId ?? null,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
        result: openResult.result,
        blocked_reason: openResult.blockedReason ?? null,
      });
    } else if (analyticsCtx) {
      emitIngredientProductOpenResult(analyticsCtx, {
        card_id: cardId ?? null,
        product_id: productId,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
        result: openResult.result,
        blocked_reason: openResult.blockedReason ?? null,
      });
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3" data-testid="ingredient-plan-v2-card">
      <div className="text-sm font-semibold text-foreground">{labels.title}</div>

      {resolvedVariant === 'v2' && (intensityLabel || intensityExplanation || effectiveTier) ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="text-xs font-semibold text-foreground">
            {language === 'CN' ? `${labels.intensity}：${intensityLabel}` : `${labels.intensity}: ${intensityLabel}`}
          </div>
          {intensityExplanation ? <div className="mt-1 text-xs text-muted-foreground">{intensityExplanation}</div> : null}
          {effectiveTier ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {language === 'CN' ? `${labels.budget}：${effectiveTier}` : `${labels.budget}: ${effectiveTier}`}
              {diversifiedWhenUnknown ? ` ${labels.diversifiedUnknown}` : ''}
            </div>
          ) : null}
        </div>
      ) : null}

      {previewOnly ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{labels.preview}</div>
      ) : null}

      {sections.map((section) => {
        const hasProducts = section.competitors.length > 0 || section.dupes.length > 0;
        return (
          <div key={section.ingredient} className="space-y-3 rounded-2xl border border-border/60 bg-background/85 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-semibold text-foreground">{section.ingredient}</div>
              <div className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                {priorityLabel(section.level, language)}
              </div>
            </div>

            {section.why.length ? (
              <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                {section.why.map((item) => (
                  <li key={`${section.ingredient}_${item}`}>{item}</li>
                ))}
              </ul>
            ) : null}

            {section.guidance.length ? (
              <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{language === 'CN' ? `${labels.usage}：` : `${labels.usage}: `}</span>
                {section.guidance.join(language === 'CN' ? '；' : '; ')}
              </div>
            ) : null}

            {hasProducts ? (
              <div className="space-y-3">
                {section.competitors.length ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">{labels.competitors}</div>
                    <div className="grid grid-cols-1 gap-2">
                      {section.competitors.slice(0, 4).map((row, index) => (
                        <ProductCard
                          key={`${section.ingredient}_competitor_${index}`}
                          row={row}
                          bucket="competitors"
                          language={language}
                          labels={labels}
                          onOpenProduct={onOpenProduct}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {section.dupes.length ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">{labels.dupes}</div>
                    <div className="grid grid-cols-1 gap-2">
                      {section.dupes.slice(0, 3).map((row, index) => (
                        <ProductCard
                          key={`${section.ingredient}_dupe_${index}`}
                          row={row}
                          bucket="dupes"
                          language={language}
                          labels={labels}
                          onOpenProduct={onOpenProduct}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {avoid.length ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{labels.avoidTitle}</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
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
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{labels.conflictsTitle}</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {conflicts.slice(0, 4).map((item, idx) => (
              <li key={`conflict_${idx}`}>{asString(item.description) || asString(item.message)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {externalSearchCtas.length ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-background/85 p-3">
          <div className="text-xs font-medium text-muted-foreground">{labels.search}</div>
          <div className="grid grid-cols-1 gap-2">
            {externalSearchCtas.slice(0, 6).map((row, index) => (
              <ProductCard
                key={`external_search_${index}`}
                row={row}
                bucket="external_search_ctas"
                language={language}
                labels={labels}
                onOpenProduct={onOpenProduct}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
