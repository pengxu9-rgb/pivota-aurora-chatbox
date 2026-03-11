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
    expect(screen.getByText('Plan strength: Balanced')).toBeInTheDocument();
    expect(screen.getAllByText('Best match').length).toBeGreaterThan(0);
    expect(screen.queryByText('https://example.com/pdp')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open product: niacinamide serum/i }));
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

    expect(screen.queryByText(/^-$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Recommended products')).not.toBeInTheDocument();
    expect(screen.queryByText('Support options')).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it('filters obvious makeup candidates out of skincare recommendations', () => {
    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_filtered"
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'uv_filters',
              ingredient_name: 'UV Filters',
              priority_score_0_100: 82,
              priority_level: 'high',
              why: ['Daily UV protection matters most in low-confidence mode.'],
              usage_guidance: ['AM final step'],
              products: {
                competitors: [
                  {
                    product_id: 'spf_1',
                    name: 'UV Filters SPF 45 Serum',
                    brand: 'The Ordinary',
                    pdp_url: 'https://example.com/pdp/spf-serum',
                  },
                  {
                    product_id: 'lip_1',
                    name: 'Gloss Bomb Cream Color Drip Lip Cream',
                    brand: 'Fenty Beauty',
                    pdp_url: 'https://example.com/pdp/lip-gloss',
                  },
                  {
                    product_id: 'veil_1',
                    name: 'Diamond Bomb All-Over Diamond Veil',
                    brand: 'Fenty Beauty',
                    pdp_url: 'https://example.com/pdp/highlighter',
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

    expect(screen.getByText('UV Filters SPF 45 Serum')).toBeInTheDocument();
    expect(screen.queryByText(/Gloss Bomb Cream/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Diamond Bomb All-Over Diamond Veil/i)).not.toBeInTheDocument();
    expect(
      screen.getByText('Obvious non-skincare candidates were hidden to keep these picks skincare-relevant.'),
    ).toBeInTheDocument();
  });
});
