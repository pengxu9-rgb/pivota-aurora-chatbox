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
    fetchRecoAlternatives: vi.fn(),
    fetchRoutineSimulation: vi.fn(),
    bffChatStream: vi.fn().mockRejectedValue(new Error('stream unavailable in test')),
    sendRecoEmployeeFeedback: vi.fn(),
  };
});

import BffChat, { RecommendationsCard } from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { bffJson, fetchRecoAlternatives, fetchRoutineSimulation } from '@/lib/pivotaAgentBff';
import { toast } from '@/components/ui/use-toast';
import type { Card, V1Envelope } from '@/lib/pivotaAgentBff';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_v2_reco_card',
    trace_id: args?.trace_id ?? 'trace_v2_reco_card',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

const READY_TIMEOUT_MS = 5000;

async function waitForEnabledComposer() {
  const input = await screen.findByPlaceholderText(/ask a question/i);
  await waitFor(() => expect(input).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return input;
}

function renderChat() {
  render(
    <MemoryRouter initialEntries={['/chat']}>
      <ShopProvider>
        <BffChat />
      </ShopProvider>
    </MemoryRouter>,
  );
}

function renderRecommendationsCard(card: Card, args?: {
  onOpenPdp?: (args: { url: string; title?: string }) => void;
  onOpenAlternativesSheet?: (tracks: Array<Record<string, unknown>>) => void;
  loadAlternativesForItem?: (args: {
    anchorProductId?: string | null;
    productInput?: string | null;
    product?: Record<string, unknown> | null;
  }) => Promise<{ alternatives: Array<Record<string, unknown>>; llmTrace?: Record<string, unknown> | null } | null>;
  loadRecommendationCompatibility?: (routine: {
    am: Array<Record<string, unknown>>;
    pm: Array<Record<string, unknown>>;
  }) => Promise<{ analysisReady: boolean; safe: boolean; summary: string | null; conflicts: string[] } | null>;
}) {
  render(
    <RecommendationsCard
      card={card}
      language="EN"
      debug={false}
      onOpenPdp={args?.onOpenPdp}
      onOpenAlternativesSheet={args?.onOpenAlternativesSheet as any}
      loadAlternativesForItem={args?.loadAlternativesForItem}
      loadRecommendationCompatibility={args?.loadRecommendationCompatibility}
    />,
  );
}

describe('BffChat V2 recommendations cards', () => {
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

  it('opens internal PDP from the summary routine rows and surfaces compare actions without expanding details', async () => {
    const onOpenPdp = vi.fn();
    const onOpenAlternativesSheet = vi.fn();
    const loadAlternativesForItem = vi.fn().mockResolvedValue({
      alternatives: [
        {
          kind: 'similar',
          product: {
            brand: 'Fresh',
            name: 'Rose Face Mask',
          },
          reasons: ['Hydrating alternative'],
        },
      ],
    });

    renderRecommendationsCard({
      card_id: 'card_summary_actions',
      type: 'recommendations',
      payload: {
        recommendations: [
          {
            slot: 'pm',
            step: 'mask',
            brand: 'Laneige',
            name: 'Water Sleeping Mask',
            canonical_product_ref: {
              product_id: 'prod_mask_1',
              merchant_id: 'merchant_mask_1',
            },
            reasons: ['Hydrates overnight and supports barrier comfort.'],
          },
        ],
      },
    }, {
      onOpenPdp,
      onOpenAlternativesSheet,
      loadAlternativesForItem,
    });

    const summaryName = (await screen.findAllByText(/Water Sleeping Mask/i))[0];
    const summaryRow = summaryName.closest('[role="button"]');
    expect(summaryRow).toBeTruthy();
    fireEvent.click(summaryRow as HTMLElement);

    expect(onOpenPdp).toHaveBeenCalledTimes(1);
    expect(onOpenPdp.mock.calls[0]?.[0]?.url).toContain('/products/prod_mask_1');

    const compareButton = screen.getAllByRole('button', { name: /More comparison candidates/i })
      .find((element) => element.tagName === 'BUTTON');
    expect(compareButton).toBeTruthy();
    fireEvent.click(compareButton as HTMLElement);

    await waitFor(() => expect(loadAlternativesForItem).toHaveBeenCalledTimes(1), { timeout: READY_TIMEOUT_MS });
    expect(onOpenAlternativesSheet).toHaveBeenCalledTimes(1);
  });

  it('opens external/search fallback from summary routine rows for llm_seed items', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    renderRecommendationsCard({
      card_id: 'card_summary_external',
      type: 'recommendations',
      payload: {
        recommendations: [
          {
            slot: 'pm',
            step: 'mask',
            brand: 'Bioderma',
            name: 'Sensibio Comfort Mask',
            reasons: ['Comfort-focused external seed.'],
            pdp_open: {
              path: 'external',
              resolve_reason_code: 'NO_CANDIDATES',
              external: {
                url: 'https://example.com/bioderma-mask',
                query: 'Bioderma Sensibio Comfort Mask',
              },
            },
          },
        ],
      },
    });

    const summaryName = (await screen.findAllByText(/Sensibio Comfort Mask/i))[0];
    const summaryRow = summaryName.closest('[role="button"]');
    expect(summaryRow).toBeTruthy();
    fireEvent.click(summaryRow as HTMLElement);

    expect(openSpy).toHaveBeenCalledWith('https://example.com/bioderma-mask', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('renders V2 recommendations cards from metadata.recommendations via the legacy card renderer', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          cards: [
            {
              card_type: 'recommendations',
              metadata: {
                recommendation_meta: {
                  source_mode: 'llm_catalog_hybrid',
                  trigger_source: 'text',
                },
                recommendations: [
                  {
                    product_id: 'prod_mask_1',
                    merchant_id: 'merchant_mask_1',
                    brand: 'Winona',
                    name: 'Hydrating Repair Mask',
                    category: 'mask',
                    reasons: ['Supports hydration and barrier comfort.'],
                  },
                  {
                    brand: 'Bioderma',
                    name: 'Sensibio Comfort Mask',
                    category: 'mask',
                    reasons: ['Suggested for reactive skin when comfort matters.'],
                    pdp_open: {
                      path: 'external',
                      external: {
                        query: 'Bioderma Sensibio Comfort Mask',
                      },
                    },
                  },
                ],
              },
            },
          ],
          ops: {},
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Recommend a facial mask that suits me.' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByText(/Hydrating Repair Mask/i)).toBeInTheDocument();
    expect(screen.getByText(/Sensibio Comfort Mask/i)).toBeInTheDocument();
    expect(screen.getByText(/External/i)).toBeInTheDocument();
    expect(screen.getByText(/LLM \+ catalog match/i)).toBeInTheDocument();
    expect(screen.getByText(/Why this fits/i)).toBeInTheDocument();
    expect(screen.queryByText(/rules-only/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unknown\.response/i)).not.toBeInTheDocument();
  });

  it('renders nested product.brand/name from alternatives responses without unknown placeholders', async () => {
    const onOpenAlternativesSheet = vi.fn();

    renderRecommendationsCard({
      card_id: 'card_summary_external_compare',
      type: 'recommendations',
      payload: {
        recommendations: [
          {
            slot: 'pm',
            step: 'mask',
            brand: 'Laneige',
            name: 'Water Sleeping Mask',
            metadata: { match_state: 'llm_seed' },
            llm_suggestion: {
              search_aliases: ['Laneige Water Sleeping Mask'],
            },
            pdp_open: {
              path: 'external',
              external: {
                query: 'Laneige Water Sleeping Mask',
              },
            },
            reasons: ['Overnight hydration support.'],
            alternatives: [
              {
                product: {
                  brand: 'Fresh',
                  name: 'Rose Face Mask',
                },
                reasons: ['Hydrating alternative'],
                tradeoff_notes: ['Lighter clay profile'],
              },
              {
                reasons: ['Missing identity and should be filtered'],
              },
            ],
          },
        ],
      },
    }, {
      onOpenAlternativesSheet,
      loadRecommendationCompatibility: vi.fn().mockResolvedValue(null),
    });

    const compareButton = (await screen.findAllByRole('button', { name: /More comparison candidates/i }))
      .find((element) => element.tagName === 'BUTTON');
    expect(compareButton).toBeTruthy();
    fireEvent.click(compareButton as HTMLElement);

    await waitFor(() => expect(onOpenAlternativesSheet).toHaveBeenCalledTimes(1), { timeout: READY_TIMEOUT_MS });
    const firstTrack = onOpenAlternativesSheet.mock.calls[0]?.[0]?.[0];
    const firstCandidate = firstTrack?.items?.[0]?.display;
    expect(firstCandidate?.brand).toBe('Fresh');
    expect(firstCandidate?.name).toBe('Rose Face Mask');
    expect(firstTrack?.items).toHaveLength(1);
  });

  it('shows toast and skips opening a placeholder sheet when external compare returns empty', async () => {
    const mock = vi.mocked(bffJson);
    const alternativesMock = vi.mocked(fetchRecoAlternatives);
    const simMock = vi.mocked(fetchRoutineSimulation);
    const toastMock = vi.mocked(toast);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          cards: [
            {
              card_type: 'recommendations',
              metadata: {
                recommendation_meta: {
                  source_mode: 'llm_catalog_hybrid',
                },
                recommendations: [
                  {
                    slot: 'pm',
                    step: 'mask',
                    brand: 'Laneige',
                    name: 'Water Sleeping Mask',
                    metadata: { match_state: 'llm_seed' },
                    llm_suggestion: {
                      search_aliases: ['Laneige Water Sleeping Mask'],
                    },
                    pdp_open: {
                      path: 'external',
                      external: {
                        query: 'Laneige Water Sleeping Mask',
                      },
                    },
                    reasons: ['Overnight hydration support.'],
                  },
                ],
              },
            },
          ],
          ops: {},
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });
    simMock.mockResolvedValue(null as any);
    alternativesMock.mockResolvedValue({ alternatives: [] } as any);

    renderChat();
    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Recommend a facial mask that suits me.' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    const compareButton = (await screen.findAllByRole('button', { name: /More comparison candidates/i }))
      .find((element) => element.tagName === 'BUTTON');
    expect(compareButton).toBeTruthy();
    fireEvent.click(compareButton as HTMLElement);

    await waitFor(() => expect(alternativesMock).toHaveBeenCalledTimes(1), { timeout: READY_TIMEOUT_MS });
    await waitFor(() => expect(toastMock).toHaveBeenCalled(), { timeout: READY_TIMEOUT_MS });
    expect(toastMock.mock.calls.some(([payload]) => String((payload as any)?.title || '').includes('No extra comparison candidates yet'))).toBe(true);
    expect(screen.queryByText(/More alternatives & pairing ideas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unknown brand/i)).not.toBeInTheDocument();
  });

  it('shows compatibility only when lazy routine simulation returns analysis_ready', async () => {
    const mock = vi.mocked(bffJson);
    const simMock = vi.mocked(fetchRoutineSimulation);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          cards: [
            {
              card_type: 'recommendations',
              metadata: {
                recommendation_meta: {
                  source_mode: 'llm_catalog_hybrid',
                },
                recommendations: [
                  {
                    slot: 'pm',
                    step: 'serum',
                    brand: 'Geek & Gorgeous',
                    name: 'B-Bomb',
                    reasons: ['Niacinamide support for oil control.'],
                    key_actives: ['niacinamide'],
                    canonical_product_ref: {
                      product_id: 'prod_serum_1',
                      merchant_id: 'merchant_serum_1',
                    },
                  },
                ],
              },
            },
          ],
          ops: {},
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    simMock.mockResolvedValue(makeEnvelope({
      cards: [
        {
          card_id: 'sim_1',
          type: 'routine_simulation',
          payload: {
            safe: true,
            conflicts: [],
            summary: 'No major active-stacking risk detected.',
            analysis_ready: true,
          },
        },
      ],
    }));

    renderChat();
    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Recommend an acne serum.' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByText(/All products are compatible/i)).toBeInTheDocument();
    expect(screen.getByText(/No major active-stacking risk detected/i)).toBeInTheDocument();
  });

  it('hides compatibility when lazy routine simulation has no analysis-ready signal', async () => {
    const mock = vi.mocked(bffJson);
    const simMock = vi.mocked(fetchRoutineSimulation);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          cards: [
            {
              card_type: 'recommendations',
              metadata: {
                recommendation_meta: {
                  source_mode: 'llm_catalog_hybrid',
                },
                recommendations: [
                  {
                    slot: 'pm',
                    step: 'mask',
                    brand: 'Laneige',
                    name: 'Water Sleeping Mask',
                    reasons: ['Hydrates overnight.'],
                    pdp_open: {
                      path: 'external',
                      resolve_reason_code: 'NO_CANDIDATES',
                      external: {
                        query: 'Laneige Water Sleeping Mask',
                      },
                    },
                  },
                ],
              },
            },
          ],
          ops: {},
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    simMock.mockResolvedValue(makeEnvelope({
      cards: [
        {
          card_id: 'sim_2',
          type: 'routine_simulation',
          payload: {
            safe: true,
            conflicts: [],
            summary: 'No active signal found.',
            analysis_ready: false,
          },
        },
      ],
    }));

    renderChat();
    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Recommend a facial mask that suits me.' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => expect(simMock).toHaveBeenCalled(), { timeout: READY_TIMEOUT_MS });
    expect(screen.queryByText(/Compatibility not tested yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/All products are compatible/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No active signal found/i)).not.toBeInTheDocument();
  });

  it('renders V2 no-result text_response messages as plain assistant text', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          cards: [
            {
              card_type: 'text_response',
              sections: [
                {
                  type: 'text_answer',
                  text_en: "I couldn't find a strong catalog-grounded mask match yet. Share your main concern or a target ingredient and I can narrow it down.",
                },
              ],
            },
          ],
          ops: {},
          next_actions: [],
        });
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Recommend a facial mask that suits me.' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByText(/catalog-grounded mask match/i)).toBeInTheDocument();
  });
});
