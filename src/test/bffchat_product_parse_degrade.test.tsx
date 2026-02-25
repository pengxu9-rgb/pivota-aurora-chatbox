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
import { emitAuroraProductAnalysisDegraded, emitAuroraProductParseMissing } from '@/lib/auroraAnalytics';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_1',
    trace_id: args?.trace_id ?? 'trace_1',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

describe('BffChat product-parse degraded UX', () => {
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

  it('hides parse-missing card when analyze returns a meaningful verdict', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap',
            trace_id: 'trace_bootstrap',
            session_patch: {},
          }),
        );
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_1',
            trace_id: 'trace_parse_1',
            cards: [
              {
                card_id: 'parse_1',
                type: 'product_parse',
                payload: {
                  product: null,
                  confidence: null,
                  missing_info: ['upstream_missing_or_unstructured', 'catalog_no_match'],
                  parse_source: 'none',
                  recovery_path: ['upstream_structured_miss', 'answer_json_miss', 'catalog_no_match'],
                },
                field_missing: [{ field: 'product', reason: 'upstream_missing_or_unstructured' }],
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_1',
            trace_id: 'trace_analyze_1',
            cards: [
              {
                card_id: 'analyze_1',
                type: 'product_analysis',
                payload: {
                  assessment: {
                    verdict: 'Suitable',
                    reasons: ['Looks compatible for your current profile.'],
                  },
                  evidence: {
                    science: { key_ingredients: [], mechanisms: [], fit_notes: [], risk_notes: [] },
                    social_signals: { typical_positive: [], typical_negative: [], risk_for_groups: [] },
                    expert_notes: [],
                    confidence: 0.72,
                    missing_info: [],
                  },
                  confidence: 0.72,
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
    fireEvent.change(productInput, { target: { value: 'Mystery Serum' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      const analyzeCalls = mock.mock.calls.filter((call) => call[0] === '/v1/product/analyze');
      expect(analyzeCalls.length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Mystery Serum')).toBeInTheDocument();
    expect(screen.queryByText(/failed to parse a product entity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no stable product anchor was parsed/i)).not.toBeInTheDocument();
    expect(vi.mocked(emitAuroraProductParseMissing)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emitAuroraProductParseMissing).mock.calls[0][1]).toMatchObject({
      request_id: 'req_parse_1',
      bff_trace_id: 'trace_parse_1',
      reason: 'upstream_missing_or_unstructured',
    });
  });

  it('shows degraded parse reason labels when analyze verdict remains unknown', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_2', trace_id: 'trace_bootstrap_2' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_2',
            trace_id: 'trace_parse_2',
            cards: [
              {
                card_id: 'parse_2',
                type: 'product_parse',
                payload: {
                  product: null,
                  confidence: null,
                  missing_info: ['catalog_backend_not_configured'],
                  parse_source: 'none',
                  recovery_path: ['upstream_structured_miss', 'catalog_backend_not_configured'],
                },
                field_missing: [{ field: 'parse.fallback', reason: 'catalog_backend_not_configured' }],
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_2',
            trace_id: 'trace_analyze_2',
            cards: [
              {
                card_id: 'analyze_2',
                type: 'product_analysis',
                payload: {
                  assessment: {
                    verdict: 'Unknown',
                    reasons: ['Insufficient evidence to conclude suitability.'],
                  },
                  evidence: {
                    science: { key_ingredients: [], mechanisms: [], fit_notes: [], risk_notes: [] },
                    social_signals: { typical_positive: [], typical_negative: [], risk_for_groups: [] },
                    expert_notes: [],
                    confidence: null,
                    missing_info: ['evidence_missing'],
                  },
                  confidence: null,
                  missing_info: ['evidence_missing'],
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
    fireEvent.change(productInput, { target: { value: 'Mystery Serum' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getByText(/no stable product anchor was parsed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/catalog backend is not configured/i)).toBeInTheDocument();
  });

  it('shows product-analysis diagnostic labels and evidence sources for degraded URL flow', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_3', trace_id: 'trace_bootstrap_3' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_3',
            trace_id: 'trace_parse_3',
            cards: [
              {
                card_id: 'parse_3',
                type: 'product_parse',
                payload: {
                  product: { brand: 'Lab', name: 'Defense Lotion SPF 35', url: 'https://brand.example/spf35.html' },
                  confidence: 0.62,
                  missing_info: ['heuristic_url_parse'],
                  parse_source: 'heuristic_url',
                },
              },
            ],
          }),
        );
      }
      if (path === '/v1/product/analyze') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_analyze_3',
            trace_id: 'trace_analyze_3',
            cards: [
              {
                card_id: 'analyze_3',
                type: 'product_analysis',
                payload: {
                  assessment: {
                    verdict: 'Unknown',
                    reasons: [
                      'Official-page extraction was blocked by site policy (403).',
                      'Please paste the full INCI or share another official page.',
                    ],
                  },
                  evidence: {
                    science: { key_ingredients: [], mechanisms: [], fit_notes: [], risk_notes: [] },
                    social_signals: { typical_positive: [], typical_negative: [], risk_for_groups: [] },
                    expert_notes: ['Regulatory supplement loaded from DailyMed.'],
                    confidence: 0.41,
                    missing_info: ['evidence_missing'],
                    sources: [
                      { type: 'official_page', url: 'https://brand.example/spf35.html', label: 'Official page' },
                      { type: 'regulatory', url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=abc123', label: 'DailyMed' },
                      { type: 'inci_decoder', url: 'https://incidecoder.com/products/labseries-all-in-one-defense', label: 'INCIDecoder' },
                    ],
                  },
                  confidence: 0.41,
                  missing_info: [
                    'url_fetch_forbidden_403',
                    'regulatory_source_used',
                    'incidecoder_source_used',
                    'incidecoder_unverified_not_persisted',
                    'version_verification_needed',
                  ],
                  provenance: {
                    source_chain: ['official_page', 'regulatory', 'inci_decoder', 'llm_extraction'],
                    kb_write: {
                      attempted: true,
                      persisted: false,
                      blocked_reason: 'incidecoder_unverified_not_persisted',
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
    fireEvent.change(productInput, { target: { value: 'https://brand.example/spf35.html' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getByText(/current analysis limits/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/official page fetch was blocked by site policy \(403\)/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /official page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dailymed/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /incidecoder/i })).toBeInTheDocument();
    expect(vi.mocked(emitAuroraProductAnalysisDegraded)).toHaveBeenCalled();
  });

  it('shows anchor soft-block and KB quarantine diagnostics', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_4', trace_id: 'trace_bootstrap_4' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_4',
            trace_id: 'trace_parse_4',
            cards: [
              {
                card_id: 'parse_4',
                type: 'product_parse',
                payload: {
                  product: null,
                  confidence: 0.43,
                  missing_info: ['anchor_soft_blocked_url_mismatch', 'anchor_id_not_used_due_to_low_trust'],
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
            request_id: 'req_analyze_4',
            trace_id: 'trace_analyze_4',
            cards: [
              {
                card_id: 'analyze_4',
                type: 'product_analysis',
                payload: {
                  assessment: {
                    verdict: 'Unknown',
                    reasons: ['The target page was blocked by site policy (403).'],
                  },
                  evidence: {
                    science: { key_ingredients: [], mechanisms: [], fit_notes: [], risk_notes: [] },
                    social_signals: { typical_positive: [], typical_negative: [], risk_for_groups: [] },
                    expert_notes: [],
                    confidence: 0.33,
                    missing_info: ['evidence_missing'],
                  },
                  confidence: 0.33,
                  missing_info: ['kb_entry_quarantined', 'url_fetch_forbidden_403'],
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
    fireEvent.change(productInput, { target: { value: 'https://www.labseries.com/product/x' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getByText(/an unreliable anchor was blocked/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/a stale kb hit was quarantined and recalculated in real time/i)).toBeInTheDocument();
  });

  it('renders alternatives in competitors/dupes/related sections and hides non-skincare candidates', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap_5', trace_id: 'trace_bootstrap_5' }));
      }
      if (path === '/v1/product/parse') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_parse_5',
            trace_id: 'trace_parse_5',
            cards: [
              {
                card_id: 'parse_5',
                type: 'product_parse',
                payload: {
                  product: { brand: 'Lab Series', name: 'All-In-One Defense Lotion SPF 35' },
                  confidence: 0.7,
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
            request_id: 'req_analyze_5',
            trace_id: 'trace_analyze_5',
            cards: [
              {
                card_id: 'analyze_5',
                type: 'product_analysis',
                payload: {
                  assessment: {
                    verdict: 'Caution',
                    reasons: [
                      'Contains UV filters that may feel drying for some users.',
                      'How to use: Start 2-3x per week and increase slowly.',
                    ],
                  },
                  evidence: {
                    science: { key_ingredients: ['Niacinamide'], mechanisms: [], fit_notes: [], risk_notes: ['May feel drying'] },
                    social_signals: { typical_positive: [], typical_negative: [], risk_for_groups: [] },
                    expert_notes: [],
                    confidence: 0.55,
                    missing_info: [],
                  },
                  confidence: 0.55,
                  missing_info: ['competitors_non_skincare_filtered'],
                  competitors: {
                    candidates: [
                      {
                        product_id: 'cmp_ok_1',
                        brand: 'Brand A',
                        name: 'Hydrating SPF Lotion',
                        similarity_score: 0.72,
                        why_candidate: ['Good hydration profile'],
                      },
                      {
                        product_id: 'cmp_bad_1',
                        brand: 'Unknown',
                        name: 'S05 Moisturizer Brush',
                        similarity_score: 0.81,
                        why_candidate: ['Wrong category'],
                      },
                    ],
                  },
                  dupes: {
                    candidates: [
                      {
                        product_id: 'dupe_ok_1',
                        brand: 'Brand B',
                        name: 'Daily Defense SPF Lotion',
                        similarity_score: 0.67,
                        why_candidate: ['Lower price tradeoff'],
                      },
                    ],
                  },
                  related_products: {
                    candidates: [
                      {
                        product_id: 'rel_ok_1',
                        brand: 'Brand C',
                        name: 'Barrier Support Moisturizer',
                        similarity_score: 0.61,
                        why_candidate: ['Related use case'],
                      },
                    ],
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
    fireEvent.change(productInput, { target: { value: 'https://www.labseries.com/product/test' } });
    fireEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => {
      expect(screen.getByText(/comparable alternatives/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/^dupes$/i)).toBeInTheDocument();
    expect(screen.getByText(/related products/i)).toBeInTheDocument();
    expect(screen.queryByText(/s05 moisturizer brush/i)).not.toBeInTheDocument();
    expect(screen.getByText(/how to layer \(inline guidance\)/i)).toBeInTheDocument();
    expect(screen.getByText(/advanced compatibility check/i)).toBeInTheDocument();
  });
});
