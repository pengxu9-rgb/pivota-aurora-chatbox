import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnvStressCard } from '@/components/aurora/cards/EnvStressCard';

describe('EnvStressCard travel readiness', () => {
  it('renders categorized concern sections and CTA actions when categorized_kit exists', () => {
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
              weather_reason: 'weather_api_ok',
              epi: 67,
            },
            delta_vs_home: {
              temperature: { home: 18, destination: 10, delta: -8, unit: 'C' },
              humidity: { home: 58, destination: 76, delta: 18, unit: '%' },
              summary_tags: ['colder', 'more_humid'],
            },
            forecast_window: [
              {
                date: '2026-03-01',
                temp_low_c: 7,
                temp_high_c: 13,
                precip_mm: 2.1,
                condition_text: 'Rain',
              },
            ],
            alerts: [
              {
                severity: 'orange',
                title: 'Wind advisory',
                action_hint: 'Reduce prolonged outdoor exposure.',
              },
            ],
            adaptive_actions: [{ why: 'UV pressure is higher', what_to_do: 'Reapply SPF during daytime.' }],
            personal_focus: [{ focus: 'Barrier', why: 'Sensitive skin', what_to_do: 'Use richer moisturizer.' }],
            jetlag_sleep: {
              hours_diff: 9,
              risk_level: 'high',
              sleep_tips: ['Shift sleep before departure'],
              mask_tips: ['Use recovery mask on first night'],
            },
            categorized_kit: [
              {
                id: 'sun_protection',
                title: 'Sun protection',
                climate_link: 'UV 4 -> 7 (+3)',
                why: 'Use SPF50+ sunscreen outdoors.',
                ingredient_logic: 'Photostable filters',
                preparations: [{ name: 'SPF fluid', detail: 'Every 2 hours outdoors' }],
                brand_suggestions: [
                  {
                    product: 'UV Shield SPF50',
                    brand: 'Aurora Lab',
                    reason: 'High UV destination support.',
                    match_status: 'catalog_verified',
                  },
                ],
              },
            ],
            shopping_preview: {
              products: [{ product_id: 'prod_1', name: 'Barrier Cream', brand: 'Aurora Lab', reasons: ['repair'] }],
              brand_candidates: [
                { brand: 'Bioderma', match_status: 'kb_verified', reason: 'Barrier support' },
                { brand: 'LocalLab', match_status: 'llm_only', reason: 'Early-stage candidate' },
              ],
              buying_channels: ['beauty_retail', 'ecommerce'],
              city_hint: 'Paris',
            },
            store_examples: [{ name: 'Matsukiyo', type: 'Drugstore', district: 'Shibuya' }],
            structured_sections: {
              travel_kit: ['【Sun protection】 SPF50+ fluid + SPF stick', 'Barrier Cream'],
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
    expect(screen.getByText('Live weather')).toBeInTheDocument();
    expect(screen.getByText('Skincare concerns & preparation')).toBeInTheDocument();
    expect(screen.getByText('Sun protection')).toBeInTheDocument();
    expect(screen.getByText('UV 4 -> 7 (+3)')).toBeInTheDocument();
    expect(screen.getByText('Personal focus')).toBeInTheDocument();
    expect(screen.getByText('Jet lag & sleep')).toBeInTheDocument();
    expect(screen.getByText('Daily forecast (expand)')).toBeInTheDocument();
    expect(screen.getByText('Weather alerts')).toBeInTheDocument();
    expect(screen.getByText(/Wind advisory/i)).toBeInTheDocument();
    expect(screen.queryByText('Shopping preview')).not.toBeInTheDocument();
    expect(screen.getByText('Why this score (expand)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View suggested products (1)' })).toBeInTheDocument();
    expect(screen.getByText('Where to buy')).toBeInTheDocument();
    expect(screen.getByText('Example stores')).toBeInTheDocument();
    expect(screen.getByText(/Matsukiyo/i)).toBeInTheDocument();
    expect(screen.getByText('Want a more accurate signal? Add a quick check-in.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View suggested products (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'See full recommendations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refine with AM/PM' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open daily check-in' }));

    expect(screen.getByText(/UV Shield SPF50/i)).toBeInTheDocument();
    expect(screen.getByText('Catalog verified')).toBeInTheDocument();
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

  it('hides daily forecast and shows climate baseline label during fallback mode', () => {
    render(
      <EnvStressCard
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 58,
          tier: 'Moderate',
          radar: [{ axis: 'Hydration', value: 55 }],
          notes: [],
          travel_readiness: {
            destination_context: {
              destination: 'Singapore',
              start_date: '2026-03-01',
              end_date: '2026-03-05',
              env_source: 'climate_fallback',
              weather_reason: 'geocode_no_results',
            },
            delta_vs_home: {
              summary_tags: ['baseline_unavailable', 'hot', 'humid', 'high_uv'],
            },
            forecast_window: [
              {
                date: '2026-03-01',
                temp_low_c: 14,
                temp_high_c: 22,
              },
            ],
            adaptive_actions: [{ why: 'High UV pressure', what_to_do: 'Keep sunscreen and after-sun care in the kit.' }],
            personal_focus: [{ focus: 'Heat management', why: 'Tropical conditions', what_to_do: 'Keep layers light and fragrance low.' }],
            structured_sections: {
              travel_kit: ['【Sun protection】 SPF50+ fluid + body sunscreen'],
            },
            confidence: {
              level: 'medium',
              missing_inputs: [],
              improve_by: [],
            },
          },
        }}
        language="EN"
      />,
    );

    expect(screen.getByText('Climate baseline estimate')).toBeInTheDocument();
    expect(screen.getByText('Destination climate')).toBeInTheDocument();
    expect(screen.getByText(/Live weather is unavailable, so the guidance below uses destination climate patterns/i)).toBeInTheDocument();
    expect(screen.queryByText('Daily forecast (expand)')).not.toBeInTheDocument();
    expect(screen.queryByText('Destination delta')).not.toBeInTheDocument();
    expect(screen.getByText('Travel skincare kit')).toBeInTheDocument();
  });

  it('renders contributor bars/chips when drivers exist and shows match-status badge correctly', () => {
    const { rerender } = render(
      <EnvStressCard
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 32,
          tier: 'Medium',
          tier_description: 'Medium stress: expect mild irritation/dryness.',
          radar: [
            { axis: 'Weather', value: 46, drivers: ['Temp: 19C', 'Humidity: 55.6%'] },
            { axis: 'UV', value: 28, drivers: ['UV index: 4.1'] },
            { axis: 'Barrier', value: 18, drivers: ['Drier than home'] },
          ],
          notes: [],
          travel_readiness: {
            destination_context: { destination: 'Paris' },
            structured_sections: {
              product_guidance: ['Barrier Cream', 'SPF stick'],
            },
            shopping_preview: {
              products: [
                {
                  product_id: 'prod_2',
                  name: 'Daily SPF Fluid',
                  brand: 'Aurora Lab',
                  product_source: 'catalog',
                  match_status: 'catalog_verified',
                  reasons: ['UV support'],
                },
              ],
            },
          },
        }}
        language="EN"
      />,
    );

    expect(screen.queryByText('Why this score (expand)')).not.toBeInTheDocument();
    expect(screen.getByText('Humidity: 55.6%')).toBeInTheDocument();
    expect(screen.getByText('Catalog verified')).toBeInTheDocument();
    expect(screen.getByText('Travel skincare kit')).toBeInTheDocument();
    expect(screen.getByText(/SPF stick/)).toBeInTheDocument();

    rerender(
      <EnvStressCard
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 32,
          tier: 'Medium',
          tier_description: 'Medium stress: expect mild irritation/dryness.',
          radar: [
            { axis: 'Weather', value: 46, drivers: ['Temp: 19C', 'Humidity: 55.6%'] },
            { axis: 'UV', value: 28, drivers: ['UV index: 4.1'] },
            { axis: 'Barrier', value: 18, drivers: ['Drier than home'] },
          ],
          notes: [],
          travel_readiness: {
            destination_context: { destination: 'Paris' },
            structured_sections: {
              packing_list: ['Travel SPF50+'],
            },
            shopping_preview: {
              products: [
                {
                  product_id: 'prod_2',
                  name: 'Daily SPF Fluid',
                  brand: 'Aurora Lab',
                  product_source: 'catalog',
                  match_status: 'catalog_verified',
                  reasons: ['UV support'],
                },
              ],
            },
          },
        }}
        language="EN"
      />,
    );

    expect(screen.getByText(/Travel SPF50\+/)).toBeInTheDocument();
  });
});
