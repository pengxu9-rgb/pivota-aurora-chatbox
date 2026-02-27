import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { IngredientPlanCard } from '@/components/aurora/cards/IngredientPlanCard';
import { analytics } from '@/lib/analytics';

const analyticsCtx = {
  brief_id: 'brief_test',
  trace_id: 'trace_test',
  aurora_uid: 'uid_test',
  lang: 'en' as const,
  state: 'IDLE_CHAT',
};

describe('ingredient_plan_v2 open link behavior', () => {
  beforeEach(() => {
    vi.spyOn(analytics, 'emit').mockImplementation(() => {});
    vi.spyOn(window, 'open').mockImplementation(() => ({ closed: false } as Window));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses anchor click with open fallback and emits attempt/result events', () => {
    render(
      <IngredientPlanCard
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="plan_card_1"
        payload={{
          targets: [
            {
              ingredient: 'UV filters',
              products: {
                competitors: [
                  {
                    product_id: 'prod_1',
                    title: 'SPF Fluid',
                    pdp_url: 'https://example.com/pdp/spf-fluid',
                  },
                ],
                dupes: [],
              },
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText('https://example.com/pdp/spf-fluid'));

    expect(window.open).toHaveBeenCalled();
    expect(analytics.emit).toHaveBeenCalledWith(
      'ingredient_product_open_attempt',
      'brief_test',
      'trace_test',
      expect.objectContaining({
        card_id: 'plan_card_1',
        source_card_type: 'ingredient_plan_v2',
      }),
    );
    expect(analytics.emit).toHaveBeenCalledWith(
      'ingredient_product_open_result',
      'brief_test',
      'trace_test',
      expect.objectContaining({
        result: 'success_new_tab',
      }),
    );
  });

  it('shows disabled text when product URL is missing', () => {
    render(
      <IngredientPlanCard
        language="EN"
        cardId="plan_card_2"
        payload={{
          targets: [
            {
              ingredient: 'Niacinamide',
              products: {
                competitors: [{ product_id: 'prod_2', title: 'No URL product' }],
                dupes: [],
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Link unavailable')).toBeInTheDocument();
  });

  it('derives internal PDP URL from pdp_open.product_ref when direct URL is absent', () => {
    render(
      <IngredientPlanCard
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="plan_card_3"
        payload={{
          targets: [
            {
              ingredient: 'UV filters',
              products: {
                competitors: [
                  {
                    product_id: 'prod_3',
                    title: 'Ref-only SPF',
                    pdp_open: {
                      path: 'ref',
                      product_ref: { product_id: 'prod_ref_3', merchant_id: 'merch_ref_3' },
                    },
                  },
                ],
                dupes: [],
              },
            },
          ],
        }}
      />,
    );

    const derivedLink = screen.getByText(
      'https://agent.pivota.cc/products/prod_ref_3?merchant_id=merch_ref_3&entry=aurora_chatbox',
    );
    fireEvent.click(derivedLink);
    expect(window.open).toHaveBeenCalled();
    expect(analytics.emit).toHaveBeenCalledWith(
      'ingredient_product_open_attempt',
      'brief_test',
      'trace_test',
      expect.objectContaining({
        card_id: 'plan_card_3',
        url: 'https://agent.pivota.cc/products/prod_ref_3?merchant_id=merch_ref_3&entry=aurora_chatbox',
      }),
    );
  });
});
