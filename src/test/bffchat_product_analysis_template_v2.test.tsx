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
});
