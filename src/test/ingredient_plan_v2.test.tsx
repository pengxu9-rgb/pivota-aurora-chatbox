import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IngredientPlanCard } from '@/components/aurora/cards/IngredientPlanCard';
import { analytics } from '@/lib/analytics';

describe('ingredient_plan_v2 card', () => {
  it('renders readable intensity, hides raw Pxx, and emits product tap with budget fields', () => {
    const emitSpy = vi.spyOn(analytics, 'emit').mockImplementation(() => {});

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

    expect(screen.getByText('Intensity: Gentle')).toBeInTheDocument();
    expect(screen.getByText('Barrier-first, lower-irritation progression.')).toBeInTheDocument();
    expect(screen.queryByText(/P\d+/)).not.toBeInTheDocument();

    expect(screen.getByText('Competitor Serum A')).toBeInTheDocument();
    expect(screen.getByText('Competitor Serum B')).toBeInTheDocument();
    expect(screen.getByText('Dupe Serum C')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Competitor Serum A'));

    expect(emitSpy).toHaveBeenCalledWith(
      'aurora_ingredient_plan_product_tap',
      'brief_test',
      'trace_test',
      expect.objectContaining({
        card_id: 'card_ing_v2_1',
        ingredient_id: 'niacinamide',
        product_id: 'comp_1',
        source_block: 'competitor',
        price_tier: 'mid',
        price: 42,
        currency: 'USD',
      }),
    );

    emitSpy.mockRestore();
  });
});

