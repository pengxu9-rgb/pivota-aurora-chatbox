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
});
