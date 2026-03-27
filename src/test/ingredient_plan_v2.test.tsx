import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IngredientPlanCard } from '@/components/aurora/cards/IngredientPlanCard';

describe('ingredient_plan_v2 card', () => {
  it('renders ingredient sections and product groups without raw priority tokens', () => {
    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={{
          brief_id: 'brief_test',
          trace_id: 'trace_test',
          aurora_uid: 'uid_test',
          session_id: 'session_test',
          lang: 'EN',
          state: 'S7_PRODUCT_RECO',
        }}
        cardId="card_ing_v2_1"
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: {
            level: 'gentle',
            label: 'Gentle',
            explanation: 'Barrier-first, lower-irritation progression.',
          },
          budget_context: {
            effective_tier: 'mid',
            source: 'profile',
            diversified_when_unknown: false,
          },
          targets: [
            {
              ingredient_id: 'niacinamide',
              ingredient_name: 'Niacinamide',
              priority_score_0_100: 82,
              priority_level: 'high',
              why: ['Rule signal: oil-balance support'],
              usage_guidance: ['AM/PM after cleanser'],
              products: {
                competitors: [
                  {
                    product_id: 'comp_1',
                    name: 'Competitor Serum A',
                    brand: 'Brand A',
                    price: 42,
                    currency: 'USD',
                    price_tier: 'mid',
                    source_block: 'competitor',
                    why_match: 'Fits tolerance strategy.',
                  },
                  {
                    product_id: 'comp_2',
                    name: 'Competitor Serum B',
                    brand: 'Brand B',
                    price: 68,
                    currency: 'USD',
                    price_tier: 'high',
                    source_block: 'competitor',
                    why_match: 'Alternative concentration.',
                  },
                ],
                dupes: [
                  {
                    product_id: 'dupe_1',
                    name: 'Dupe Serum C',
                    brand: 'Brand C',
                    price: 18,
                    currency: 'USD',
                    price_tier: 'low',
                    source_block: 'dupe',
                    why_match: 'Budget-friendly alternative.',
                  },
                ],
              },
            },
          ],
          avoid: [],
          conflicts: [],
        }}
      />,
    );

    expect(screen.getByText('Baseline support')).toBeInTheDocument();
    expect(screen.getByText('Plan strength: Gentle')).toBeInTheDocument();
    expect(screen.getAllByText('Best match').length).toBeGreaterThan(0);
    expect(screen.queryByText(/P\d+/)).not.toBeInTheDocument();

    expect(screen.getByText('Competitor Serum A')).toBeInTheDocument();
    expect(screen.getByText('Competitor Serum B')).toBeInTheDocument();
    expect(screen.getByText('Dupe Serum C')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /view product:/i })).toHaveLength(3);
  });

  it('prioritizes photo-derived actives and shows strict-match miss fallback CTA before baseline support', () => {
    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={{
          brief_id: 'brief_test',
          trace_id: 'trace_test',
          aurora_uid: 'uid_test',
          session_id: 'session_test',
          lang: 'EN',
          state: 'S7_PRODUCT_RECO',
        }}
        cardId="card_ing_v2_photo"
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          targets: [
            {
              ingredient_id: 'niacinamide',
              ingredient_name: 'Niacinamide',
              priority_score_0_100: 91,
              priority_level: 'high',
              why_match_short: 'Matched to visible shine and tone findings from the left cheek.',
              why: ['Supports visible oil balance and tone support.'],
              usage_guidance: ['AM/PM after cleanser'],
              source_module_ids: ['left_cheek'],
              source_issue_types: ['shine', 'tone'],
              recommendation_mode: 'cta_only',
              strict_product_count: 0,
              presentation_bucket: 'photo_derived',
              products: {
                products_empty_reason: 'strict_match_miss',
                external_search_ctas: [
                  {
                    title: 'Search niacinamide options',
                    url: 'https://example.com/search/niacinamide',
                    source: 'external',
                    reason: 'strict_match_miss',
                  },
                ],
              },
            },
            {
              ingredient_id: 'uv_filters',
              ingredient_name: 'UV filters',
              priority_score_0_100: 52,
              priority_level: 'medium',
              why: ['Daily baseline support.'],
              usage_guidance: ['AM only'],
              presentation_bucket: 'baseline_support',
              products: {
                competitors: [
                  {
                    product_id: 'spf_1',
                    name: 'Daily UV Fluid SPF 50',
                    brand: 'Brand Sun',
                    price: 28,
                    currency: 'USD',
                    source_block: 'competitor',
                    why_match: 'Reliable baseline UV protection.',
                  },
                ],
              },
            },
          ],
          avoid: [],
          conflicts: [],
        }}
      />,
    );

    const sectionHeadings = screen.getAllByText(/Photo-derived actives|Baseline support/);
    expect(sectionHeadings).toHaveLength(2);
    expect(sectionHeadings[0]).toHaveTextContent('Photo-derived actives');
    expect(sectionHeadings[1]).toHaveTextContent('Baseline support');

    expect(screen.getByText('Observed on left cheek')).toBeInTheDocument();
    expect(screen.getByText('Shine')).toBeInTheDocument();
    expect(screen.getByText('Tone')).toBeInTheDocument();
    expect(screen.getByText('No strict product match was confirmed for this finding yet. Use the search fallback below.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open search: Search niacinamide options/i })).toBeInTheDocument();
    expect(screen.getByText('Daily UV Fluid SPF 50')).toBeInTheDocument();
  });
});
