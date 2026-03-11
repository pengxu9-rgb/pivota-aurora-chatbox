import { describe, it, expect } from 'vitest';
import type { PhotoModulesAction, PhotoModulesModule, PhotoModulesProduct } from '@/lib/photoModulesContract';
import {
  mapConcernSummary,
  mapPriorityLabel,
  mapEvidenceBadge,
  mapUsageChips,
  mapConcernChips,
  mapTargetArea,
  mapProductCard,
  isRenderableSkincareProduct,
  scoreProductCardRichness,
  dedupeProducts,
  filterAndRankProducts,
  mapModuleToRecommendationVm,
  applyRecommendationDisplayOptions,
  getSeverityLabel,
  humanizeRegionId,
  getIssueTypeLabel,
  getModuleAreaLabel,
} from '@/lib/recommendationViewModel';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<PhotoModulesProduct> = {}): PhotoModulesProduct {
  return {
    product_id: 'prod_1',
    merchant_id: 'merch_1',
    product_group_id: '',
    canonical_product_ref: null,
    title: 'Test Serum',
    brand: 'TestBrand',
    image_url: '',
    benefit_tags: [],
    price: null,
    currency: '',
    price_label: '',
    social_proof: null,
    evidence: null,
    why_match: '',
    how_to_use: '',
    cautions: [],
    product_url: '',
    retrieval_source: 'catalog',
    retrieval_reason: 'catalog_evidence_match',
    suitability_score: null,
    ...overrides,
  };
}

function makeAction(overrides: Partial<PhotoModulesAction> = {}): PhotoModulesAction {
  return {
    action_type: 'ingredient',
    ingredient_id: 'niacinamide',
    ingredient_canonical_id: 'niacinamide',
    ingredient_name: 'Niacinamide',
    why: 'Helps improve the appearance of uneven tone.',
    how_to_use: { time: 'AM_PM', frequency: 'daily', notes: 'Start low and slow.' },
    cautions: ['Pause if stinging lasts more than 10 minutes.'],
    action_rank_score: 0.654,
    group: 'top',
    evidence_issue_types: ['tone', 'redness'],
    timeline: '',
    do_not_mix: [],
    products: [],
    products_empty_reason: null,
    external_search_ctas: [],
    rec_debug: null,
    ...overrides,
  };
}

function makeModule(overrides: Partial<PhotoModulesModule> = {}): PhotoModulesModule {
  return {
    module_id: 'forehead',
    issues: [
      {
        issue_type: 'tone',
        severity_0_4: 2.5,
        confidence_0_1: 0.7,
        issue_rank_score: 0.65,
        confidence_bucket: 'high',
        evidence_region_ids: ['pf_tone_4_heatmap'],
        explanation_short: 'Uneven tone detected on forehead area.',
      },
      {
        issue_type: 'redness',
        severity_0_4: 1.2,
        confidence_0_1: 0.4,
        issue_rank_score: 0.35,
        confidence_bucket: 'medium',
        evidence_region_ids: ['pf_redness_1_heatmap'],
        explanation_short: 'Mild redness detected.',
      },
    ],
    actions: [makeAction()],
    module_rank_score: 0.6,
    products: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

describe('getIssueTypeLabel', () => {
  it('returns English label for known issue', () => {
    expect(getIssueTypeLabel('tone', 'EN')).toBe('Tone');
  });

  it('returns Chinese label for known issue', () => {
    expect(getIssueTypeLabel('redness', 'CN')).toBe('泛红');
  });

  it('returns raw string for unknown issue', () => {
    expect(getIssueTypeLabel('unknown_issue', 'EN')).toBe('unknown_issue');
  });
});

describe('getModuleAreaLabel', () => {
  it('returns English label for known module', () => {
    expect(getModuleAreaLabel('forehead', 'EN')).toBe('forehead');
  });

  it('returns Chinese label', () => {
    expect(getModuleAreaLabel('left_cheek', 'CN')).toBe('左脸颊');
  });

  it('returns raw id for unknown module', () => {
    expect(getModuleAreaLabel('unknown_area', 'EN')).toBe('unknown_area');
  });
});

describe('getSeverityLabel', () => {
  it('maps 0 to Minimal', () => {
    expect(getSeverityLabel(0, 'EN')).toBe('Minimal');
  });

  it('maps 2 to Moderate', () => {
    expect(getSeverityLabel(2, 'EN')).toBe('Moderate');
  });

  it('maps 4 to Significant', () => {
    expect(getSeverityLabel(4, 'EN')).toBe('Significant');
  });

  it('rounds fractional severity', () => {
    expect(getSeverityLabel(2.7, 'EN')).toBe('Noticeable');
  });

  it('clamps values above 4', () => {
    expect(getSeverityLabel(5, 'EN')).toBe('Significant');
  });
});

describe('humanizeRegionId', () => {
  it('converts heatmap region id to readable label', () => {
    const label = humanizeRegionId('pf_tone_4_heatmap', 'EN');
    expect(label).toBe('Tone area');
  });

  it('detects module id in region', () => {
    const label = humanizeRegionId('forehead_redness_mask', 'EN');
    expect(label).toBe('forehead');
  });

  it('returns fallback for unrecognized region', () => {
    const label = humanizeRegionId('xyz_unknown_123', 'EN');
    expect(label).toBe('Detected area');
  });

  it('returns Chinese fallback', () => {
    const label = humanizeRegionId('xyz_unknown_123', 'CN');
    expect(label).toBe('检测区域');
  });
});

// ---------------------------------------------------------------------------
// Concern summary
// ---------------------------------------------------------------------------

describe('mapConcernSummary', () => {
  it('creates primary + secondary concerns', () => {
    const mod = makeModule();
    const summary = mapConcernSummary(mod, 'EN');
    expect(summary.primaryConcern).toContain('Tone');
    expect(summary.primaryConcern).toContain('forehead');
    expect(summary.secondaryConcerns).toHaveLength(1);
    expect(summary.secondaryConcerns[0]).toContain('Redness');
  });

  it('handles empty issues gracefully', () => {
    const mod = makeModule({ issues: [] });
    const summary = mapConcernSummary(mod, 'EN');
    expect(summary.primaryConcern).toContain('No notable concerns');
    expect(summary.secondaryConcerns).toHaveLength(0);
  });

  it('works in Chinese', () => {
    const mod = makeModule();
    const summary = mapConcernSummary(mod, 'CN');
    expect(summary.primaryConcern).toContain('肤色');
    expect(summary.primaryConcern).toContain('额头');
  });

  it('falls back to severity and confidence when rank is missing', () => {
    const mod = makeModule({
      issues: [
        {
          issue_type: 'redness',
          severity_0_4: 1,
          confidence_0_1: 0.2,
          issue_rank_score: null,
          confidence_bucket: 'low',
          evidence_region_ids: [],
          explanation_short: 'Low-rank redness.',
        },
        {
          issue_type: 'tone',
          severity_0_4: 4,
          confidence_0_1: 0.9,
          issue_rank_score: null,
          confidence_bucket: 'high',
          evidence_region_ids: [],
          explanation_short: 'High-severity tone.',
        },
      ],
    });
    const summary = mapConcernSummary(mod, 'EN');
    expect(summary.primaryConcern).toContain('Tone');
  });
});

// ---------------------------------------------------------------------------
// Priority label
// ---------------------------------------------------------------------------

describe('mapPriorityLabel', () => {
  it('returns best_match for top group with high score', () => {
    expect(mapPriorityLabel(makeAction({ group: 'top', action_rank_score: 0.65 }))).toBe('best_match');
  });

  it('returns strong_match for top group with low score', () => {
    expect(mapPriorityLabel(makeAction({ group: 'top', action_rank_score: 0.3 }))).toBe('strong_match');
  });

  it('returns support_option for more group', () => {
    expect(mapPriorityLabel(makeAction({ group: 'more' }))).toBe('support_option');
  });

  it('returns support_option for null group', () => {
    expect(mapPriorityLabel(makeAction({ group: null }))).toBe('support_option');
  });
});

// ---------------------------------------------------------------------------
// Evidence badge
// ---------------------------------------------------------------------------

describe('mapEvidenceBadge', () => {
  it('detects limited from why text', () => {
    const action = makeAction({ why: 'Evidence is still limited, so start low-frequency.' });
    expect(mapEvidenceBadge(action).level).toBe('limited');
  });

  it('defaults to limited when no products and no signal', () => {
    const action = makeAction({ why: 'Helps improve tone.', products: [] });
    expect(mapEvidenceBadge(action).level).toBe('limited');
  });

  it('maps evidence grade A to high', () => {
    const action = makeAction({
      products: [makeProduct({ evidence: { evidence_grade: 'A' } })],
    });
    expect(mapEvidenceBadge(action).level).toBe('high');
  });

  it('maps evidence grade B to moderate', () => {
    const action = makeAction({
      products: [makeProduct({ evidence: { evidence_grade: 'B' } })],
    });
    expect(mapEvidenceBadge(action).level).toBe('moderate');
  });
});

// ---------------------------------------------------------------------------
// Usage chips
// ---------------------------------------------------------------------------

describe('mapUsageChips', () => {
  it('maps AM_PM to readable label', () => {
    const chips = mapUsageChips(makeAction(), 'EN');
    expect(chips.time).toBe('AM + PM');
    expect(chips.frequency).toBe('Daily');
    expect(chips.note).toBe('Start low and slow.');
  });

  it('maps Chinese labels', () => {
    const chips = mapUsageChips(
      makeAction({ how_to_use: { time: 'PM', frequency: '2-3x_week', notes: '隔天用' } }),
      'CN',
    );
    expect(chips.time).toBe('仅晚间');
    expect(chips.frequency).toBe('每周 2-3 次');
  });
});

// ---------------------------------------------------------------------------
// Concern chips
// ---------------------------------------------------------------------------

describe('mapConcernChips', () => {
  it('maps issue types to labels', () => {
    const chips = mapConcernChips(makeAction(), 'EN');
    expect(chips).toEqual(['Tone', 'Redness']);
  });
});

// ---------------------------------------------------------------------------
// Target area
// ---------------------------------------------------------------------------

describe('mapTargetArea', () => {
  it('maps module id to readable area', () => {
    expect(mapTargetArea('forehead', 'EN')).toBe('Most relevant for forehead');
  });

  it('returns null for unknown module', () => {
    expect(mapTargetArea('unknown_module', 'EN')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Product filtering
// ---------------------------------------------------------------------------

describe('isRenderableSkincareProduct', () => {
  it('returns true for normal skincare products', () => {
    expect(isRenderableSkincareProduct(makeProduct())).toBe(true);
  });

  it('returns false for brush/tool categories', () => {
    const product = makeProduct({ category: 'Makeup Brush Set' } as any);
    expect(isRenderableSkincareProduct(product)).toBe(false);
  });

  it('returns false for accessory category', () => {
    const product = makeProduct({ category: 'accessory' } as any);
    expect(isRenderableSkincareProduct(product)).toBe(false);
  });

  it('returns true when category is empty', () => {
    expect(isRenderableSkincareProduct(makeProduct())).toBe(true);
  });
});

describe('scoreProductCardRichness', () => {
  it('scores 0 for empty product', () => {
    expect(scoreProductCardRichness(makeProduct())).toBe(0);
  });

  it('scores high for rich product', () => {
    const rich = makeProduct({
      image_url: 'https://example.com/img.jpg',
      price: 29.9,
      why_match: 'Contains niacinamide.',
      suitability_score: 0.5,
      social_proof: { rating: 4.5, review_count: 120, summary: '' },
    });
    expect(scoreProductCardRichness(rich)).toBe(9);
  });
});

describe('dedupeProducts', () => {
  it('removes duplicates with same brand + name', () => {
    const products = [
      makeProduct({ product_id: 'a', title: 'Hydra Serum', brand: 'BrandX' }),
      makeProduct({ product_id: 'b', title: 'Hydra Serum', brand: 'BrandX', image_url: 'http://img.jpg' }),
    ];
    const result = dedupeProducts(products);
    expect(result).toHaveLength(1);
    expect(result[0].product_id).toBe('b');
  });

  it('keeps products with different brands', () => {
    const products = [
      makeProduct({ product_id: 'a', title: 'Serum', brand: 'A' }),
      makeProduct({ product_id: 'b', title: 'Serum', brand: 'B' }),
    ];
    expect(dedupeProducts(products)).toHaveLength(2);
  });
});

describe('filterAndRankProducts', () => {
  it('returns top 3 and remaining as more', () => {
    const products = Array.from({ length: 5 }, (_, i) =>
      makeProduct({
        product_id: `p${i}`,
        title: `Product ${i}`,
        brand: `Brand${i}`,
        suitability_score: 0.5 - i * 0.05,
      }),
    );
    const { top, more } = filterAndRankProducts(products);
    expect(top).toHaveLength(3);
    expect(more).toHaveLength(2);
    expect(top[0].product_id).toBe('p0');
  });

  it('filters non-skincare products', () => {
    const products = [
      makeProduct({ product_id: 'good', title: 'Serum', brand: 'A', suitability_score: 0.8 }),
      makeProduct({ product_id: 'bad', title: 'Brush', brand: 'B', category: 'brush set' } as any),
    ];
    const { top, more } = filterAndRankProducts(products);
    expect(top).toHaveLength(1);
    expect(top[0].product_id).toBe('good');
    expect(more).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Product card VM
// ---------------------------------------------------------------------------

describe('mapProductCard', () => {
  it('maps basic fields', () => {
    const vm = mapProductCard(
      makeProduct({ title: 'Glow Serum', brand: 'Aurora', price: 29.9, currency: 'USD' }),
      'EN',
    );
    expect(vm.name).toBe('Glow Serum');
    expect(vm.brand).toBe('Aurora');
    expect(vm.price).toBe('$29.90');
  });

  it('handles missing price', () => {
    const vm = mapProductCard(makeProduct(), 'EN');
    expect(vm.price).toBeNull();
  });

  it('uses price_label if available', () => {
    const vm = mapProductCard(makeProduct({ price_label: 'From $19' }), 'EN');
    expect(vm.price).toBe('From $19');
  });

  it('maps suitability tier', () => {
    const high = mapProductCard(makeProduct({ suitability_score: 0.7 }), 'EN');
    expect(high.suitabilityTier).toBe('high');

    const medium = mapProductCard(makeProduct({ suitability_score: 0.4 }), 'EN');
    expect(medium.suitabilityTier).toBe('medium');

    const low = mapProductCard(makeProduct({ suitability_score: 0.2 }), 'EN');
    expect(low.suitabilityTier).toBe('low');
  });

  it('maps social proof', () => {
    const vm = mapProductCard(
      makeProduct({ social_proof: { rating: 4.5, review_count: 200, summary: '' } }),
      'EN',
    );
    expect(vm.socialProof).toEqual({ rating: '4.5', reviews: '200' });
  });

  it('adds budget-friendly tag for cheap products', () => {
    const vm = mapProductCard(makeProduct({ price: 15 }), 'EN');
    expect(vm.tags).toContain('Budget-friendly');
  });
});

// ---------------------------------------------------------------------------
// Module-level mapper
// ---------------------------------------------------------------------------

describe('mapModuleToRecommendationVm', () => {
  it('maps a full module', () => {
    const mod = makeModule({
      actions: [
        makeAction({
          products: [
            makeProduct({ title: 'Serum A', suitability_score: 0.6 }),
            makeProduct({ title: 'Serum B', suitability_score: 0.4 }),
          ],
        }),
      ],
    });

    const vm = mapModuleToRecommendationVm(mod, 'EN');
    expect(vm.moduleId).toBe('forehead');
    expect(vm.concernSummary.primaryConcern).toContain('Tone');
    expect(vm.actions).toHaveLength(1);
    expect(vm.actions[0].ingredientName).toBe('Niacinamide');
    expect(vm.actions[0].topProducts).toHaveLength(2);
    expect(vm.actions[0].priority).toBe('best_match');
  });

  it('handles module with no actions', () => {
    const mod = makeModule({ actions: [] });
    const vm = mapModuleToRecommendationVm(mod, 'EN');
    expect(vm.actions).toHaveLength(0);
  });

  it('provides empty message when no products available', () => {
    const mod = makeModule({
      actions: [makeAction({ products: [], products_empty_reason: 'low_evidence' })],
    });
    const vm = mapModuleToRecommendationVm(mod, 'EN');
    expect(vm.actions[0].productsEmptyMessage).toContain('Evidence strength');
  });
});

describe('applyRecommendationDisplayOptions', () => {
  it('hides all product surfaces when products are disabled', () => {
    const vm = mapModuleToRecommendationVm(
      makeModule({
        actions: [
          makeAction({
            products: [makeProduct({ title: 'Serum A', suitability_score: 0.8 })],
            products_empty_reason: 'low_evidence',
            external_search_ctas: [{ title: 'Search online', url: 'https://example.com', source: 'google', reason: 'fallback' }],
          }),
        ],
      }),
      'EN',
    );

    const hidden = applyRecommendationDisplayOptions(vm, { productsEnabled: false });
    expect(hidden.actions[0].topProducts).toHaveLength(0);
    expect(hidden.actions[0].moreProducts).toHaveLength(0);
    expect(hidden.actions[0].productsEmptyMessage).toBeNull();
    expect(hidden.actions[0].externalSearchCtas).toHaveLength(0);
  });

  it('keeps top products but hides expanded products when expansion is disabled', () => {
    const vm = mapModuleToRecommendationVm(
      makeModule({
        actions: [
          makeAction({
            products: [
              makeProduct({ product_id: 'p1', title: 'Serum 1', suitability_score: 0.9 }),
              makeProduct({ product_id: 'p2', title: 'Serum 2', suitability_score: 0.8 }),
              makeProduct({ product_id: 'p3', title: 'Serum 3', suitability_score: 0.7 }),
              makeProduct({ product_id: 'p4', title: 'Serum 4', suitability_score: 0.6 }),
            ],
          }),
        ],
      }),
      'EN',
    );

    const hidden = applyRecommendationDisplayOptions(vm, { expandedProductsEnabled: false });
    expect(hidden.actions[0].topProducts).toHaveLength(3);
    expect(hidden.actions[0].moreProducts).toHaveLength(0);
  });
});
