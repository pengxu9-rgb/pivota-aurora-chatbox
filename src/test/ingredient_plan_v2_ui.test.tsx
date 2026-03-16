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
    expect(screen.getByText('Brand A')).toBeInTheDocument();
    expect(screen.getByText('$39.00')).toBeInTheDocument();
    expect(screen.getByText('Plan strength: Balanced')).toBeInTheDocument();
    expect(screen.getAllByText('Best match').length).toBeGreaterThan(0);
    expect(screen.queryByText('https://example.com/pdp')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /view product: niacinamide serum/i }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://agent.pivota.cc/products/prod_1?entry=aurora_chatbox',
      '_blank',
      'noopener,noreferrer',
    );

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

  it('renders guidance-only example product types instead of empty product copy', () => {
    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_guidance_only"
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'ceramide',
              ingredient_name: 'Ceramides',
              priority_score_0_100: 72,
              priority_level: 'high',
              why: ['Rule signal: barrier support'],
              usage_guidance: ['AM/PM'],
              products: {
                mode: 'guidance_only',
                example_product_types: ['ingredient-focused serum', 'fragrance-free moisturizer'],
                example_product_discovery_items: [
                  {
                    id: 'example_1',
                    label: 'ingredient-focused serum',
                    search_query: 'ceramide ingredient-focused serum skincare',
                    search_title: 'Ingredient-focused serum',
                  },
                  {
                    id: 'example_2',
                    label: 'fragrance-free moisturizer',
                    search_query: 'barrier repair ceramide fragrance-free moisturizer face skincare',
                    search_title: 'Fragrance-free moisturizer',
                  },
                ],
                note: 'Tap a product type to browse top matching products.',
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

    expect(screen.getByTestId('ingredient-guidance-product-examples')).toBeInTheDocument();
    expect(screen.getByText('Example product types')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse product type: ingredient-focused serum/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse product type: fragrance-free moisturizer/i })).toBeInTheDocument();
    expect(screen.getByText('Tap a product type to browse top matching products.')).toBeInTheDocument();
    expect(screen.queryByText('No strong product matches available at this time.')).not.toBeInTheDocument();
  });

  it('opens a guidance-only discovery drawer and loads matching sku candidates', async () => {
    const onOpenPdp = vi.fn();
    const resolveProductsSearch = vi.fn().mockResolvedValueOnce({
        products: [
          {
            product_id: 'prod_ceramide_1',
            merchant_id: 'merch_internal_1',
            brand: 'Brand C',
            title: 'Ceramide Barrier Cream',
            category: 'Moisturizer',
          },
        ],
        metadata: {
          search_decision: {
            decision_mode: 'guidance_only',
            query_step_strength: 'strong_goal_family',
            step_success_class: 'strong_goal_family',
            success_contract_result: {
              applied: true,
              satisfied: true,
              step_success_class: 'strong_goal_family',
              failure_class: null,
            },
          },
        },
      });

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_guidance_drawer"
        onOpenPdp={onOpenPdp}
        resolveProductsSearch={resolveProductsSearch}
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'ceramide',
              ingredient_name: 'Ceramides',
              priority_score_0_100: 72,
              priority_level: 'high',
              why: ['Rule signal: barrier support'],
              usage_guidance: ['AM/PM'],
              products: {
                mode: 'guidance_only',
                example_product_types: ['ceramide cream'],
                example_product_discovery_items: [
                  {
                    id: 'example_drawer_1',
                    label: 'ceramide cream',
                    search_query: 'ceramide barrier moisturizer',
                    search_title: 'Ceramide cream',
                    query_ladder_steps: [
                      {
                        query: 'ceramide barrier moisturizer',
                        intent_strength: 'strong_goal_family',
                        target_step_family: 'moisturizer',
                        source_policy: 'internal_first_then_external_supplement',
                        allow_external_seed: true,
                        external_seed_strategy: 'supplement_internal_first',
                        product_only: true,
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                      },
                      {
                        query: 'barrier repair ceramide moisturizer',
                        intent_strength: 'strong_goal_family',
                        target_step_family: 'moisturizer',
                        source_policy: 'internal_first_then_external_supplement',
                        allow_external_seed: true,
                        external_seed_strategy: 'supplement_internal_first',
                        product_only: true,
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                      },
                    ],
                  },
                ],
                note: 'Tap a product type to browse top matching products.',
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

    fireEvent.click(screen.getByRole('button', { name: /browse product type: ceramide cream/i }));

    expect(await screen.findByText('Ceramide Barrier Cream')).toBeInTheDocument();
    expect(resolveProductsSearch).toHaveBeenCalledTimes(1);
    expect(resolveProductsSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'ceramide barrier moisturizer',
        uiSurface: 'ingredient_plan_guidance_only',
        executionMode: 'server_owned_ladder',
        allowExternalSeed: true,
        externalSeedStrategy: 'supplement_internal_first',
        productOnly: true,
        targetStepFamily: 'moisturizer',
        queryStepStrength: 'strong_goal_family',
        decisionMode: 'guidance_only',
        sourcePolicy: 'internal_first_then_external_supplement',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /view product/i }));
    expect(onOpenPdp).toHaveBeenCalledWith({
      url: 'https://agent.pivota.cc/products/prod_ceramide_1?merchant_id=merch_internal_1&entry=aurora_chatbox',
      title: 'Brand C Ceramide Barrier Cream',
    });
  });

  it('opens internal PDPs for guidance-only discovery rows when product_id and merchant_id are present', async () => {
    const onOpenPdp = vi.fn();
    const resolveProductsSearch = vi.fn().mockResolvedValueOnce({
      products: [
        {
          product_id: 'ext_rose_1',
          merchant_id: 'external_seed',
          brand: 'Pixi',
          title: 'Rose Ceramide Cream',
          category: 'Moisturizer',
          external_redirect_url: 'https://redirect.example.com/rose-ceramide-cream',
        },
      ],
      metadata: {
        search_decision: {
          decision_mode: 'guidance_only',
          query_step_strength: 'strong_goal_family',
          step_success_class: 'strong_goal_family',
          success_contract_result: {
            applied: true,
            satisfied: true,
            step_success_class: 'strong_goal_family',
            failure_class: null,
          },
        },
      },
    });

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_guidance_external_redirect"
        onOpenPdp={onOpenPdp}
        resolveProductsSearch={resolveProductsSearch}
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'ceramide',
              ingredient_name: 'Ceramides',
              priority_score_0_100: 72,
              priority_level: 'high',
              why: ['Rule signal: barrier support'],
              usage_guidance: ['AM/PM'],
              products: {
                mode: 'guidance_only',
                example_product_types: ['ceramide cream'],
                example_product_discovery_items: [
                  {
                    id: 'example_drawer_external_1',
                    label: 'ceramide cream',
                    search_query: 'moisturizer barrier repair ceramide',
                    search_title: 'Ceramide cream',
                    query_ladder_steps: [
                      {
                        query: 'moisturizer barrier repair ceramide',
                        intent_strength: 'strong_goal_family',
                        target_step_family: 'moisturizer',
                        source_policy: 'internal_first_then_external_supplement',
                        allow_external_seed: true,
                        external_seed_strategy: 'supplement_internal_first',
                        product_only: true,
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                      },
                    ],
                  },
                ],
                note: 'Tap a product type to browse top matching products.',
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

    fireEvent.click(screen.getByRole('button', { name: /browse product type: ceramide cream/i }));
    expect(await screen.findByText('Rose Ceramide Cream')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /view product/i }));
    expect(onOpenPdp).toHaveBeenCalledWith({
      url: 'https://agent.pivota.cc/products/ext_rose_1?merchant_id=external_seed&entry=aurora_chatbox',
      title: 'Pixi Rose Ceramide Cream',
    });
  });

  it('falls back to external redirect when guidance-only discovery rows have no stable internal identity', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({ closed: false } as unknown as Window));
    const resolveProductsSearch = vi.fn().mockResolvedValueOnce({
      products: [
        {
          brand: 'Pixi',
          title: 'Rose Ceramide Cream',
          category: 'Moisturizer',
          external_redirect_url: 'https://redirect.example.com/rose-ceramide-cream',
        },
      ],
      metadata: {
        search_decision: {
          decision_mode: 'guidance_only',
          query_step_strength: 'strong_goal_family',
          step_success_class: 'strong_goal_family',
          success_contract_result: {
            applied: true,
            satisfied: true,
            step_success_class: 'strong_goal_family',
            failure_class: null,
          },
        },
      },
    });

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_guidance_external_fallback"
        resolveProductsSearch={resolveProductsSearch}
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'ceramide',
              ingredient_name: 'Ceramides',
              priority_score_0_100: 72,
              priority_level: 'high',
              why: ['Rule signal: barrier support'],
              usage_guidance: ['AM/PM'],
              products: {
                mode: 'guidance_only',
                example_product_types: ['ceramide cream'],
                example_product_discovery_items: [
                  {
                    id: 'example_drawer_external_fallback_1',
                    label: 'ceramide cream',
                    search_query: 'moisturizer barrier repair ceramide',
                    search_title: 'Ceramide cream',
                    query_ladder_steps: [
                      {
                        query: 'moisturizer barrier repair ceramide',
                        intent_strength: 'strong_goal_family',
                        target_step_family: 'moisturizer',
                        source_policy: 'internal_first_then_external_supplement',
                        allow_external_seed: true,
                        external_seed_strategy: 'supplement_internal_first',
                        product_only: true,
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                      },
                    ],
                  },
                ],
                note: 'Tap a product type to browse top matching products.',
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

    fireEvent.click(screen.getByRole('button', { name: /browse product type: ceramide cream/i }));
    expect(await screen.findByText('Rose Ceramide Cream')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /view product/i }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://redirect.example.com/rose-ceramide-cream',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });

  it('only shows Search online after the guidance-only query ladder is exhausted', async () => {
    const resolveProductsSearch = vi
      .fn()
      .mockResolvedValueOnce({
        products: [],
        clarification: {
          question: 'Do you have a brand preference?',
          options: ['No brand preference'],
          reason_code: 'CLARIFY_BRAND',
        },
        metadata: {
          clarification_suppressed: true,
          legacy_fallback_suppressed: true,
          search_decision: {
            decision_mode: 'guidance_only',
            query_step_strength: 'strong_goal_family',
            step_success_class: null,
            clarification_suppressed: true,
            legacy_fallback_suppressed: true,
            success_contract_result: {
              applied: true,
              satisfied: false,
              step_success_class: null,
              failure_class: 'retrieval_direction_weak',
            },
          },
        },
      });

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_guidance_exhausted"
        resolveProductsSearch={resolveProductsSearch}
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'ceramide',
              ingredient_name: 'Ceramides',
              priority_score_0_100: 72,
              priority_level: 'high',
              why: ['Rule signal: barrier support'],
              usage_guidance: ['AM/PM'],
              products: {
                mode: 'guidance_only',
                example_product_types: ['fragrance-free barrier moisturizer'],
                example_product_discovery_items: [
                  {
                    id: 'example_drawer_2',
                    label: 'fragrance-free barrier moisturizer',
                    search_query: 'ceramide barrier moisturizer',
                    search_title: 'Fragrance-free barrier moisturizer',
                    query_ladder_steps: [
                      {
                        query: 'ceramide barrier moisturizer',
                        intent_strength: 'strong_goal_family',
                        target_step_family: 'moisturizer',
                        source_policy: 'internal_first_then_external_supplement',
                        allow_external_seed: true,
                        external_seed_strategy: 'supplement_internal_first',
                        product_only: true,
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                      },
                      {
                        query: 'barrier repair moisturizer',
                        intent_strength: 'supportive_family',
                        target_step_family: 'moisturizer',
                        source_policy: 'internal_first_then_external_supplement',
                        allow_external_seed: true,
                        external_seed_strategy: 'supplement_internal_first',
                        product_only: true,
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                      },
                    ],
                  },
                ],
                note: 'Tap a product type to browse top matching products.',
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

    fireEvent.click(screen.getByRole('button', { name: /browse product type: fragrance-free barrier moisturizer/i }));

    expect(await screen.findByText('No strong matches yet for this product type.')).toBeInTheDocument();
    expect(screen.queryByText('Do you have a brand preference?')).not.toBeInTheDocument();
    expect(resolveProductsSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /search online/i })).toBeInTheDocument();
  });

  it('preserves guidance query step metadata while using a single fast-path request', async () => {
    const resolveProductsSearch = vi.fn().mockResolvedValueOnce({
        products: [
          {
            product_id: 'ext_rose_1',
            merchant_id: 'external_seed',
            brand: 'Pixi',
            title: 'Rose Ceramide Cream',
            category: 'Moisturizer',
          },
        ],
        metadata: {
          search_decision: {
            decision_mode: 'guidance_only',
            query_step_strength: 'strong_goal_family',
            step_success_class: 'strong_goal_family',
            success_contract_result: {
              applied: true,
              satisfied: true,
              step_success_class: 'strong_goal_family',
              failure_class: null,
            },
          },
        },
      });

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_guidance_legacy_duplicate_steps"
        resolveProductsSearch={resolveProductsSearch}
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'ceramide',
              ingredient_name: 'Ceramides',
              priority_score_0_100: 72,
              priority_level: 'high',
              why: ['Rule signal: barrier support'],
              usage_guidance: ['AM/PM'],
              products: {
                mode: 'guidance_only',
                example_product_types: ['ceramide cream'],
                example_product_discovery_items: [
                  {
                    id: 'example_drawer_legacy_duplicate',
                    label: 'ceramide cream',
                    search_query: 'ceramide barrier moisturizer',
                    search_title: 'Ceramide cream',
                    query_ladder: [
                      {
                        query: 'ceramide barrier moisturizer',
                        target_step_family: 'moisturizer',
                        allow_external_seed: false,
                        product_only: true,
                        intent_strength: 'strong_goal_family',
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                      },
                      {
                        query: 'ceramide barrier moisturizer',
                        target_step_family: 'moisturizer',
                        allow_external_seed: true,
                        external_seed_strategy: 'supplement_internal_first',
                        product_only: true,
                        intent_strength: 'strong_goal_family',
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                        source_policy: 'internal_first_then_external_supplement',
                      },
                    ],
                  },
                ],
                note: 'Tap a product type to browse top matching products.',
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

    fireEvent.click(screen.getByRole('button', { name: /browse product type: ceramide cream/i }));

    expect(await screen.findByText('Rose Ceramide Cream')).toBeInTheDocument();
    expect(resolveProductsSearch).toHaveBeenCalledTimes(1);
    expect(resolveProductsSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'ceramide barrier moisturizer',
        executionMode: 'server_owned_ladder',
        allowExternalSeed: true,
        externalSeedStrategy: 'supplement_internal_first',
        queryStepStrength: 'strong_goal_family',
      }),
    );
  });

  it('accepts legacy valid_hit serum results when shared success contract is not yet applied', async () => {
    const resolveProductsSearch = vi.fn().mockResolvedValueOnce({
      products: [
        {
          product_id: 'serum_1',
          merchant_id: 'external_seed',
          brand: 'Winona',
          title: 'Winona Soothing Repair Serum',
          category: 'Serum',
        },
      ],
      metadata: {
        search_decision: {
          decision_mode: 'guidance_only',
          query_step_strength: 'supportive_family',
          hit_quality: 'valid_hit',
          exact_step_topk_count: 1,
          same_family_topk_count: 1,
          step_success_class: null,
          success_contract_result: {
            applied: false,
            satisfied: false,
            step_success_class: null,
            failure_class: null,
          },
        },
      },
    });

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_guidance_serum_compat"
        resolveProductsSearch={resolveProductsSearch}
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'panthenol',
              ingredient_name: 'Panthenol (B5)',
              priority_score_0_100: 72,
              priority_level: 'high',
              why: ['Rule signal: low_confidence_gentle_only'],
              usage_guidance: ['AM/PM soothing support'],
              products: {
                mode: 'guidance_only',
                example_product_types: ['panthenol serum'],
                example_product_discovery_items: [
                  {
                    id: 'example_drawer_serum_compat',
                    label: 'panthenol serum',
                    search_query: 'panthenol serum',
                    search_title: 'Panthenol serum',
                    query_ladder_steps: [
                      {
                        query: 'panthenol serum',
                        intent_strength: 'strong_goal_family',
                        target_step_family: 'serum',
                        source_policy: 'internal_first_then_external_supplement',
                        allow_external_seed: true,
                        external_seed_strategy: 'supplement_internal_first',
                        product_only: true,
                        stop_on_success: true,
                        decision_mode: 'guidance_only',
                      },
                    ],
                  },
                ],
                note: 'Tap a product type to browse top matching products.',
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

    fireEvent.click(screen.getByRole('button', { name: /browse product type: panthenol serum/i }));
    expect(await screen.findByText('Winona Soothing Repair Serum')).toBeInTheDocument();
    expect(screen.queryByText('No strong matches yet for this product type.')).not.toBeInTheDocument();
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

  it('filters real backend external-seed makeup rows while keeping valid skincare PDP CTAs', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => ({ closed: false } as unknown as Window));

    render(
      <IngredientPlanCard
        variant="v2"
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="card_v2_ui_backendish"
        payload={{
          schema_version: 'aurora.ingredient_plan.v2',
          intensity: { level: 'gentle', label: 'Gentle', explanation: 'Barrier-first.' },
          targets: [
            {
              ingredient_id: 'uv_filters',
              ingredient_name: 'UV filters',
              priority_score_0_100: 82,
              priority_level: 'high',
              why: ['Rule signal: low_confidence_gentle_only'],
              usage_guidance: ['Daily AM final step'],
              products: {
                competitors: [
                  {
                    product_id: 'ext_bbe1ff8884f06d874bbccbd8',
                    merchant_id: 'external_seed',
                    brand: 'the ordinary',
                    name: 'UV Filters SPF 45 Serum',
                    display_name: 'UV Filters SPF 45 Serum',
                    image_url: 'https://theordinary.com/example.png',
                    category: 'external',
                    source: 'external_seed',
                    retrieval_source: 'external_seed',
                    retrieval_reason: 'external_seed_supplement',
                    price: { amount: 19.9, currency: 'USD', unknown: false },
                    canonical_product_ref: { product_id: 'ext_bbe1ff8884f06d874bbccbd8', merchant_id: 'external_seed' },
                    url: 'https://agent.pivota.cc/products/ext_bbe1ff8884f06d874bbccbd8?merchant_id=external_seed&entry=aurora_chatbox',
                    pdp_url: 'https://agent.pivota.cc/products/ext_bbe1ff8884f06d874bbccbd8?merchant_id=external_seed&entry=aurora_chatbox',
                    product_url: 'https://agent.pivota.cc/products/ext_bbe1ff8884f06d874bbccbd8?merchant_id=external_seed&entry=aurora_chatbox',
                  },
                  {
                    product_id: 'ext_7b785d428200237b45d2a3e0',
                    merchant_id: 'external_seed',
                    brand: 'Fenty Beauty',
                    name: 'Gloss Bomb Cream Color Drip Lip Cream — Mauve Wive$',
                    display_name: 'Gloss Bomb Cream Color Drip Lip Cream — Mauve Wive$',
                    category: 'external',
                    source: 'external_seed',
                    pdp_url: 'https://agent.pivota.cc/products/ext_7b785d428200237b45d2a3e0?merchant_id=external_seed&entry=aurora_chatbox',
                  },
                  {
                    product_id: 'ext_f4c5fce9fe8b50130878fb76',
                    merchant_id: 'external_seed',
                    brand: 'Fenty Beauty',
                    name: "Diamond Bomb All-Over Diamond Veil — Lavender Luv'r",
                    display_name: "Diamond Bomb All-Over Diamond Veil — Lavender Luv'r",
                    category: 'external',
                    source: 'external_seed',
                    pdp_url: 'https://agent.pivota.cc/products/ext_f4c5fce9fe8b50130878fb76?merchant_id=external_seed&entry=aurora_chatbox',
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
    expect(screen.getByText('$19.90')).toBeInTheDocument();
    expect(screen.queryByText(/Gloss Bomb Cream/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Diamond Bomb All-Over Diamond Veil/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /view product: uv filters spf 45 serum/i }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://agent.pivota.cc/products/ext_bbe1ff8884f06d874bbccbd8?merchant_id=external_seed&entry=aurora_chatbox',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });
});
