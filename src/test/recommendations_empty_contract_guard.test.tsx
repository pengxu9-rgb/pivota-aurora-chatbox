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
});
