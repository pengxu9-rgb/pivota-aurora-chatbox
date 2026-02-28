import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IngredientPlanCard } from '@/components/aurora/cards/IngredientPlanCard';

const analyticsCtx = {
  brief_id: 'brief_ui',
  trace_id: 'trace_ui',
  aurora_uid: 'uid_ui',
  session_id: 'session_ui',
  lang: 'EN' as const,
  state: 'S7_PRODUCT_RECO',
};

describe('ingredient_plan_v2 rich product UI', () => {
  it('renders canonical product fields and opens PDP when provided', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({ closed: false } as unknown as Window));

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui"
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'balanced', label: 'Balanced', explanation: 'Moderate strategy.' },
          targets: [
            {
              ingredient_id: 'niacinamide',
              ingredient_name: 'Niacinamide',
              priority_score_0_100: 79,
              priority_level: 'high',
              why: ['Rule signal: balance'],
              usage_guidance: ['AM/PM'],
              products: {
                competitors: [
                  {
                    product_id: 'prod_1',
                    name: 'Niacinamide Serum',
                    brand: 'Brand A',
                    thumb_url: 'https://example.com/thumb.jpg',
                    price: 39,
                    currency: 'USD',
                    price_tier: 'mid',
                    rating_value: 4.4,
                    rating_count: 1203,
                    source: 'amazon',
                    source_block: 'competitor',
                    fallback_type: 'external',
                    pdp_url: 'https://example.com/pdp',
                    why_match: 'Fits tolerance.',
                  },
                ],
                dupes: [],
              },
            },
          ],
          avoid: [],
          conflicts: [],
        }}
      />,
    );

    expect(screen.getByText('Niacinamide Serum')).toBeInTheDocument();
    expect(screen.getByText('Brand A · amazon')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/pdp')).toBeInTheDocument();

    fireEvent.click(screen.getByText('https://example.com/pdp'));
    expect(openSpy).toHaveBeenCalledWith('https://example.com/pdp', '_blank', 'noopener,noreferrer');

    openSpy.mockRestore();
  });

  it('shows empty placeholders when no structured product is available', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({ closed: false } as unknown as Window));

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_fallback"
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'azelaic_acid',
              ingredient_name: 'Azelaic Acid',
              priority_score_0_100: 74,
              priority_level: 'medium',
              why: ['Rule signal: redness support'],
              usage_guidance: ['PM, 2-3x/week'],
              products: {
                competitors: [],
                dupes: [],
              },
            },
          ],
          avoid: [],
          conflicts: [],
        }}
      />,
    );

    expect(screen.queryByText('No structured product yet, open Google results')).not.toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2);
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });
});
