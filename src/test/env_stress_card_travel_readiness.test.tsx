import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EnvStressCard } from '@/components/aurora/cards/EnvStressCard';

describe('EnvStressCard travel readiness', () => {
  it('renders phase-first travel plan with grounded local shopping products', () => {
    const onOpenTravelProduct = vi.fn();

    render(
      <EnvStressCard
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 70,
          tier: 'Moderate',
          radar: [{ axis: 'UV', value: 70 }],
          notes: [],
          travel_readiness: {
            destination_context: {
              destination: 'Tokyo',
              start_date: '2026-04-27',
              end_date: '2026-05-02',
              env_source: 'weather_api',
            },
            delta_vs_origin: {
              temperature: { home: 12, destination: 23, delta: 11, unit: 'C' },
              humidity: { home: 62, destination: 78, delta: 16, unit: '%' },
              uv: { home: 4, destination: 7, delta: 3, unit: '' },
              summary_tags: ['warmer', 'more_humid', 'higher_uv'],
            },
            phase_plan: [
              {
                id: 'pre_trip_prepare',
                title: 'Before you leave',
                timing: 'T-3 to T-1',
                why: 'Pack tolerated core products.',
                actions: ['Pack daily SPF and a lightweight moisturizer.'],
                product_role_ids: ['sun_protection'],
                product_ids: [],
                coverage_status: 'category_only',
              },
              {
                id: 'flight_cabin',
                title: 'On the flight',
                timing: 'Boarding through arrival',
                why: 'Cabin dryness can increase tightness.',
                actions: ['Keep the cabin routine simple and low-irritation.'],
                product_role_ids: ['hydration_serum'],
                product_ids: [],
                coverage_status: 'category_only',
              },
              {
                id: 'arrival_first_48h',
                title: 'First 48 hours after landing',
                timing: 'Arrival day through night 2',
                why: 'Prioritize barrier comfort before new actives.',
                actions: ['Use gentle cleansing, moisturizer, and SPF.'],
                product_role_ids: ['lightweight_moisturizer'],
                product_ids: [],
                coverage_status: 'category_only',
              },
              {
                id: 'during_trip_daily',
                title: 'Daily while there',
                timing: 'Every trip day',
                why: 'Use lighter layers while keeping SPF consistent.',
                actions: ['AM moisturizer plus sunscreen; PM cleanse sunscreen well.'],
                product_role_ids: ['sun_protection'],
                product_ids: [],
                coverage_status: 'category_only',
              },
              {
                id: 'local_shopping',
                title: 'Shop locally',
                timing: 'After landing',
                why: 'Only catalog-grounded local products are shown.',
                actions: ['Review sunscreen and lightweight hydration options.'],
                product_role_ids: ['sun_protection'],
                product_ids: ['jp_spf_1'],
                coverage_status: 'grounded',
              },
            ],
            shopping_preview: {
              coverage_status: 'grounded',
              products: [
                {
                  product_id: 'jp_spf_1',
                  merchant_id: 'external_seed',
                  name: 'Biore UV Aqua Rich Watery Essence',
                  brand: 'Biore',
                  role_id: 'sun_protection',
                  product_source: 'external_seed',
                  authority_status: 'grounded',
                  match_status: 'catalog_verified',
                  display_mode: 'product_card',
                  is_grounded: true,
                  image_url: 'https://example.test/biore.jpg',
                  price: 1078,
                  currency: 'JPY',
                  pdp_open: { product_id: 'jp_spf_1', merchant_id: 'external_seed' },
                  reasons: ['Light sunscreen texture for humid Tokyo days.'],
                },
              ],
              buying_channels: ['beauty_retail', 'ecommerce'],
              city_hint: 'Tokyo',
            },
          },
        }}
        language="EN"
        onOpenTravelProduct={onOpenTravelProduct}
      />,
    );

    expect(screen.getByText('Step-by-step travel plan')).toBeInTheDocument();
    expect(screen.getByText('Before you leave')).toBeInTheDocument();
    expect(screen.getByText('On the flight')).toBeInTheDocument();
    expect(screen.getByText('First 48 hours after landing')).toBeInTheDocument();
    expect(screen.getByText('Daily while there')).toBeInTheDocument();
    expect(screen.getByText('Shop locally')).toBeInTheDocument();
    expect(screen.getAllByText('Category guidance').length).toBeGreaterThan(0);
    expect(screen.getByText('Grounded products')).toBeInTheDocument();
    expect(screen.getByText(/Biore UV Aqua Rich Watery Essence/)).toBeInTheDocument();
    expect(screen.getByText('JPY 1078')).toBeInTheDocument();
    expect(screen.queryByText('Skincare concerns & preparation')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View details for Biore UV/i }));
    expect(onOpenTravelProduct).toHaveBeenCalledWith(expect.objectContaining({ product_id: 'jp_spf_1' }));
  });

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
            origin_context: {
              label: 'San Francisco',
              source: 'trip_departure',
              baseline_status: 'ok',
            },
            delta_vs_origin: {
              temperature: { home: 18, destination: 10, delta: -8, unit: 'C' },
              humidity: { home: 58, destination: 76, delta: 18, unit: '%' },
              summary_tags: ['colder', 'more_humid'],
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

    expect(screen.getByText('Departure vs destination')).toBeInTheDocument();
    expect(screen.getByText('Departure 18C -> Destination 10C (delta -8C)')).toBeInTheDocument();
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

  it('builds product-oriented lookup queries when the travel sheet handler is available', () => {
    const onProductLookup = vi.fn();

    render(
      <EnvStressCard
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 61,
          tier: 'Moderate',
          radar: [{ axis: 'Hydration', value: 58 }],
          notes: [],
          travel_readiness: {
            destination_context: {
              destination: 'Singapore',
              start_date: '2026-03-01',
              end_date: '2026-03-05',
              env_source: 'weather_api',
              epi: 59,
            },
            categorized_kit: [
              {
                id: 'moisturization',
                title: 'Warmer / more humid',
                climate_link: 'Humidity 52% -> 74% (+22%)',
                why: 'Switch to a lighter hydrating layer.',
                ingredient_logic: 'Humectants and lighter gels.',
                preparations: [{ name: 'Gel moisturizer', detail: 'Lightweight daytime layer' }],
                brand_suggestions: [
                  {
                    product: 'Hydra Gel Cream',
                    brand: 'Aurora Lab',
                    reason: 'Keeps hydration steady without a heavy finish.',
                    match_status: 'catalog_verified',
                  },
                ],
              },
            ],
            shopping_preview: {
              buying_channels: ['beauty_retail'],
            },
          },
        }}
        language="EN"
        onProductLookup={onProductLookup}
      />,
    );

    fireEvent.click(screen.getByText('Gel moisturizer'));
    expect(onProductLookup).toHaveBeenNthCalledWith(1, {
      searchQuery: 'Gel moisturizer',
      categoryTitle: 'Warmer / more humid',
      ingredientHints: 'Humectants and lighter gels.',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Browse products (1)' }));
    expect(onProductLookup).toHaveBeenNthCalledWith(2, {
      searchQuery: 'Hydra Gel Cream',
      categoryTitle: 'Warmer / more humid',
      ingredientHints: 'Humectants and lighter gels.',
      preferBrand: 'Aurora Lab',
    });
    expect(onProductLookup.mock.calls[1]?.[0]?.searchQuery).not.toBe('Warmer / more humid');
    expect(screen.queryByRole('button', { name: 'View suggested products (1)' })).not.toBeInTheDocument();
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

  it('switches heading to departure vs destination when delta_vs_origin exists', () => {
    render(
      <EnvStressCard
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 54,
          tier: 'Moderate',
          radar: [{ axis: 'Hydration', value: 50 }],
          notes: [],
          travel_readiness: {
            destination_context: {
              destination: 'Singapore',
              start_date: '2026-03-01',
              end_date: '2026-03-05',
              env_source: 'weather_api',
            },
            origin_context: {
              label: 'San Francisco',
              source: 'trip_departure',
              baseline_status: 'ok',
            },
            delta_vs_origin: {
              humidity: { home: 52, destination: 74, delta: 22, unit: '%' },
              summary_tags: ['more_humid'],
              baseline_status: 'ok',
            },
          },
        }}
        language="EN"
      />,
    );

    expect(screen.getByText('Departure vs destination')).toBeInTheDocument();
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
