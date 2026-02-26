import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnvStressCard } from '@/components/aurora/cards/EnvStressCard';

describe('EnvStressCard travel readiness', () => {
  it('renders travel sections and CTA actions when travel_readiness exists', () => {
    const onOpenCheckin = vi.fn();
    const onOpenRecommendations = vi.fn();
    const onRefineRoutine = vi.fn();

    render(
      <EnvStressCard
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 66,
          tier: 'Moderate',
          radar: [{ axis: 'Hydration', value: 62 }],
          notes: [],
          travel_readiness: {
            destination_context: {
              destination: 'Paris',
              start_date: '2026-03-01',
              end_date: '2026-03-05',
              env_source: 'weather_api',
              epi: 67,
            },
            delta_vs_home: {
              temperature: { home: 18, destination: 10, delta: -8, unit: 'C' },
              humidity: { home: 58, destination: 76, delta: 18, unit: '%' },
              summary_tags: ['colder', 'more_humid'],
            },
            adaptive_actions: [{ why: 'UV pressure is higher', what_to_do: 'Reapply SPF during daytime.' }],
            personal_focus: [{ focus: 'Barrier', why: 'Sensitive skin', what_to_do: 'Use richer moisturizer.' }],
            jetlag_sleep: {
              hours_diff: 9,
              risk_level: 'high',
              sleep_tips: ['Shift sleep before departure'],
              mask_tips: ['Use recovery mask on first night'],
            },
            shopping_preview: {
              products: [{ product_id: 'prod_1', name: 'Barrier Cream', brand: 'Aurora Lab', reasons: ['repair'] }],
              brand_candidates: [
                { brand: 'Bioderma', match_status: 'kb_verified', reason: 'Barrier support' },
                { brand: 'LocalLab', match_status: 'llm_only', reason: 'Early-stage candidate' },
              ],
              buying_channels: ['beauty_retail', 'ecommerce'],
              city_hint: 'Paris',
            },
            confidence: {
              level: 'medium',
              missing_inputs: ['recent_logs'],
              improve_by: ['Add check-ins'],
            },
          },
        }}
        language="EN"
        onOpenCheckin={onOpenCheckin}
        onOpenRecommendations={onOpenRecommendations}
        onRefineRoutine={onRefineRoutine}
      />,
    );

    expect(screen.getByText('Destination delta')).toBeInTheDocument();
    expect(screen.getByText('Personal focus')).toBeInTheDocument();
    expect(screen.getByText('Jet lag and sleep')).toBeInTheDocument();
    expect(screen.getByText('Shopping preview')).toBeInTheDocument();
    expect(screen.getByText('Why this score (expand)')).toBeInTheDocument();
    expect(screen.getByText('Local brand candidates')).toBeInTheDocument();
    expect(screen.getByText(/Bioderma/i)).toBeInTheDocument();
    expect(screen.getByText(/KB verified/i)).toBeInTheDocument();
    expect(screen.getByText('Where to buy')).toBeInTheDocument();
    expect(screen.getByText('Want a more accurate signal? Add a quick check-in.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'See full recommendations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refine with AM/PM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open daily check-in' }));

    expect(onOpenRecommendations).toHaveBeenCalledTimes(1);
    expect(onRefineRoutine).toHaveBeenCalledTimes(1);
    expect(onOpenCheckin).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy notes when travel_readiness is absent', () => {
    render(
      <EnvStressCard
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 42,
          tier: 'Low',
          radar: [{ axis: 'Hydration', value: 40 }],
          notes: ['legacy_note_1', 'legacy_note_2'],
        }}
        language="EN"
      />,
    );

    expect(screen.getByText(/legacy_note_1/)).toBeInTheDocument();
    expect(screen.queryByText('Destination delta')).not.toBeInTheDocument();
  });
});
