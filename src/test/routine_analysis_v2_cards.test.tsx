import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoutineProductAuditCard } from '@/components/aurora/cards/RoutineProductAuditCard';
import { RoutineAdjustmentPlanCard } from '@/components/aurora/cards/RoutineAdjustmentPlanCard';
import { RoutineRecommendationCard } from '@/components/aurora/cards/RoutineRecommendationCard';

describe('routine analysis v2 cards', () => {
  it('renders product audit, adjustment plan, and recommendation guidance payloads', () => {
    render(
      <div>
        <RoutineProductAuditCard
          language="EN"
          payload={{
            products: [
              {
                product_ref: 'routine_am_01',
                input_label: 'Retinol serum',
                resolved_name_or_null: null,
                inferred_product_type: 'retinoid serum',
                likely_role: 'anti-aging treatment',
                fit_for_skin_type: { verdict: 'mixed', reason: 'Needs slower onboarding.' },
                fit_for_goals: [{ goal: 'wrinkles', verdict: 'good', reason: 'Aligned with wrinkle goals.' }],
                fit_for_season_or_climate: { verdict: 'unknown', reason: 'Climate was not provided.' },
                potential_concerns: ['This looks like a stronger active that is usually easier to manage at night.'],
                suggested_action: 'move_to_pm',
                confidence: 0.52,
                missing_info: ['Exact SKU or full product name was not confirmed.'],
                evidence_basis: ['step_label'],
                likely_key_ingredients_or_signals: ['retinoid signal'],
                concise_reasoning_en: 'This reads like a stronger active, so PM placement is the safer first move.',
              },
            ],
            confidence: 0.64,
          }}
        />
        <RoutineAdjustmentPlanCard
          language="EN"
          payload={{
            current_routine_assessment: {
              summary: 'The routine is usable, but moving retinol to PM is the clearest first fix.',
            },
            top_3_adjustments: [
              {
                adjustment_id: 'adj_1',
                priority_rank: 1,
                title: 'Move Retinol serum to PM',
                why_this_first: 'This is the strongest current product-slot mismatch.',
                expected_outcome: 'Lower irritation risk.',
              },
            ],
            improved_am_routine: [
              {
                step_order: 1,
                what_to_use: 'Gentle cleanser',
                frequency: 'daily',
                note: 'Keep the AM routine simple.',
                source_type: 'existing_product',
              },
            ],
            improved_pm_routine: [
              {
                step_order: 1,
                what_to_use: 'Retinol serum',
                frequency: '2-3 nights/week',
                note: 'Move the stronger active to PM.',
                source_type: 'existing_product',
              },
            ],
            rationale_for_each_adjustment: [
              {
                adjustment_id: 'adj_1',
                reasoning: 'Retinoid-style products usually tolerate better in PM.',
                evidence: ['This reads like a stronger active.'],
                tradeoff_or_caution: 'Change one thing first.',
              },
            ],
          }}
        />
        <RoutineRecommendationCard
          language="EN"
          payload={{
            recommendation_groups: [
              {
                adjustment_id: 'adj_gap_spf',
                target_step: 'sunscreen',
                timing: 'am',
                why: 'AM protection is missing.',
                required_attributes: ['broad-spectrum daily UV protection'],
                avoid_attributes: ['unclear SPF claims'],
                candidate_pool: [],
                category_guidance: {
                  what_to_look_for: ['broad-spectrum daily UV protection'],
                  avoid: ['unclear SPF claims'],
                  note: 'Prioritize a clearly wearable AM sunscreen.',
                },
                unresolved_reason: 'no_grounded_candidates',
                recommendation_query: 'sunscreen broad-spectrum daily UV protection fluid',
              },
            ],
          }}
        />
      </div>,
    );

    expect(screen.getByText('Your current products')).toBeInTheDocument();
    expect(screen.getByText('Tentative')).toBeInTheDocument();
    expect(screen.getByText('Move to PM')).toBeInTheDocument();
    expect(screen.getByText('What to change first')).toBeInTheDocument();
    expect(screen.getByText('Move Retinol serum to PM')).toBeInTheDocument();
    expect(screen.getByText('If you upgrade, start here')).toBeInTheDocument();
    expect(screen.getByText('AM protection is missing.')).toBeInTheDocument();
    expect(screen.getByText('Prioritize a clearly wearable AM sunscreen.')).toBeInTheDocument();
  });
});
