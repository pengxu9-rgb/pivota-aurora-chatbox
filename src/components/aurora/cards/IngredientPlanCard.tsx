import React, { useMemo } from 'react';

import { RecommendationSection } from '@/components/aurora/cards/RecommendationSection';
import {
  emitDiscoveryLinkOpenAttempt,
  emitDiscoveryLinkOpenResult,
  emitIngredientProductOpenAttempt,
  emitIngredientProductOpenResult,
  type AnalyticsContext,
} from '@/lib/auroraAnalytics';
import type {
  PhotoModulesAction,
  PhotoModulesExternalSearchCta,
  PhotoModulesProduct,
} from '@/lib/photoModulesContract';
import {
  filterAndRankProducts,
  mapProductCard,
  type ModuleRecommendationVm,
  type PriorityLabel,
} from '@/lib/recommendationViewModel';
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
  image_url?: string;
  thumb_url?: string;
  benefit_tags?: unknown;
  cautions?: unknown;
  how_to_use?: unknown;
  price_label?: unknown;
  rating_value?: unknown;
  rating_count?: unknown;
  social_proof?: {
    rating?: unknown;
    review_count?: unknown;
    summary?: unknown;
  };
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
type SyntheticPlanProduct = PhotoModulesProduct & { category?: string; __planBucket?: ProductBucket };

const PLAN_MODULE_ID = 'ingredient_plan_v2';

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

const NON_SKINCARE_PRODUCT_PATTERNS = [
  'lip gloss',
  'lipstick',
  'lip cream',
  'lip stain',
  'mascara',
  'foundation',
  'concealer',
  'eyeshadow',
  'eyeliner',
  'highlighter',
  'bronzer',
  'blush',
  'palette',
  'powder',
  'fragrance',
  'perfume',
  'body mist',
  'hair mask',
  'shampoo',
  'conditioner',
  'nail polish',
  'diamond veil',
];

const SKINCARE_PRODUCT_HINTS = [
  'spf',
  'sunscreen',
  'serum',
  'moisturizer',
  'moisturiser',
  'cream',
  'cleanser',
  'lotion',
  'balm',
  'gel',
  'essence',
  'ampoule',
  'fluid',
  'emulsion',
  'mask',
  'treatment',
  'niacinamide',
  'retinol',
  'vitamin c',
  'ceramide',
  'panthenol',
  'azelaic',
  'peptide',
  'cica',
];

function normalizeDedupKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function productText(row: ProductLike): string {
  return [
    row.title,
    row.name,
    row.brand,
    row.source,
    row.source_block,
    row.why_match,
  ]
    .map(asString)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isLikelySkincareProduct(row: ProductLike): boolean {
  const haystack = productText(row);
  if (!haystack) return true;
  return !NON_SKINCARE_PRODUCT_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function scoreProductRowRichness(row: ProductLike): number {
  let score = 0;
  const haystack = productText(row);
  if (SKINCARE_PRODUCT_HINTS.some((pattern) => haystack.includes(pattern))) score += 3;
  if (productOpenUrl(row)) score += 2;
  if (asNumber(row.price) != null) score += 1;
  if (asString(row.why_match)) score += 2;
  if (asString(row.source_block).toLowerCase() === 'competitor') score += 1;
  return score;
}

function dedupeProductRows(rows: ProductLike[]): ProductLike[] {
  const seen = new Map<string, ProductLike>();
  for (const row of rows) {
    const key = `${normalizeDedupKey(asString(row.brand))}::${normalizeDedupKey(asString(row.title || row.name))}`;
    const existing = seen.get(key);
    if (!existing || scoreProductRowRichness(row) > scoreProductRowRichness(existing)) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

function filterAndSortProductRows(rows: ProductLike[]): ProductLike[] {
  return dedupeProductRows(rows.filter(isLikelySkincareProduct)).sort(
    (a, b) => scoreProductRowRichness(b) - scoreProductRowRichness(a),
  );
}

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

function mapPlanPriority(levelToken: string, score: number | null): PriorityLabel {
  const normalized = normalizePriorityLevel(levelToken, score);
  if (normalized === 'high') return 'best_match';
  if (normalized === 'medium') return 'strong_match';
  return 'support_option';
}

function toStableId(prefix: string, value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized ? `${prefix}_${normalized}` : `${prefix}_item`;
}

function parseUsageGuidance(guidance: string[], language: Language): { time: string; frequency: string; note: string } {
  const joined = guidance.filter(Boolean).join(language === 'CN' ? '；' : '; ');
  if (!joined) return { time: '', frequency: '', note: '' };

  const lower = joined.toLowerCase();
  const time =
    /am\/pm|am and pm|morning and evening|day and night|早晚/.test(lower)
      ? language === 'CN'
        ? '早晚'
        : 'AM + PM'
      : /\bpm\b|night|evening|晚/.test(lower)
        ? language === 'CN'
          ? '仅晚间'
          : 'PM only'
        : /\bam\b|morning|早/.test(lower)
          ? language === 'CN'
            ? '仅早间'
            : 'AM only'
          : '';

  const frequency =
    /2-3x|2-3 x|2 to 3 times|2-3 times|2-3次|每周 ?2-3/.test(lower)
      ? language === 'CN'
        ? '每周 2-3 次'
        : '2-3x per week'
      : /weekly|once a week|每周一次/.test(lower)
        ? language === 'CN'
          ? '每周一次'
          : 'Weekly'
        : /daily|every day|daily am|daily pm|每天|每日/.test(lower)
          ? language === 'CN'
            ? '每日'
            : 'Daily'
          : '';

  return { time, frequency, note: joined };
}

function getProductsEmptyMessage(hasCandidates: boolean, language: Language): string | null {
  if (!hasCandidates) {
    return language === 'CN'
      ? '暂无匹配度足够高的商品推荐。'
      : 'No strong product matches available at this time.';
  }

  return language === 'CN'
    ? '当前仅保留了更相关的护肤候选，暂未形成可展示商品。'
    : 'Only skincare-relevant candidates were kept, but none were strong enough to display.';
}

function toSyntheticProduct(
  row: ProductLike,
  bucket: Exclude<ProductBucket, 'external_search_ctas'>,
  guidanceText: string,
  language: Language,
): SyntheticPlanProduct {
  const title = asString(row.title || row.name) || (language === 'CN' ? '推荐商品' : 'Recommended product');
  const refTarget = readRefTarget(row.product_ref) || readRefTarget(row.canonical_product_ref);
  const productId =
    asString(row.product_id) ||
    refTarget?.product_id ||
    extractPdpTargetFromProductGroupId(asString(row.product_group_id) || asString(row.subject_product_group_id))?.product_id ||
    toStableId('product', title);
  const merchantId = asString(row.merchant_id) || refTarget?.merchant_id || '';
  const rating = asNumber(row.social_proof?.rating ?? row.rating_value);
  const reviewCount = asNumber(row.social_proof?.review_count ?? row.rating_count);
  const benefitTags = toStringList(row.benefit_tags, 4);
  const tags = bucket === 'dupes'
    ? [language === 'CN' ? '辅助选项' : 'Support option', ...benefitTags]
    : benefitTags;

  return {
    product_id: productId,
    merchant_id: merchantId,
    product_group_id: asString(row.product_group_id),
    canonical_product_ref: refTarget
      ? {
          product_id: refTarget.product_id,
          merchant_id: refTarget.merchant_id || '',
        }
      : null,
    title,
    brand: asString(row.brand),
    image_url: asString(row.image_url || row.thumb_url),
    benefit_tags: tags.slice(0, 4),
    price: asNumber(row.price),
    currency: asString(row.currency || 'USD').toUpperCase(),
    price_label: asString(row.price_label),
    social_proof:
      rating != null || reviewCount != null
        ? {
            rating,
            review_count: reviewCount,
            summary: asString(row.social_proof?.summary),
          }
        : null,
    evidence: null,
    why_match: asString(row.why_match),
    how_to_use: asString(row.how_to_use) || guidanceText,
    cautions: toStringList(row.cautions, 3),
    product_url: productOpenUrl(row),
    retrieval_source: asString(row.source),
    retrieval_reason: bucket,
    suitability_score: bucket === 'competitors' ? 0.85 : 0.45,
    category: productText(row),
    __planBucket: bucket,
  };
}

function buildSyntheticAction(target: IngredientTargetLike): PhotoModulesAction {
  const ingredientName =
    asString(target.ingredient_name) ||
    asString(target.ingredient) ||
    asString(target.display_name) ||
    'Ingredient';
  const ingredientId = asString(target.ingredient_id) || toStableId('ingredient', ingredientName);
  const whyList = toStringList(target.why, 3);
  const guidanceList = toStringList(target.usage_guidance, 3);
  const guidanceText = guidanceList.join('; ');
  const filteredCompetitors = filterAndSortProductRows(asProductRows(target.products?.competitors));
  const filteredDupes = filterAndSortProductRows(asProductRows(target.products?.dupes));
  const products = [
    ...filteredCompetitors.map((row) => toSyntheticProduct(row, 'competitors', guidanceText, 'EN')),
    ...filteredDupes.map((row) => toSyntheticProduct(row, 'dupes', guidanceText, 'EN')),
  ];

  return {
    action_type: 'ingredient',
    ingredient_id: ingredientId,
    ingredient_canonical_id: null,
    ingredient_name: ingredientName,
    why: whyList[0] || '',
    how_to_use: {
      time: 'AM_PM',
      frequency: 'daily',
      notes: guidanceText,
    },
    cautions: [],
    action_rank_score: asNumber(target.priority_score_0_100),
    group: null,
    evidence_issue_types: [],
    timeline: '',
    do_not_mix: [],
    products,
    products_empty_reason: null,
    external_search_ctas: [],
    rec_debug: null,
  };
}

function buildRecommendationVm(
  payload: Record<string, unknown>,
  language: Language,
  filteredProductsLabel: string,
): ModuleRecommendationVm {
  const targets = asTargets(payload.targets);

  return {
    moduleId: PLAN_MODULE_ID,
    concernSummary: { primaryConcern: '', secondaryConcerns: [] },
    actions: targets.map((target, index) => {
      const ingredientName =
        asString(target.ingredient_name) ||
        asString(target.ingredient) ||
        asString(target.display_name) ||
        `${language === 'CN' ? '成分' : 'Ingredient'} ${index + 1}`;
      const ingredientId = asString(target.ingredient_id) || toStableId('ingredient', ingredientName);
      const score = asNumber(target.priority_score_0_100);
      const why = toStringList(target.why, 3);
      const guidance = toStringList(target.usage_guidance, 3);
      const usage = parseUsageGuidance(guidance, language);
      const rawCompetitors = asProductRows(target.products?.competitors);
      const rawDupes = asProductRows(target.products?.dupes);
      const filteredCompetitors = filterAndSortProductRows(rawCompetitors);
      const filteredDupes = filterAndSortProductRows(rawDupes);
      const guidanceText = guidance.join(language === 'CN' ? '；' : '; ');
      const syntheticProducts = [
        ...filteredCompetitors.map((row) => toSyntheticProduct(row, 'competitors', guidanceText, language)),
        ...filteredDupes.map((row) => toSyntheticProduct(row, 'dupes', guidanceText, language)),
      ];
      const { top, more } = filterAndRankProducts(syntheticProducts);
      const filteredCount = rawCompetitors.length + rawDupes.length - syntheticProducts.length;
      const rawAction = buildSyntheticAction(target);

      return {
        ingredientId,
        ingredientName,
        priority: mapPlanPriority(asString(target.priority_level), score),
        why: why.join(language === 'CN' ? '；' : '; '),
        concernChips: [],
        targetArea: null,
        usage,
        cautions: [],
        evidence: {
          label: '',
          level: 'limited' as const,
        },
        topProducts: top.map((product) => mapProductCard(product, language)),
        moreProducts: more.map((product) => mapProductCard(product, language)),
        productsEmptyMessage: syntheticProducts.length > 0 ? null : getProductsEmptyMessage(rawCompetitors.length + rawDupes.length > 0, language),
        productsFilteredNote: filteredCount > 0 ? filteredProductsLabel : null,
        externalSearchCtas: [],
        rawAction,
      };
    }),
  };
}

function mapFooterExternalSearchCtas(payload: Record<string, unknown>): PhotoModulesExternalSearchCta[] {
  return asProductRows(payload.external_search_ctas)
    .map((row) => {
      const title = asString(row.title || row.name);
      const url = productOpenUrl(row);
      if (!title || !url) return null;
      return {
        title,
        url,
        source: asString(row.source),
        reason: asString(row.source_block),
      };
    })
    .filter(Boolean) as PhotoModulesExternalSearchCta[];
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
          preview: '补全 AM/PM routine 后将解锁个性化产品推荐。',
          intensity: '方案强度',
          budget: '预算偏好',
          diversifiedUnknown: '（未知时已做价位分散）',
          avoidTitle: '需规避/谨慎',
          conflictsTitle: '冲突说明',
          filteredProducts: '已隐藏明显非护肤候选，保留更相关的护肤商品。',
        }
      : {
          preview: 'Complete AM/PM routine to unlock personalized product picks.',
          intensity: 'Plan strength',
          budget: 'Budget context',
          diversifiedUnknown: '(diversified for unknown budget)',
          avoidTitle: 'Avoid / caution',
          conflictsTitle: 'Conflicts',
          filteredProducts: 'Obvious non-skincare candidates were hidden to keep these picks skincare-relevant.',
        };

  const vm = useMemo(
    () => buildRecommendationVm(payload, language, labels.filteredProducts),
    [payload, language, labels.filteredProducts],
  );

  const footerExternalSearchCtas = useMemo(() => mapFooterExternalSearchCtas(payload), [payload]);

  const onOpenProduct = ({
    product,
  }: {
    moduleId: string;
    action: PhotoModulesAction;
    product: PhotoModulesProduct;
    productIndex: number;
  }) => {
    const url = asString(product.product_url);
    const productId = asString(product.product_id) || null;
    const source = ((product as SyntheticPlanProduct).__planBucket || 'competitors') as ProductBucket;

    if (analyticsCtx) {
      emitIngredientProductOpenAttempt(analyticsCtx, {
        card_id: cardId ?? null,
        product_id: productId,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: source,
        url: url || null,
      });
    }

    const openResult = openWithAnchorFallback(url);

    if (analyticsCtx) {
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

  const onOpenExternalSearch = ({
    cta,
  }: {
    moduleId: string;
    action: PhotoModulesAction | null;
    cta: { title: string; url: string };
    ctaIndex: number;
  }) => {
    if (analyticsCtx) {
      emitDiscoveryLinkOpenAttempt(analyticsCtx, {
        card_id: cardId ?? null,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: 'external_search_ctas',
        url: cta.url || null,
      });
    }

    const openResult = openWithAnchorFallback(cta.url);

    if (analyticsCtx) {
      emitDiscoveryLinkOpenResult(analyticsCtx, {
        card_id: cardId ?? null,
        source_card_type: 'ingredient_plan_v2',
        source_bucket: 'external_search_ctas',
        url: cta.url || null,
        result: openResult.result,
        blocked_reason: openResult.blockedReason ?? null,
      });
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3" data-testid="ingredient-plan-v2-card">
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

      <RecommendationSection
        vm={vm}
        language={language}
        showConcernSummary={false}
        alwaysShowExternalSearchCtas
        footerExternalSearchCtas={footerExternalSearchCtas}
        onOpenProduct={onOpenProduct}
        onOpenExternalSearch={onOpenExternalSearch}
      />

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
    </div>
  );
}
