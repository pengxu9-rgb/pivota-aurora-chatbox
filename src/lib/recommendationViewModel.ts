import type {
  PhotoModulesAction,
  PhotoModulesModule,
  PhotoModulesProduct,
  PhotoModulesExternalSearchCta,
  PhotoModulesIssue,
} from '@/lib/photoModulesContract';
import { buildPdpUrl, extractPdpTargetFromProductGroupId } from '@/lib/pivotaShop';
import type { Language } from '@/lib/types';

// ---------------------------------------------------------------------------
// View-model types
// ---------------------------------------------------------------------------

export type PriorityLabel = 'best_match' | 'strong_match' | 'support_option';

export type EvidenceBadge = {
  label: string;
  level: 'high' | 'moderate' | 'limited';
};

export type UsageChipVm = {
  time: string;
  frequency: string;
  note: string;
};

export type SuitabilityTier = 'high' | 'medium' | 'low';

export type ProductCardVm = {
  productId: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  price: string | null;
  whyPicked: string;
  howToUse: string;
  cautions: string[];
  tags: string[];
  suitabilityTier: SuitabilityTier | null;
  socialProof: { rating: string; reviews: string } | null;
  openUrl: string | null;
  raw: PhotoModulesProduct;
};

export type ProductExampleDiscoveryVm = {
  id: string;
  label: string;
  searchQuery: string;
  searchTitle: string | null;
};

export type IngredientActionVm = {
  ingredientId: string;
  ingredientName: string;
  priority: PriorityLabel;
  why: string;
  concernChips: string[];
  targetArea: string | null;
  usage: UsageChipVm;
  cautions: string[];
  evidence: EvidenceBadge;
  topProducts: ProductCardVm[];
  moreProducts: ProductCardVm[];
  productsEmptyMessage: string | null;
  productsFilteredNote?: string | null;
  productExamples: string[];
  productExampleItems: ProductExampleDiscoveryVm[];
  productExamplesLabel?: string | null;
  productExamplesNote?: string | null;
  externalSearchCtas: { title: string; url: string }[];
  rawAction: PhotoModulesAction;
};

export type ConcernSummaryVm = {
  primaryConcern: string;
  secondaryConcerns: string[];
};

export type ModuleRecommendationVm = {
  moduleId: string;
  concernSummary: ConcernSummaryVm;
  actions: IngredientActionVm[];
};

export type RecommendationDisplayOptions = {
  productsEnabled?: boolean;
  expandedProductsEnabled?: boolean;
};

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const ISSUE_TYPE_LABELS: Record<string, Record<Language, string>> = {
  redness: { EN: 'Redness', CN: '泛红' },
  tone: { EN: 'Tone', CN: '肤色' },
  acne: { EN: 'Acne', CN: '痘痘' },
  shine: { EN: 'Shine', CN: '出油' },
  texture: { EN: 'Texture', CN: '纹理' },
};

const MODULE_AREA_LABELS: Record<string, Record<Language, string>> = {
  forehead: { EN: 'forehead', CN: '额头' },
  left_cheek: { EN: 'left cheek', CN: '左脸颊' },
  right_cheek: { EN: 'right cheek', CN: '右脸颊' },
  nose: { EN: 'nose', CN: '鼻子' },
  chin: { EN: 'chin', CN: '下巴' },
  under_eye_left: { EN: 'left under-eye', CN: '左眼下' },
  under_eye_right: { EN: 'right under-eye', CN: '右眼下' },
};

const SEVERITY_LABELS: Record<number, Record<Language, string>> = {
  0: { EN: 'Minimal', CN: '极轻' },
  1: { EN: 'Mild', CN: '轻微' },
  2: { EN: 'Moderate', CN: '中等' },
  3: { EN: 'Noticeable', CN: '明显' },
  4: { EN: 'Significant', CN: '显著' },
};

const TIME_LABELS: Record<string, Record<Language, string>> = {
  AM: { EN: 'AM only', CN: '仅早间' },
  PM: { EN: 'PM only', CN: '仅晚间' },
  AM_PM: { EN: 'AM + PM', CN: '早晚' },
};

const FREQUENCY_LABELS: Record<string, Record<Language, string>> = {
  daily: { EN: 'Daily', CN: '每日' },
  '2-3x_week': { EN: '2-3x per week', CN: '每周 2-3 次' },
  weekly: { EN: 'Weekly', CN: '每周一次' },
};

const PRIORITY_LABELS: Record<PriorityLabel, Record<Language, string>> = {
  best_match: { EN: 'Best match', CN: '最佳匹配' },
  strong_match: { EN: 'Strong match', CN: '强力匹配' },
  support_option: { EN: 'Support option', CN: '辅助选项' },
};

const EVIDENCE_LABELS: Record<EvidenceBadge['level'], Record<Language, string>> = {
  high: { EN: 'Well-supported', CN: '证据充分' },
  moderate: { EN: 'Moderate evidence', CN: '中等证据' },
  limited: { EN: 'Limited evidence', CN: '有限证据' },
};

const NON_SKINCARE_CATEGORY_PATTERNS = [
  'brush', 'tool', 'accessory', 'device', 'sponge', 'bag', 'case',
  'mirror', 'towel', 'headband', 'applicator', 'pouch', 'kit',
];

const TOP_PRODUCTS_LIMIT = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getIssueTypeLabel(issueType: string, language: Language): string {
  return ISSUE_TYPE_LABELS[issueType]?.[language] ?? issueType;
}

export function getModuleAreaLabel(moduleId: string, language: Language): string {
  return MODULE_AREA_LABELS[moduleId]?.[language] ?? moduleId;
}

export function getSeverityLabel(severity04: number, language: Language): string {
  const clamped = Math.max(0, Math.min(4, Math.round(severity04)));
  return SEVERITY_LABELS[clamped]?.[language] ?? String(clamped);
}

export function getPriorityLabelText(priority: PriorityLabel, language: Language): string {
  return PRIORITY_LABELS[priority][language];
}

export function getEvidenceLabelText(level: EvidenceBadge['level'], language: Language): string {
  return EVIDENCE_LABELS[level][language];
}

function scoreIssueForConcernSummary(issue: PhotoModulesIssue): number {
  if (issue.issue_rank_score != null) {
    const rank = Number(issue.issue_rank_score);
    if (Number.isFinite(rank)) return rank;
  }
  return issue.severity_0_4 * 0.7 + issue.confidence_0_1 * 0.3;
}

// ---------------------------------------------------------------------------
// Concern summary
// ---------------------------------------------------------------------------

export function mapConcernSummary(module: PhotoModulesModule, language: Language): ConcernSummaryVm {
  const sortedIssues = [...module.issues].sort(
    (a, b) => scoreIssueForConcernSummary(b) - scoreIssueForConcernSummary(a),
  );

  const areaLabel = getModuleAreaLabel(module.module_id, language);

  if (sortedIssues.length === 0) {
    const noIssue = language === 'CN' ? `${areaLabel}暂无明显问题` : `No notable concerns on ${areaLabel}`;
    return { primaryConcern: noIssue, secondaryConcerns: [] };
  }

  const topIssue = sortedIssues[0];
  const topIssueLabel = getIssueTypeLabel(topIssue.issue_type, language);
  const primaryConcern =
    language === 'CN'
      ? `重点关注：${areaLabel} ${topIssueLabel}`
      : `Focus area: ${topIssueLabel} on ${areaLabel}`;

  const secondaryConcerns = sortedIssues
    .slice(1)
    .map((issue) => {
      const label = getIssueTypeLabel(issue.issue_type, language);
      return language === 'CN' ? `${label}辅助` : `${label} support`;
    });

  return { primaryConcern, secondaryConcerns };
}

// ---------------------------------------------------------------------------
// Priority label
// ---------------------------------------------------------------------------

export function mapPriorityLabel(action: PhotoModulesAction): PriorityLabel {
  if (action.group === 'top') {
    const score = action.action_rank_score ?? 0;
    return score >= 0.5 ? 'best_match' : 'strong_match';
  }
  return 'support_option';
}

// ---------------------------------------------------------------------------
// Evidence badge
// ---------------------------------------------------------------------------

export function mapEvidenceBadge(action: PhotoModulesAction): EvidenceBadge {
  const whyLower = (action.why || '').toLowerCase();
  const hasLimitedSignal =
    whyLower.includes('limited') ||
    whyLower.includes('still limited') ||
    whyLower.includes('有限') ||
    whyLower.includes('证据强度有限');

  if (hasLimitedSignal) {
    return { label: '', level: 'limited' };
  }

  const products = action.products || [];
  if (products.length > 0) {
    const grades = products
      .map((product) => String(product.evidence?.evidence_grade ?? '').trim().toUpperCase())
      .filter(Boolean);

    if (grades.includes('A')) return { label: '', level: 'high' };
    if (grades.includes('B')) return { label: '', level: 'moderate' };
  }

  return { label: '', level: 'limited' };
}

// ---------------------------------------------------------------------------
// Usage chips
// ---------------------------------------------------------------------------

export function mapUsageChips(action: PhotoModulesAction, language: Language): UsageChipVm {
  const time = TIME_LABELS[action.how_to_use.time]?.[language] ?? action.how_to_use.time;
  const frequency = FREQUENCY_LABELS[action.how_to_use.frequency]?.[language] ?? action.how_to_use.frequency;
  const note = (action.how_to_use.notes || '').trim();
  return { time, frequency, note };
}

// ---------------------------------------------------------------------------
// Concern chips
// ---------------------------------------------------------------------------

export function mapConcernChips(action: PhotoModulesAction, language: Language): string[] {
  return (action.evidence_issue_types || []).map((t) => getIssueTypeLabel(t, language));
}

// ---------------------------------------------------------------------------
// Target area
// ---------------------------------------------------------------------------

export function mapTargetArea(moduleId: string, language: Language): string | null {
  const area = MODULE_AREA_LABELS[moduleId];
  if (!area) return null;
  return language === 'CN'
    ? `与${area.CN}最相关`
    : `Most relevant for ${area.EN}`;
}

// ---------------------------------------------------------------------------
// Product filtering / scoring
// ---------------------------------------------------------------------------

export function isRenderableSkincareProduct(product: PhotoModulesProduct): boolean {
  const category = (
    (product as Record<string, unknown>).category as string || ''
  ).toLowerCase();

  if (!category) return true;
  return !NON_SKINCARE_CATEGORY_PATTERNS.some((pattern) => category.includes(pattern));
}

export function scoreProductCardRichness(product: PhotoModulesProduct): number {
  let score = 0;
  if (product.image_url) score += 3;
  if (product.price != null && Number.isFinite(product.price)) score += 2;
  if (product.why_match) score += 2;
  if (product.suitability_score != null && product.suitability_score > 0.3) score += 1;
  if (product.social_proof) score += 1;
  return score;
}

function normalizeForDedup(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function dedupeProducts(products: PhotoModulesProduct[]): PhotoModulesProduct[] {
  const seen = new Map<string, PhotoModulesProduct>();
  for (const product of products) {
    const brand = normalizeForDedup(product.brand || '');
    const name = normalizeForDedup(product.title || '');
    const key = `${brand}::${name}`;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, product);
      continue;
    }
    if (scoreProductCardRichness(product) > scoreProductCardRichness(existing)) {
      seen.set(key, product);
    }
  }
  return Array.from(seen.values());
}

export function filterAndRankProducts(
  products: PhotoModulesProduct[],
): { top: PhotoModulesProduct[]; more: PhotoModulesProduct[] } {
  const skincare = products.filter(isRenderableSkincareProduct);
  const deduped = dedupeProducts(skincare);

  const sorted = deduped.sort((a, b) => {
    const suitDiff = (b.suitability_score ?? 0) - (a.suitability_score ?? 0);
    if (Math.abs(suitDiff) > 0.001) return suitDiff;
    return scoreProductCardRichness(b) - scoreProductCardRichness(a);
  });

  return {
    top: sorted.slice(0, TOP_PRODUCTS_LIMIT),
    more: sorted.slice(TOP_PRODUCTS_LIMIT),
  };
}

// ---------------------------------------------------------------------------
// Product card VM
// ---------------------------------------------------------------------------

function formatPrice(product: PhotoModulesProduct): string | null {
  const label = (product.price_label || '').trim();
  if (label) return label;
  if (product.price == null || !Number.isFinite(product.price)) return null;
  const currency = (product.currency || '').trim().toUpperCase();
  const amount = product.price;
  if (currency === 'USD' || currency === '$') return `$${amount.toFixed(2)}`;
  if (currency === 'CNY' || currency === 'RMB' || currency === '¥') return `¥${amount.toFixed(2)}`;
  if (currency === 'EUR' || currency === '€') return `€${amount.toFixed(2)}`;
  if (currency === 'GBP' || currency === '£') return `£${amount.toFixed(2)}`;
  if (currency) return `${currency} ${amount.toFixed(2)}`;
  return `$${amount.toFixed(2)}`;
}

function deriveSuitabilityTier(product: PhotoModulesProduct): SuitabilityTier | null {
  const score = product.suitability_score;
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 0.6) return 'high';
  if (score >= 0.35) return 'medium';
  return 'low';
}

function deriveSocialProof(product: PhotoModulesProduct): ProductCardVm['socialProof'] {
  const sp = product.social_proof;
  if (!sp) return null;
  const rating = sp.rating != null && Number.isFinite(sp.rating) ? sp.rating.toFixed(1) : '';
  const reviews = sp.review_count != null && Number.isFinite(sp.review_count)
    ? String(sp.review_count)
    : '';
  if (!rating && !reviews) return null;
  return { rating, reviews };
}

function deriveProductTags(product: PhotoModulesProduct, language: Language): string[] {
  const tags: string[] = [];
  const benefitTags = (product.benefit_tags || []).slice(0, 3);
  for (const tag of benefitTags) {
    const t = tag.trim();
    if (t && !t.toLowerCase().includes('external') && !t.toLowerCase().includes('seed')) {
      tags.push(t);
    }
  }
  if (product.price != null && Number.isFinite(product.price) && product.price < 20) {
    tags.push(language === 'CN' ? '性价比高' : 'Budget-friendly');
  }
  return tags.slice(0, 4);
}

function productOpenUrl(product: PhotoModulesProduct): string | null {
  const url = (product.product_url || '').trim();
  if (url && /^https?:\/\//i.test(url)) return url;
  if (product.canonical_product_ref?.product_id) {
    return buildPdpUrl({
      product_id: product.canonical_product_ref.product_id,
      merchant_id: product.canonical_product_ref.merchant_id || undefined,
    });
  }
  const targetFromGroup = extractPdpTargetFromProductGroupId(product.product_group_id);
  if (targetFromGroup?.product_id) return buildPdpUrl(targetFromGroup);
  return null;
}

export function mapProductCard(product: PhotoModulesProduct, language: Language): ProductCardVm {
  return {
    productId: product.product_id,
    name: (product.title || '').trim(),
    brand: (product.brand || '').trim(),
    imageUrl: (product.image_url || '').trim() || null,
    price: formatPrice(product),
    whyPicked: (product.why_match || '').trim(),
    howToUse: (product.how_to_use || '').trim(),
    cautions: (product.cautions || []).filter(Boolean).slice(0, 3),
    tags: deriveProductTags(product, language),
    suitabilityTier: deriveSuitabilityTier(product),
    socialProof: deriveSocialProof(product),
    openUrl: productOpenUrl(product),
    raw: product,
  };
}

// ---------------------------------------------------------------------------
// Products-empty message
// ---------------------------------------------------------------------------

function mapProductsEmptyMessage(
  action: PhotoModulesAction,
  filteredCount: number,
  language: Language,
): string | null {
  if (filteredCount > 0) return null;

  const reason = (action.products_empty_reason || '').trim();

  if (reason) {
    if (reason === 'low_evidence') {
      return language === 'CN'
        ? '当前证据强度有限，暂不直推商品。可先查看外部搜索建议。'
        : 'Evidence strength is limited for direct product recommendations right now.';
    }
    return language === 'CN'
      ? '该成分值得关注，但暂无匹配度足够高的商品推荐。'
      : 'We found this ingredient to be relevant, but do not yet have strong product matches.';
  }

  return language === 'CN'
    ? '暂无匹配度足够高的商品推荐。'
    : 'No strong product matches available at this time.';
}

// ---------------------------------------------------------------------------
// Ingredient action VM
// ---------------------------------------------------------------------------

export function mapIngredientAction(
  action: PhotoModulesAction,
  moduleId: string,
  language: Language,
): IngredientActionVm {
  const { top, more } = filterAndRankProducts(action.products || []);
  const topProducts = top.map((p) => mapProductCard(p, language));
  const moreProducts = more.map((p) => mapProductCard(p, language));

  const externalCtas = (action.external_search_ctas || [])
    .filter((cta): cta is PhotoModulesExternalSearchCta => Boolean(cta.title && cta.url))
    .slice(0, 4)
    .map((cta) => ({ title: cta.title, url: cta.url }));

  const allFilteredCount = topProducts.length + moreProducts.length;
  const emptyMessage = mapProductsEmptyMessage(action, allFilteredCount, language);

  return {
    ingredientId: action.ingredient_id,
    ingredientName: action.ingredient_name,
    priority: mapPriorityLabel(action),
    why: (action.why || '').trim(),
    concernChips: mapConcernChips(action, language),
    targetArea: mapTargetArea(moduleId, language),
    usage: mapUsageChips(action, language),
    cautions: (action.cautions || []).filter(Boolean).slice(0, 4),
    evidence: mapEvidenceBadge(action),
    topProducts,
    moreProducts,
    productsEmptyMessage: emptyMessage,
    productsFilteredNote: null,
    productExamples: [],
    productExampleItems: [],
    productExamplesLabel: null,
    productExamplesNote: null,
    externalSearchCtas: externalCtas,
    rawAction: action,
  };
}

// ---------------------------------------------------------------------------
// Top-level module mapper
// ---------------------------------------------------------------------------

export function mapModuleToRecommendationVm(
  module: PhotoModulesModule,
  language: Language,
): ModuleRecommendationVm {
  const concernSummary = mapConcernSummary(module, language);

  const actions = (module.actions || []).map((action) =>
    mapIngredientAction(action, module.module_id, language),
  );

  return {
    moduleId: module.module_id,
    concernSummary,
    actions,
  };
}

export function applyRecommendationDisplayOptions(
  vm: ModuleRecommendationVm,
  options: RecommendationDisplayOptions = {},
): ModuleRecommendationVm {
  const {
    productsEnabled = true,
    expandedProductsEnabled = true,
  } = options;

  if (productsEnabled && expandedProductsEnabled) {
    return vm;
  }

  return {
    ...vm,
    actions: vm.actions.map((action) => ({
      ...action,
      topProducts: productsEnabled ? action.topProducts : [],
      moreProducts: productsEnabled && expandedProductsEnabled ? action.moreProducts : [],
      productsEmptyMessage: productsEnabled ? action.productsEmptyMessage : null,
      productsFilteredNote: productsEnabled ? action.productsFilteredNote : null,
      externalSearchCtas: productsEnabled ? action.externalSearchCtas : [],
    })),
  };
}

// ---------------------------------------------------------------------------
// Issue-level label helpers (for the issue detection section cleanup)
// ---------------------------------------------------------------------------

export function humanizeRegionId(regionId: string, language: Language): string {
  const lower = regionId.toLowerCase();

  for (const [moduleKey, labels] of Object.entries(MODULE_AREA_LABELS)) {
    if (lower.includes(moduleKey)) {
      return labels[language];
    }
  }

  for (const [issueKey, labels] of Object.entries(ISSUE_TYPE_LABELS)) {
    if (lower.includes(issueKey)) {
      return language === 'CN' ? `${labels.CN}区域` : `${labels.EN} area`;
    }
  }

  if (lower.includes('heatmap')) {
    const prefix = lower.replace(/_?heatmap.*/, '').replace(/^pf_/, '');
    const parts = prefix.split('_').filter(Boolean);
    if (parts.length > 0) {
      const issueLabel = ISSUE_TYPE_LABELS[parts[0]];
      if (issueLabel) {
        return language === 'CN' ? `${issueLabel.CN}热力区` : `${issueLabel.EN} region`;
      }
    }
  }

  return language === 'CN' ? '检测区域' : 'Detected area';
}

export function humanizeIssueForSummary(issue: PhotoModulesIssue, moduleId: string, language: Language): string {
  const issueLabel = getIssueTypeLabel(issue.issue_type, language);
  const areaLabel = getModuleAreaLabel(moduleId, language);
  const severityLabel = getSeverityLabel(issue.severity_0_4, language);

  return language === 'CN'
    ? `${areaLabel} · ${issueLabel} · ${severityLabel}`
    : `${issueLabel} on ${areaLabel} · ${severityLabel}`;
}
