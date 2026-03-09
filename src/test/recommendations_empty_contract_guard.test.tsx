import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auroraAnalytics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auroraAnalytics')>('@/lib/auroraAnalytics');
  return {
    ...actual,
    emitAuroraEmptyRecommendationsContractViolation: vi.fn(),
  };
});

import { RecommendationsCard } from '@/pages/BffChat';
import type { Card } from '@/lib/pivotaAgentBff';
import { emitAuroraEmptyRecommendationsContractViolation } from '@/lib/auroraAnalytics';

describe('RecommendationsCard empty contract guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render a normal shortlist when recommendations is unexpectedly empty', () => {
    const card: Card = {
      card_id: 'reco_empty_generic',
      type: 'recommendations',
      payload: {
        recommendations: [],
        warnings: ['upstream empty'],
      },
    };

    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        analyticsCtx={{
          brief_id: 'brief_reco_empty',
          trace_id: 'trace_reco_empty',
          lang: 'en',
          state: 'RECO_RESULTS',
        }}
      />,
    );

    expect(screen.getByText(/did not produce a displayable product shortlist/i)).toBeInTheDocument();
    expect(vi.mocked(emitAuroraEmptyRecommendationsContractViolation).mock.calls.length).toBe(1);
  });

  it('keeps ingredient empty-match rendering without contract-violation telemetry', () => {
    const card: Card = {
      card_id: 'reco_empty_ingredient',
      type: 'recommendations',
      payload: {
        recommendations: [],
        task_mode: 'ingredient_lookup_no_candidates',
        products_empty_reason: 'ingredient_constraint_no_match',
        empty_match_actions: [{ action_id: 'broaden_to_goal', label: 'Broaden' }],
      },
    };

    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        analyticsCtx={{
          brief_id: 'brief_reco_ing_empty',
          trace_id: 'trace_reco_ing_empty',
          lang: 'en',
          state: 'RECO_RESULTS',
        }}
      />,
    );

    expect(screen.getByText(/No confirmed ingredient-matched products found yet/i)).toBeInTheDocument();
    expect(vi.mocked(emitAuroraEmptyRecommendationsContractViolation).mock.calls.length).toBe(0);
  });

  it('repairs raw PDP-shaped recommendation rows without rendering unknown.response or raw JSON', () => {
    const card: Card = {
      card_id: 'reco_raw_pdp_repaired',
      type: 'recommendations',
      payload: {
        recommendations: [
          {
            status: 'success',
            pdp_version: '2.0',
            subject: {
              type: 'product',
              id: 'ext_reco_1',
              canonical_product_ref: {
                merchant_id: 'external_seed',
                product_id: 'ext_reco_1',
              },
            },
            modules: [
              {
                type: 'canonical',
                data: {
                  canonical_product_ref: {
                    merchant_id: 'external_seed',
                    product_id: 'ext_reco_1',
                  },
                  pdp_payload: {
                    product: {
                      product_id: 'ext_reco_1',
                      title: 'Barrier Repair Cream',
                      brand: { name: 'Aurora Lab' },
                      category_path: ['Skincare', 'Moisturizer'],
                      url: 'https://example.com/products/barrier-repair-cream',
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    };

    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        analyticsCtx={{
          brief_id: 'brief_reco_pdp_fix',
          trace_id: 'trace_reco_pdp_fix',
          lang: 'en',
          state: 'RECO_RESULTS',
        }}
      />,
    );

    expect(screen.getByText(/Barrier Repair Cream/i)).toBeInTheDocument();
    expect(screen.queryByText(/unknown\.response/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/"pdp_version": "2\.0"/i)).not.toBeInTheDocument();
  });

  it('uses top-level reco identity and travel fallback reasoning when sku fields are missing', () => {
    const card: Card = {
      card_id: 'reco_top_level_identity',
      type: 'recommendations',
      payload: {
        recommendation_meta: {
          source_mode: 'travel_handoff',
          trigger_source: 'travel_handoff',
          task_mode: 'travel_readiness_products',
          destination: 'Singapore',
        },
        recommendations: [
          {
            brand: 'Aurora Lab',
            name: 'Light Gel Sunscreen SPF50',
            category: 'sunscreen',
          },
        ],
      },
    };

    render(
      <RecommendationsCard
        card={card}
        language="EN"
        debug={false}
        analyticsCtx={{
          brief_id: 'brief_reco_top_level',
          trace_id: 'trace_reco_top_level',
          lang: 'en',
          state: 'RECO_RESULTS',
        }}
      />,
    );

    expect(screen.getByText(/Light Gel Sunscreen SPF50/i)).toBeInTheDocument();
    expect(screen.getByText(/Why this fits/i)).toBeInTheDocument();
    expect(screen.getByText(/Singapore/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Unknown product$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Unknown brand$/i)).not.toBeInTheDocument();
  });
});
