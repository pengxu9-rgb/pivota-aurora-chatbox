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

    fireEvent.click(screen.getByRole('button', { name: /view product: spf fluid/i }));

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

  it('treats a stable product_id as an internal PDP hint even when no external URL is present', () => {
    const onOpenPdp = vi.fn();
    render(
      <IngredientPlanCard
        language="EN"
        cardId="plan_card_2"
        onOpenPdp={onOpenPdp}
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

    fireEvent.click(screen.getByRole('button', { name: /view product: no url product/i }));
    expect(onOpenPdp).toHaveBeenCalledWith({
      url: 'https://agent.pivota.cc/products/prod_2?entry=aurora_chatbox',
      title: 'No URL product',
    });
  });

  it('opens internal PDPs in the shop drawer when an in-app opener is provided', () => {
    const onOpenPdp = vi.fn();

    render(
      <IngredientPlanCard
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="plan_card_3"
        onOpenPdp={onOpenPdp}
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

    fireEvent.click(screen.getByRole('button', { name: /view product: ref-only spf/i }));
    expect(onOpenPdp).toHaveBeenCalledWith({
      url: 'https://agent.pivota.cc/products/prod_ref_3?merchant_id=merch_ref_3&entry=aurora_chatbox',
      title: 'Ref-only SPF',
    });
    expect(window.open).not.toHaveBeenCalled();
    expect(analytics.emit).toHaveBeenCalledWith(
      'ingredient_product_open_attempt',
      'brief_test',
      'trace_test',
      expect.objectContaining({
        card_id: 'plan_card_3',
        url: 'https://agent.pivota.cc/products/prod_ref_3?merchant_id=merch_ref_3&entry=aurora_chatbox',
      }),
    );
    expect(analytics.emit).toHaveBeenCalledWith(
      'ingredient_product_open_result',
      'brief_test',
      'trace_test',
      expect.objectContaining({
        result: 'success_shop_drawer',
      }),
    );
  });

  it('opens direct internal shop PDP URLs in the shop drawer when available', () => {
    const onOpenPdp = vi.fn();

    render(
      <IngredientPlanCard
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="plan_card_4"
        onOpenPdp={onOpenPdp}
        payload={{
          targets: [
            {
              ingredient: 'Ceramides',
              products: {
                competitors: [
                  {
                    product_id: 'ext_prod_4',
                    merchant_id: 'external_seed',
                    title: 'Barrier Cream',
                    brand: 'Brand B',
                    pdp_url: 'https://agent.pivota.cc/products/ext_prod_4?merchant_id=external_seed&entry=aurora_chatbox',
                  },
                ],
                dupes: [],
              },
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /view product: barrier cream/i }));

    expect(onOpenPdp).toHaveBeenCalledWith({
      url: 'https://agent.pivota.cc/products/ext_prod_4?merchant_id=external_seed&entry=aurora_chatbox',
      title: 'Brand B Barrier Cream',
    });
    expect(window.open).not.toHaveBeenCalled();
  });
});
