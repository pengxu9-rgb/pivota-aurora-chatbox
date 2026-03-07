import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/pivotaAgentBff', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pivotaAgentBff')>('@/lib/pivotaAgentBff');
  return {
    ...actual,
    bffJson: vi.fn(),
    sendRecoEmployeeFeedback: vi.fn(),
  };
});

vi.mock('@/lib/auroraAnalytics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auroraAnalytics')>('@/lib/auroraAnalytics');
  return {
    ...actual,
    emitAuroraProductParseMissing: vi.fn(),
    emitAuroraProductAnalysisDegraded: vi.fn(),
    emitAuroraProductAlternativesFiltered: vi.fn(),
    emitAuroraHowToLayerInlineOpened: vi.fn(),
  };
});

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { bffJson } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_v2',
    trace_id: args?.trace_id ?? 'trace_v2',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

// V4 payload fixture
function makeV4ProductAnalysisPayload() {
  return {
    assessment: {
      verdict: 'Suitable',
      verdict_level: 'cautiously_ok',
      data_quality_banner: 'Official INCI extraction was blocked; analysis based on INCIDecoder data only.',
      top_takeaways: [
        'Good UV protection with broad-spectrum filters.',
        'Lightweight for oily skin.',
      ],
      best_for: ['Oily-combination skin needing daytime SPF.'],
      watchouts: [
        {
          issue: 'Contains oxybenzone (potential irritant for sensitive skin)',
          status: 'confirmed',
          what_to_do: 'Consider a mineral SPF alternative if sensitivity occurs.',
        },
        {
          issue: 'Fragrance possible based on unverified INCI',
          status: 'possible',
          what_to_do: 'Patch test if reactive.',
        },
      ],
      how_to_use: {
        when: 'AM only',
        frequency: 'daily',
        order_in_routine: 'Last step of AM routine before makeup',
        pairing_rules: ['Apply after moisturizer and wait 2 minutes.'],
        stop_signs: ['Persistent redness or stinging after application.'],
      },
    },
    evidence: {
      product_type_reasoning: 'Name and URL contain "SPF", classified as spf.',
      key_functions: ['UV protection', 'Lightweight hydration'],
      key_ingredients_by_function: [
        { function: 'UV filters', ingredients: ['Oxybenzone', 'Avobenzone'], confidence: 'high' },
        { function: 'Humectants', ingredients: ['Glycerin'], confidence: 'medium' },
      ],
      social_signals: { typical_positive: ['lightweight', 'no white cast'], typical_negative: [] },
      sources: ['Official page'],
      expert_notes: ['Evidence source: INCIDecoder supplement used.'],
      confidence: 0.65,
      missing_info: ['on_page_fetch_blocked', 'incidecoder_source_used'],
    },
    inci_status: {
      extraction: 'blocked',
      consensus_tier: 'medium',
      verification_required: true,
      total_ingredients: 18,
      sources: [],
    },
    confidence: 0.65,
    missing_info: ['on_page_fetch_blocked', 'incidecoder_source_used'],
  };
}

function makeMarch7LabSeriesPayload() {
  return {
    product: {
      url: 'https://www.labseries.com/product/32020/91265/skincare/moisturizerspf/all-in-one-defense-lotion-moisturizer-spf-35/all-in-one?size=100ml_%2F_3.4oz',
      name: 'All-In-One Defense Lotion Moisturizer SPF 35',
      brand: 'Lab Series',
      price: {
        amount: 52,
        source: 'json_ld_offer',
        unknown: false,
        currency: 'USD',
        captured_at: '2026-03-04T08:25:46.570Z',
      },
      display_name: 'Lab Series All-In-One Defense Lotion Moisturizer SPF 35',
    },
    evidence: {
      science: {
        fit_notes: [
          'For sensitive or impaired-barrier days, start low-frequency and avoid same-night stacking of strong actives.',
          'Ingredient-source consistency is limited; cross-check with package INCI.',
        ],
        mechanisms: [
          'Peptide complexes are commonly used to support firmness and the look of fine lines (effect depends on formula and concentration).',
          'Humectant blend suggests hydration support and moisture retention.',
        ],
        risk_notes: [
          'May include fragrance-related ingredients; patch testing is recommended for sensitive skin.',
        ],
        key_ingredients: ['Acetyl Hexapeptide-8', 'Sodium Hyaluronate'],
      },
      sources: [
        {
          url: 'https://www.labseries.com/product/32020/91265/skincare/moisturizerspf/all-in-one-defense-lotion-moisturizer-spf-35/all-in-one?size=100ml_%2F_3.4oz',
          type: 'official_page',
          label: 'labseries.com',
          confidence: 0.78,
        },
        {
          url: 'https://incidecoder.com/products/lab-series-pro-ls-all-in-one-face-treatment',
          type: 'inci_decoder',
          label: 'INCIDecoder',
          confidence: 0.82,
        },
      ],
      confidence: 0.67,
      expert_notes: [
        'Evidence source: ingredient list parsed from labseries.com.',
        'INCIDecoder supplement loaded (60 ingredients, match=0.67).',
        'Price signal from page: USD 52 (used for comparable matching).',
      ],
      missing_info: [
        'retail_source_no_match',
        'incidecoder_source_used',
        'version_verification_needed',
        'concentration_unknown',
      ],
      social_signals: {
        platform_scores: {
          BrandSite: 0.88,
        },
        risk_for_groups: [
          'Sensitive skin: start low and monitor for stinging/redness.',
          'Acne-prone skin: watch for clogging/breakout feedback.',
          'Impaired barrier: prioritize moisturizer and reduce active layering.',
        ],
        typical_negative: ['drying feel'],
        typical_positive: ['hydration'],
      },
      key_ingredients_by_function: [
        {
          function: 'Humectants',
          ingredients: ['Sodium Hyaluronate'],
          confidence: 'medium',
        },
      ],
      product_type_reasoning: 'Product type classified as spf_moisturizer based on name/URL/ingredient signals.',
    },
    assessment: {
      not_for: [
        'May include fragrance-related ingredients; patch testing is recommended for sensitive skin.',
      ],
      reasons: [
        'Fit signal: lower irritation exposure and redness risk; keep acne/comedone control on track.',
        'May include fragrance-related ingredients; patch testing is recommended for sensitive skin.',
        'On-page sentiment leans positive: hydration.',
      ],
      summary: 'May include fragrance-related ingredients; patch testing is recommended for sensitive skin.',
      verdict: 'Likely Suitable',
      best_for: [
        'Ingredient-source consistency is limited; cross-check with package INCI.',
      ],
      how_to_use: {
        when: 'AM only',
        frequency: 'daily',
        order_in_routine: 'Layer from thinnest to thickest; keep hydration before occlusive steps.',
        pairing_rules: [
          'Use daytime SPF as the final AM step.',
          'Reapply about every 2 hours when outdoors.',
        ],
        stop_signs: [
          'Persistent stinging beyond 30-60 seconds',
          'Worsening redness/dry itch',
          'Noticeable breakout or barrier instability signals',
        ],
      },
      if_not_ideal: [
        'If persistent stinging/redness appears, pause this product and return to a gentle cleanse + barrier-repair baseline.',
      ],
      anchor_product: {
        url: 'https://www.labseries.com/product/32020/91265/skincare/moisturizerspf/all-in-one-defense-lotion-moisturizer-spf-35/all-in-one?size=100ml_%2F_3.4oz',
        name: 'All-In-One Defense Lotion Moisturizer SPF 35',
        brand: 'Lab Series',
        price: {
          amount: 52,
          source: 'json_ld_offer',
          unknown: false,
          currency: 'USD',
          captured_at: '2026-03-04T08:25:46.570Z',
        },
        display_name: 'Lab Series All-In-One Defense Lotion Moisturizer SPF 35',
      },
      better_pairing: [
        'Pairing idea: keep consistent daytime SPF and single-variable PM iteration to judge fit reliably.',
      ],
      formula_intent: [
        'Peptide complexes are commonly used to support firmness and the look of fine lines (effect depends on formula and concentration).',
        'Humectant blend suggests hydration support and moisture retention.',
        'Core driver: Sodium Hyaluronate (humectant), mainly targeting Hydrates by binding water; usually low irritation.',
      ],
      hero_ingredient: {
        why: 'Hydrates by binding water; usually low irritation.',
        name: 'Sodium Hyaluronate',
        role: 'humectant',
        source: 'heuristic',
      },
      follow_up_question: 'Do you prefer "gentler" or "faster-visible results"? I can tune the next-step options based on that.',
      ingredient_confidence_tier: 'low',
      verdict_level: 'needs_verification',
      top_takeaways: [
        'Peptide complexes are commonly used to support firmness and the look of fine lines (effect depends on formula and concentration).',
        'Humectant blend suggests hydration support and moisture retention.',
        'Core driver: Sodium Hyaluronate (humectant), mainly targeting Hydrates by binding water; usually low irritation.',
        'Fit signal: lower irritation exposure and redness risk; keep acne/comedone control on track.',
      ],
      watchouts: [
        {
          issue: 'May include fragrance-related ingredients; patch testing is recommended for sensitive skin.',
          status: 'possible',
          what_to_do: 'Patch test first; stop if stinging or redness persists.',
        },
      ],
      data_quality_banner:
        'Ingredient evidence relies on INCIDecoder and may vary by version/region. Cross-check your package INCI before relying on ingredient-specific guidance.',
    },
    confidence: 0.67,
    provenance: {
      generated_at: '2026-03-04T08:25:47.816Z',
      contract_version: 'aurora.product_intel.contract.v2',
      pipeline: 'reco_blocks_dag.v1',
      source: 'url_realtime_product_intel_async_backfill',
      source_chain: ['official_page', 'inci_decoder', 'llm_extraction'],
      quality_band: 'high',
      confidence_band: 'medium',
    },
    competitors: {
      candidates: [],
      _meta: {
        warnings: ['no_competitor_candidates_from_upstream'],
      },
      block_type: 'competitors',
    },
    dupes: {
      candidates: [],
      _meta: {
        warnings: ['dupes_missing'],
      },
      block_type: 'dupes',
    },
    related_products: {
      candidates: [],
      _meta: {
        confidence: {
          score: 0.678,
          level: 'med',
          reasons: ['related_products=upstream_or_router'],
        },
      },
      block_type: 'related_products',
    },
    missing_info: [
      'retail_source_no_match',
      'incidecoder_source_used',
      'version_verification_needed',
      'ingredient_concentration_unknown',
      'analysis_in_progress',
      'concentration_unknown',
    ],
    social_signals: {
      overall_summary: {
        top_pos_themes: ['hydration'],
        top_neg_themes: ['drying feel'],
        watchouts: [
          'Sensitive skin: start low and monitor for stinging/redness.',
          'Acne-prone skin: watch for clogging/breakout feedback.',
          'Impaired barrier: prioritize moisturizer and reduce active layering.',
        ],
      },
    },
    ingredient_intel: {
      inci_raw: 'Acetyl Hexapeptide-8, Sodium Hyaluronate',
      inci_normalized: [
        {
          inci: 'Acetyl Hexapeptide-8',
          functions: ['barrier_support', 'humectant_hydration'],
          risks: [],
          suitability_tags: [],
        },
        {
          inci: 'Sodium Hyaluronate',
          functions: ['humectant_hydration'],
          risks: [],
          suitability_tags: [],
        },
      ],
      actives: [
        {
          name: 'Acetyl Hexapeptide-8',
          rationale:
            'Peptide complexes are commonly used to support firmness and the look of fine lines (effect depends on formula and concentration).',
        },
        {
          name: 'Sodium Hyaluronate',
          rationale: 'Humectant blend suggests hydration support and moisture retention.',
        },
      ],
      red_flags: [
        'May include fragrance-related ingredients; patch testing is recommended for sensitive skin.',
      ],
    },
    user_facing_gaps: [
      'retail_source_no_match',
      'incidecoder_source_used',
      'version_verification_needed',
      'ingredient_concentration_unknown',
      'analysis_in_progress',
    ],
    confidence_by_block: {
      ingredient_intel: { score: 0.908, level: 'high' },
      skin_fit: { score: 0.875, level: 'high' },
      social_signals: { score: 0.805, level: 'high' },
      competitors: { score: 0.18, level: 'low' },
      related_products: { score: 0.64, level: 'med' },
      dupes: { score: 0.35, level: 'low' },
    },
    product_intel_contract_version: 'aurora.product_intel.contract.v2',
    inci_status: {
      extraction: 'success',
      consensus_tier: 'low',
      sources: [
        {
          type: 'official_page',
          url: 'https://www.labseries.com/product/32020/91265/skincare/moisturizerspf/all-in-one-defense-lotion-moisturizer-spf-35/all-in-one?size=100ml_%2F_3.4oz',
          confidence: 0.78,
          ingredient_count: null,
        },
        {
          type: 'inci_decoder',
          url: 'https://incidecoder.com/products/lab-series-pro-ls-all-in-one-face-treatment',
          confidence: 0.82,
          ingredient_count: null,
        },
      ],
      verification_required: true,
      total_ingredients: 2,
    },
  };
}

describe('BffChat product-analysis template v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        writable: true,
      });
    }
  });

  it('renders formula intent separately from fit notes and shows follow-up question', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_v2', trace_id: 'trace_bootstrap_v2' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_v2',
            trace_id: 'trace_parse_v2',
            cards: [
              {
                card_id: 'parse_v2',
                type: 'product_parse',
                payload: {
                  product: { brand: 'Lab Series', name: 'Defense Lotion SPF 35' },
                  confidence: 0.81,
                  missing_info: [],
                  parse_source: 'answer_json',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_v2',
            trace_id: 'trace_analyze_v2',
            cards: [
              {
                card_id: 'analyze_v2',
                type: 'product_analysis',
                payload: {
                  assessment: {
                    verdict: 'Caution',
                    summary: 'Usable for day wear but can feel drying for reactive skin.',
                    formula_intent: [
                      'Provides UV protection with broad-spectrum filters.',
                      'Adds lightweight hydration to reduce daytime dryness.',
                    ],
                    best_for: ['Oily-combination skin needing daytime SPF with light hydration.'],
                    not_for: ['Highly reactive skin during barrier-flare periods.'],
                    if_not_ideal: ['Switch to fragrance-free SPF and pause irritating actives for 1-2 weeks.'],
                    better_pairing: ['Pair with a barrier-repair moisturizer at night.'],
                    follow_up_question: 'Do you get tightness within 30 minutes after applying this SPF?',
                    reasons: [
                      'Your profile: oily / sensitivity=medium / barrier=healthy.',
                      'May feel drying when used without additional hydration.',
                    ],
                  },
                  evidence: {
                    science: { key_ingredients: ['niacinamide'], mechanisms: ['barrier support'], fit_notes: [], risk_notes: ['dryness risk'] },
                    social_signals: { typical_positive: [], typical_negative: [], risk_for_groups: [] },
                    expert_notes: ['Patch-test if currently irritated.'],
                    confidence: 0.71,
                    missing_info: ['version_verification_needed', 'social_signals_low_confidence'],
                  },
                  confidence: 0.71,
                  missing_info: ['version_verification_needed', 'social_signals_low_confidence'],
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);

    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, { target: { value: 'Lab Series Defense Lotion SPF 35' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getByText(/what the formula is trying to do/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/key takeaway/i)).toBeInTheDocument();
    expect(screen.getByText(/usable for day wear but can feel drying/i)).toBeInTheDocument();
    expect(screen.getByText(/provides uv protection with broad-spectrum filters/i)).toBeInTheDocument();
    expect(screen.getAllByText(/oily-combination skin needing daytime spf with light hydration/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/one smart follow-up question/i)).toBeInTheDocument();
    expect(screen.getByText(/do you get tightness within 30 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/analysis limits \(2\)/i)).toBeInTheDocument();

  });

  it('renders V4 payload: verdict_level badge, data_quality_banner, and watchouts', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_v4', trace_id: 'trace_bootstrap_v4' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_v4',
            trace_id: 'trace_parse_v4',
            cards: [
              {
                card_id: 'parse_v4',
                type: 'product_parse',
                payload: {
                  product: { brand: 'La Roche-Posay', name: 'Anthelios SPF 50' },
                  confidence: 0.9,
                  missing_info: [],
                  parse_source: 'answer_json',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_v4',
            trace_id: 'trace_analyze_v4',
            cards: [
              {
                card_id: 'analyze_v4',
                type: 'product_analysis',
                payload: makeV4ProductAnalysisPayload(),
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);

    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, { target: { value: 'La Roche-Posay Anthelios SPF 50' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    // V4: data quality banner
    await waitFor(() => {
      expect(screen.getByText(/data quality note/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/official inci extraction was blocked/i)).toBeInTheDocument();

    // V4: verdict_level badge (cautiously_ok)
    expect(screen.getByText(/cautiously ok/i)).toBeInTheDocument();

    // V4: top takeaways
    expect(screen.getByText(/good uv protection with broad-spectrum filters/i)).toBeInTheDocument();

    // V4: watchouts with status
    expect(screen.getByText(/contains oxybenzone/i)).toBeInTheDocument();
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/possible/i).length).toBeGreaterThan(0);
  });

  it('renders V4 payload: SPF how_to_use shows AM only guidance', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_spf', trace_id: 'trace_spf' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_spf',
            trace_id: 'trace_parse_spf',
            cards: [
              {
                card_id: 'parse_spf',
                type: 'product_parse',
                payload: {
                  product: { brand: 'EltaMD', name: 'UV Clear SPF 46' },
                  confidence: 0.88,
                  missing_info: [],
                  parse_source: 'answer_json',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_spf',
            trace_id: 'trace_analyze_spf',
            cards: [
              {
                card_id: 'analyze_spf',
                type: 'product_analysis',
                payload: {
                  ...makeV4ProductAnalysisPayload(),
                  assessment: {
                    ...makeV4ProductAnalysisPayload().assessment,
                    verdict_level: 'recommended',
                    data_quality_banner: null,
                    how_to_use: {
                      when: 'AM only',
                      frequency: 'daily',
                      order_in_routine: 'Last step before makeup',
                      pairing_rules: ['Apply every 2 hours when outdoors.'],
                      stop_signs: ['Stinging or redness on application.'],
                    },
                  },
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);

    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, { target: { value: 'EltaMD UV Clear SPF 46' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getByText(/how to use/i)).toBeInTheDocument();
    });

    // SPF should show AM only
    expect(screen.getByText(/AM only/i)).toBeInTheDocument();
    // Should show reapplication guidance
    expect(screen.getByText(/every 2 hours when outdoors/i)).toBeInTheDocument();
    // Should NOT contain PM-first language
    expect(screen.queryByText(/pm first/i)).toBeNull();
    expect(screen.queryByText(/2-3 nights/i)).toBeNull();
  });

  it('V4 rendering isolates data-quality lines and filters heading tokens in ingredient chips', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_v4_clean', trace_id: 'trace_v4_clean' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_v4_clean',
            trace_id: 'trace_parse_v4_clean',
            cards: [
              {
                card_id: 'parse_v4_clean',
                type: 'product_parse',
                payload: {
                  product: { brand: 'Lab Series', name: 'Defense Lotion SPF 35' },
                  confidence: 0.9,
                  missing_info: [],
                  parse_source: 'answer_json',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_v4_clean',
            trace_id: 'trace_analyze_v4_clean',
            cards: [
              {
                card_id: 'analyze_v4_clean',
                type: 'product_analysis',
                payload: {
                  ...makeV4ProductAnalysisPayload(),
                  assessment: {
                    ...makeV4ProductAnalysisPayload().assessment,
                    formula_intent: [
                      'Humectant blend suggests hydration support and moisture retention.',
                      'Official-page INCI extraction was blocked; INCIDecoder was used as a supplemental source.',
                    ],
                  },
                  evidence: {
                    ...makeV4ProductAnalysisPayload().evidence,
                    key_ingredients_by_function: [],
                    science: {
                      key_ingredients: ['Key Ingredients', 'Sodium Hyaluronate'],
                      mechanisms: ['Humectant blend suggests hydration support and moisture retention.'],
                      fit_notes: [],
                      risk_notes: [],
                    },
                  },
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);
    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, { target: { value: 'Lab Series Defense Lotion SPF 35' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await screen.findByText(/what the formula is trying to do/i);
    expect(screen.getAllByText(/humectant blend suggests hydration support/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^official-page inci extraction was blocked/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^key ingredients$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /sodium hyaluronate/i })).toBeInTheDocument();
  });

  it('social snapshot avoids blanket caution when only generic risk-group bullets are present', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_social_tone', trace_id: 'trace_social_tone' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_social_tone',
            trace_id: 'trace_parse_social_tone',
            cards: [
              {
                card_id: 'parse_social_tone',
                type: 'product_parse',
                payload: {
                  product: { brand: 'Demo', name: 'Hydrating Gel' },
                  confidence: 0.85,
                  missing_info: [],
                  parse_source: 'answer_json',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_social_tone',
            trace_id: 'trace_analyze_social_tone',
            cards: [
              {
                card_id: 'analyze_social_tone',
                type: 'product_analysis',
                payload: {
                  ...makeV4ProductAnalysisPayload(),
                  evidence: {
                    ...makeV4ProductAnalysisPayload().evidence,
                    social_signals: {
                      typical_positive: ['hydration'],
                      typical_negative: [],
                      risk_for_groups: [
                        'Sensitive skin: start low and monitor for stinging/redness.',
                        'Acne-prone skin: watch for clogging/breakout feedback.',
                        'Impaired barrier: prioritize moisturizer and reduce active layering.',
                      ],
                    },
                  },
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);
    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, { target: { value: 'Demo Hydrating Gel' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await screen.findByText(/social feedback snapshot/i);
    expect(screen.queryByText(/overall feedback suggests caution/i)).toBeNull();
  });

  it('dupe_compare limited mode shows compact guidance and supports price.amount', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_dupe', trace_id: 'trace_bootstrap_dupe' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_dupe_limited',
            trace_id: 'trace_dupe_limited',
            cards: [
              {
                card_id: 'dupe_limited',
                type: 'dupe_compare',
                payload: {
                  original: {
                    brand: 'Lab Series',
                    name: 'All-In-One Defense Lotion',
                    price: { amount: 52, currency: 'USD' },
                  },
                  dupe: {
                    brand: 'Lab Series',
                    name: 'Defense Moisturizer',
                    price: { amount: 39, currency: 'USD' },
                  },
                  similarity: 0.73,
                  compare_quality: 'limited',
                  limited_reason: 'tradeoffs_detail_missing',
                  tradeoffs: ['No tradeoff details were returned (comparison is limited).'],
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const input = await screen.findByPlaceholderText(/ask a question/i);
    fireEvent.change(input, { target: { value: 'compare tradeoffs' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await screen.findByText(/tradeoff detail is missing/i);
    expect(screen.queryByText(/more tradeoffs/i)).toBeNull();
    expect(screen.queryAllByText(/price unavailable/i).length).toBe(0);
    expect(screen.getByText(/\$52/i)).toBeInTheDocument();
    expect(screen.getByText(/\$39/i)).toBeInTheDocument();
  });

  it('V3 payload backward compatibility: still renders verdict and key takeaway', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_v3_compat', trace_id: 'trace_v3_compat' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_v3_compat',
            trace_id: 'trace_parse_v3_compat',
            cards: [
              {
                card_id: 'parse_v3',
                type: 'product_parse',
                payload: {
                  product: { brand: 'CeraVe', name: 'Moisturizing Cream' },
                  confidence: 0.82,
                  missing_info: [],
                  parse_source: 'answer_json',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_v3_compat',
            trace_id: 'trace_analyze_v3_compat',
            cards: [
              {
                card_id: 'analyze_v3',
                type: 'product_analysis',
                payload: {
                  // V3 payload: no verdict_level field
                  assessment: {
                    verdict: 'Suitable',
                    summary: 'Great barrier-repair moisturizer for dry skin.',
                    formula_intent: ['Ceramides restore barrier function.'],
                    best_for: ['Dry and sensitive skin.'],
                    not_for: ['Very oily skin.'],
                    follow_up_question: 'Do you have any fragrance sensitivity?',
                    reasons: ['Contains ceramides and hyaluronic acid.'],
                  },
                  evidence: {
                    science: { key_ingredients: ['ceramide'], mechanisms: ['barrier support'], fit_notes: [], risk_notes: [] },
                    social_signals: { typical_positive: [], typical_negative: [], risk_for_groups: [] },
                    expert_notes: ['Evidence source: official page.'],
                    confidence: 0.82,
                    missing_info: [],
                  },
                  confidence: 0.82,
                  missing_info: [],
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);

    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, { target: { value: 'CeraVe Moisturizing Cream' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    // V3 fallback: should show verdict badge (not verdict_level)
    await waitFor(() => {
      expect(screen.getAllByText(/verdict:/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/suitable/i).length).toBeGreaterThan(0);
    // Should show V3 key takeaway
    expect(screen.getByText(/key takeaway/i)).toBeInTheDocument();
    // Should NOT show V4-specific fields that aren't present
    expect(screen.queryByText(/data quality note/i)).toBeNull();
    expect(screen.queryByText(/assessment:/i)).toBeNull();
  });

  it('renders the March 7 Lab Series payload, hides parse noise, and keeps compatibility footer active', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap_march7',
            trace_id: 'trace_bootstrap_march7',
            session_patch: {
              profile: {
                skinType: 'oily',
                sensitivity: 'medium',
                barrierStatus: 'impaired',
                goals: ['dark_spots', 'pores'],
                currentRoutine: {
                  am: [
                    { step: 'cleanser', product: 'Low-foam Gel Cleanser' },
                    { step: 'moisturizer', product: 'Barrier Gel Cream' },
                    { step: 'spf', product: 'Daily UV Fluid SPF 50' },
                  ],
                  pm: [
                    { step: 'cleanser', product: 'Low-foam Gel Cleanser' },
                    { step: 'treatment', product: 'Azelaic Acid Serum' },
                    { step: 'moisturizer', product: 'Barrier Gel Cream' },
                  ],
                },
              },
            },
          }),
        );
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_march7',
            trace_id: 'trace_parse_march7',
            cards: [
              {
                card_id: 'parse_march7',
                type: 'product_parse',
                payload: {
                  product: {
                    brand: 'Labseries',
                    name: 'All One',
                    url: 'https://www.labseries.com/product/32020/91265/skincare/moisturizerspf/all-in-one-defense-lotion-moisturizer-spf-35/all-in-one?size=100ml_%2F_3.4oz',
                  },
                  confidence: 0.25,
                  missing_info: ['anchor_soft_blocked_ambiguous', 'anchor_id_not_used_due_to_low_trust'],
                  parse_source: 'upstream_structured',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_march7',
            trace_id: 'trace_analyze_march7',
            cards: [
              {
                card_id: 'analyze_march7',
                type: 'product_analysis',
                payload: makeMarch7LabSeriesPayload(),
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);

    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, {
      target: {
        value:
          'https://www.labseries.com/product/32020/91265/skincare/moisturizerspf/all-in-one-defense-lotion-moisturizer-spf-35/all-in-one?size=100ml_%2F_3.4oz',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getByText(/data quality note/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/needs verification/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sodium hyaluronate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/ingredient evidence relies on incidecoder/i)).toBeInTheDocument();
    expect(screen.getByText(/advanced compatibility check/i)).toBeInTheDocument();
    expect(screen.queryByText(/confidence 25%/i)).toBeNull();
    expect(screen.queryByText(/source upstream structured/i)).toBeNull();
    expect(screen.queryByText(/an unreliable anchor was blocked from id binding/i)).toBeNull();
    expect(screen.queryByText(/this card failed to render and was safely downgraded/i)).toBeNull();
  });

  it('keeps product analysis renderable when optional subsections are malformed', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_malformed', trace_id: 'trace_bootstrap_malformed' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_malformed',
            trace_id: 'trace_parse_malformed',
            cards: [
              {
                card_id: 'parse_malformed',
                type: 'product_parse',
                payload: {
                  product: { brand: 'Demo', name: 'Hydration Gel' },
                  confidence: 0.8,
                  missing_info: [],
                  parse_source: 'answer_json',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_malformed',
            trace_id: 'trace_analyze_malformed',
            cards: [
              {
                card_id: 'analyze_malformed',
                type: 'product_analysis',
                payload: {
                  assessment: {
                    verdict: 'Likely Suitable',
                    verdict_level: 'cautiously_ok',
                    summary: 'Hydration-first gel texture with some irritation monitoring.',
                    reasons: ['Hydration-first gel texture with some irritation monitoring.'],
                    watchouts: [null, { text: 'Patch test first if your barrier is unstable.', recommendation: 'Stop if stinging persists.' }],
                    how_to_use: {
                      when: 'AM/PM',
                      frequency: 'daily',
                      order_in_routine: 'After cleansing',
                      pairing_rules: ['Keep strong acids on alternate nights.'],
                      stop_signs: ['Persistent redness'],
                    },
                  },
                  evidence: {
                    science: {
                      key_ingredients: ['Key Ingredients', 'Sodium Hyaluronate'],
                      mechanisms: ['Supports hydration retention.'],
                      fit_notes: [],
                      risk_notes: [],
                    },
                    key_ingredients_by_function: [
                      null,
                      { function: 'Humectants', ingredients: ['Sodium Hyaluronate', 'Key Ingredients'], confidence: 'medium' },
                    ],
                    social_signals: { typical_positive: ['hydration'], typical_negative: [], risk_for_groups: [] },
                    expert_notes: ['Evidence source: demo payload.'],
                    missing_info: [],
                  },
                  related_products: {
                    candidates: [
                      null,
                      'bad-shape',
                      {
                        brand: 'Brand X',
                        name: 'Hydration Cloud Gel',
                        similarity_score: 0.72,
                        why_candidate: {
                          reasons_user_visible: ['Hydration overlap'],
                        },
                      },
                    ],
                  },
                  competitors: { candidates: [null, 123] },
                  dupes: { candidates: [] },
                  confidence: 0.61,
                  missing_info: [],
                },
              },
            ],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const entry = await screen.findByRole('button', { name: /evaluate a specific product for me/i });
    fireEvent.click(entry);

    const productInput = await screen.findByPlaceholderText(/nivea creme/i);
    fireEvent.change(productInput, { target: { value: 'Demo Hydration Gel' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/sodium hyaluronate/i).length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText(/sodium hyaluronate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/advanced compatibility check/i)).toBeInTheDocument();
    expect(screen.queryByText(/this card failed to render and was safely downgraded/i)).toBeNull();
  });
});
