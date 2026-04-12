import React from 'react';
import { fireEvent, render, screen, waitFor } from '@/test/testProviders';
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

    const compareButton = screen.getAllByRole('button', { name: /^Compare$/i })
      .find((element) => element.tagName === 'BUTTON');
    expect(compareButton).toBeTruthy();
    fireEvent.click(compareButton as HTMLElement);

    await waitFor(() => expect(loadAlternativesForItem).toHaveBeenCalledTimes(1), { timeout: READY_TIMEOUT_MS });
    expect(onOpenAlternativesSheet).toHaveBeenCalledTimes(1);
  });

  it('renders framework-first recommendations as top pick plus other options', async () => {
    renderRecommendationsCard({
      card_id: 'card_framework_reco',
      type: 'recommendations',
      payload: {
        recommendation_meta: {
          selected_target_ids: ['oil_control_treatment', 'lightweight_moisturizer', 'daily_sunscreen'],
        },
        framework_summary: {
          concern_text: 'oily skin',
          prioritized_roles: [
            { role_id: 'oil_control_treatment', label: 'Oil-control treatment', why_this_role: 'Start with a targeted oil-control step.', rank: 1 },
            { role_id: 'lightweight_moisturizer', label: 'Lightweight moisturizer', why_this_role: 'Keep hydration breathable.', rank: 2 },
            { role_id: 'daily_sunscreen', label: 'Daily sunscreen', why_this_role: 'Protect during the day.', rank: 3 },
          ],
        },
        roles: [
          { role_id: 'oil_control_treatment', label: 'Oil-control treatment', why_this_role: 'Start with a targeted oil-control step.', rank: 1 },
          { role_id: 'lightweight_moisturizer', label: 'Lightweight moisturizer', why_this_role: 'Keep hydration breathable.', rank: 2 },
          { role_id: 'daily_sunscreen', label: 'Daily sunscreen', why_this_role: 'Protect during the day.', rank: 3 },
        ],
        primary_role_id: 'oil_control_treatment',
        primary_recommendation_id: 'serum_1',
        sections: [
          {
            kind: 'product_cards',
            products: [
              {
                product_id: 'serum_1',
                merchant_id: 'merchant_serum_1',
                brand: 'Clear Lab',
                name: 'Oil Balance Serum',
                matched_role_id: 'oil_control_treatment',
                matched_role_label: 'Oil-control treatment',
                why_this_one: 'Directly targets excess shine without adding weight.',
                price_label: '$12',
                image_url: 'https://example.com/oil-balance.jpg',
                key_features: ['Niacinamide 10%', 'Zinc 1%', 'Lightweight serum'],
              },
              {
                product_id: 'cream_1',
                merchant_id: 'merchant_cream_1',
                brand: 'Balance Lab',
                name: 'Air Gel Cream',
                matched_role_id: 'lightweight_moisturizer',
                matched_role_label: 'Lightweight moisturizer',
                why_this_one: 'Adds breathable hydration without a greasy finish.',
                price_label: '$28',
                image_url: 'https://example.com/air-gel.jpg',
                key_features: ['Gel-cream texture', 'Breathable hydration'],
              },
              {
                product_id: 'spf_1',
                merchant_id: 'merchant_spf_1',
                brand: 'Solaris',
                name: 'Daily UV Fluid SPF 50',
                matched_role_id: 'daily_sunscreen',
                matched_role_label: 'Daily sunscreen',
                why_this_one: 'Keeps daytime protection lightweight.',
                price_label: '$19',
                image_url: 'https://example.com/uv-fluid.jpg',
                key_features: ['SPF 50', 'Lightweight fluid'],
              },
            ],
          },
        ],
        recommendations: [
          {
            product_id: 'serum_1',
            merchant_id: 'merchant_serum_1',
            brand: 'Clear Lab',
            name: 'Oil Balance Serum',
            display_name: 'Oil Balance Serum',
            step: 'treatment',
            matched_role_id: 'oil_control_treatment',
            matched_role_label: 'Oil-control treatment',
            canonical_product_ref: {
              product_id: 'serum_1',
              merchant_id: 'merchant_serum_1',
            },
            notes: ['Start with a targeted oil-control step to manage shine.'],
            reasons: ['Best first step for managing shine.'],
          },
          {
            product_id: 'cream_1',
            merchant_id: 'merchant_cream_1',
            brand: 'Balance Lab',
            name: 'Air Gel Cream',
            display_name: 'Air Gel Cream',
            step: 'moisturizer',
            matched_role_id: 'lightweight_moisturizer',
            matched_role_label: 'Lightweight moisturizer',
            canonical_product_ref: {
              product_id: 'cream_1',
              merchant_id: 'merchant_cream_1',
            },
            notes: ['Keeps hydration light and breathable.'],
            reasons: ['Balanced hydration for oily skin.'],
          },
          {
            product_id: 'spf_1',
            merchant_id: 'merchant_spf_1',
            brand: 'Solaris',
            name: 'Daily UV Fluid SPF 50',
            display_name: 'Daily UV Fluid SPF 50',
            step: 'sunscreen',
            matched_role_id: 'daily_sunscreen',
            matched_role_label: 'Daily sunscreen',
            canonical_product_ref: {
              product_id: 'spf_1',
              merchant_id: 'merchant_spf_1',
            },
            notes: ['Daytime UV protection still matters.'],
            reasons: ['Daily protection for daytime use.'],
          },
        ],
      },
    });

    expect(await screen.findByText(/oily skin recommendations for you/i)).toBeInTheDocument();
    expect(screen.getByText(/Basic routine/i)).toBeInTheDocument();
    expect(screen.getByText(/Suggested starting point/i)).toBeInTheDocument();
    expect(screen.getByText(/Other routine steps/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Oil Balance Serum/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Air Gel Cream/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Daily UV Fluid SPF 50/i).length).toBeGreaterThan(0);
    expect(screen.getByText('$12')).toBeInTheDocument();
    expect(screen.getByText('$28')).toBeInTheDocument();
    expect(screen.getByText('$19')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /View details/i }).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Morning Routine/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/More comparison candidates/i)).not.toBeInTheDocument();
  });

  it('uses neutral lead-pick framing for same-role comparison bundles', async () => {
    renderRecommendationsCard({
      card_id: 'card_same_role_compare',
      type: 'recommendations',
      payload: {
        recommendation_meta: {
          selected_target_ids: ['daily_sunscreen'],
          comparison_mode: 'same_role_comparison',
        },
        framework_summary: {
          concern_text: 'daily sunscreen',
          prioritized_roles: [
            { role_id: 'daily_sunscreen', label: 'Daily sunscreen', why_this_role: 'Keep protection lightweight.', rank: 1 },
          ],
        },
        roles: [
          { role_id: 'daily_sunscreen', label: 'Daily sunscreen', why_this_role: 'Keep protection lightweight.', rank: 1 },
        ],
        primary_role_id: 'daily_sunscreen',
        primary_recommendation_id: 'spf_1',
        sections: [
          {
            kind: 'product_cards',
            products: [
              {
                product_id: 'spf_1',
                merchant_id: 'merchant_spf_1',
                brand: 'Solaris',
                name: 'Invisible UV Serum SPF 50',
                matched_role_id: 'daily_sunscreen',
                matched_role_label: 'Daily sunscreen',
                why_this_one: 'Lightweight daily coverage.',
                price_label: '$19',
                same_role_peer_count: 3,
              },
              {
                product_id: 'spf_2',
                merchant_id: 'merchant_spf_2',
                brand: 'Filter Lab',
                name: 'Oil-Control Sun Fluid SPF 50',
                matched_role_id: 'daily_sunscreen',
                matched_role_label: 'Daily sunscreen',
                why_this_one: 'Mattifying finish for oily skin.',
                price_label: '$24',
                same_role_peer_count: 3,
              },
            ],
          },
        ],
        recommendations: [
          {
            product_id: 'spf_1',
            merchant_id: 'merchant_spf_1',
            brand: 'Solaris',
            name: 'Invisible UV Serum SPF 50',
            step: 'sunscreen',
            matched_role_id: 'daily_sunscreen',
            matched_role_label: 'Daily sunscreen',
            comparison_mode: 'same_role_comparison',
            same_role_peer_count: 3,
            canonical_product_ref: {
              product_id: 'spf_1',
              merchant_id: 'merchant_spf_1',
            },
            reasons: ['Lightweight daily coverage.'],
          },
          {
            product_id: 'spf_2',
            merchant_id: 'merchant_spf_2',
            brand: 'Filter Lab',
            name: 'Oil-Control Sun Fluid SPF 50',
            step: 'sunscreen',
            matched_role_id: 'daily_sunscreen',
            matched_role_label: 'Daily sunscreen',
            comparison_mode: 'same_role_comparison',
            same_role_peer_count: 3,
            canonical_product_ref: {
              product_id: 'spf_2',
              merchant_id: 'merchant_spf_2',
            },
            reasons: ['Mattifying finish for oily skin.'],
          },
        ],
      },
    });

    expect(await screen.findByText(/Same-type comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/Current lead pick/i)).toBeInTheDocument();
    expect(screen.getByText(/Compare finish, price, and tradeoffs before deciding/i)).toBeInTheDocument();
    expect(screen.getByText(/Comparison picks/i)).toBeInTheDocument();
  });

  it('prefers payload.sections product rows as the display source while keeping payload.recommendations PDP refs', async () => {
    const onOpenPdp = vi.fn();

    renderRecommendationsCard({
      card_id: 'card_sections_authority',
      type: 'recommendations',
      payload: {
        framework_summary: {
          concern_text: 'oily skin',
          prioritized_roles: [
            { role_id: 'oil_control_treatment', label: 'Oil-control treatment', why_this_role: 'Start with a targeted oil-control step.', rank: 1 },
          ],
        },
        roles: [
          { role_id: 'oil_control_treatment', label: 'Oil-control treatment', why_this_role: 'Start with a targeted oil-control step.', rank: 1 },
        ],
        primary_role_id: 'oil_control_treatment',
        primary_recommendation_id: 'serum_1',
        sections: [
          {
            kind: 'product_cards',
            products: [
              {
                product_id: 'serum_1',
                merchant_id: 'merchant_serum_1',
                brand: 'Clear Lab',
                name: 'Oil Balance Serum',
                matched_role_id: 'oil_control_treatment',
                matched_role_label: 'Oil-control treatment',
                why_this_one: 'Section-row summary should win.',
                price_label: '$12',
                image_url: 'https://example.com/oil-balance.jpg',
              },
            ],
          },
        ],
        recommendations: [
          {
            product_id: 'serum_1',
            merchant_id: 'merchant_serum_1',
            brand: 'Raw Brand',
            name: 'Raw Payload Name',
            step: 'treatment',
            matched_role_id: 'oil_control_treatment',
            canonical_product_ref: {
              product_id: 'serum_1',
              merchant_id: 'merchant_serum_1',
            },
            reasons: ['Payload-level reason for PDP open.'],
          },
        ],
      },
    }, {
      onOpenPdp,
    });

    expect(await screen.findByText('Section-row summary should win.')).toBeInTheDocument();
    expect(screen.getAllByText('Oil Balance Serum').length).toBeGreaterThan(0);
    expect(screen.queryByText('Raw Payload Name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /View details/i }));
    await waitFor(() => {
      expect(onOpenPdp).toHaveBeenCalledTimes(1);
    });
    expect(onOpenPdp.mock.calls[0]?.[0]?.url).toContain('/products/serum_1');
  });

  it('opens external/search fallback from summary routine rows for llm_seed items', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null as any);

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
            metadata: { match_state: 'llm_seed' },
            reasons: ['Comfort-focused external seed.'],
            pdp_open: {
              path: 'external',
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
    expect(toast).not.toHaveBeenCalled();
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

    const compareButton = (await screen.findAllByRole('button', { name: /^Compare$/i }))
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

  it('shows up to five inline alternatives and labels cosmetic-finish sunscreen options', async () => {
    renderRecommendationsCard({
      card_id: 'card_inline_alt_preview',
      type: 'recommendations',
      payload: {
        recommendations: [
          {
            slot: 'am',
            step: 'sunscreen',
            brand: 'Anchor Lab',
            name: 'Daily UV Serum SPF 45',
            canonical_product_ref: {
              product_id: 'anchor_spf_1',
              merchant_id: 'merchant_anchor_spf_1',
            },
            reasons: ['Lightweight daily sunscreen for oily skin.'],
            alternatives: [
              { kind: 'similar', product: { brand: 'Brand 1', name: 'Shield Fluid SPF 50' }, reasons: ['Lightweight finish'] },
              { kind: 'similar', product: { brand: 'Brand 2', name: 'Matte UV Gel SPF 50' }, reasons: ['Oil-control finish'] },
              { kind: 'premium', product: { brand: 'Brand 3', name: 'Invisible Face Serum SPF 60' }, reasons: ['Higher SPF'] },
              { kind: 'similar', product: { brand: 'Brand 4', name: 'Soft-Radiance Drops SPF 40' }, reasons: ['Glow finish for makeup-friendly wear'] },
              { kind: 'dupe', product: { brand: 'Brand 5', name: 'Daily Sun Milk SPF 50' }, reasons: ['Budget sunscreen swap'] },
            ],
          },
        ],
      },
    });

    fireEvent.click(screen.getByText(/Alternatives \(dupe \/ similar \/ premium\)/i));

    expect(await screen.findByText(/Shield Fluid SPF 50/i)).toBeInTheDocument();
    expect(screen.getByText(/Matte UV Gel SPF 50/i)).toBeInTheDocument();
    expect(screen.getByText(/Invisible Face Serum SPF 60/i)).toBeInTheDocument();
    expect(screen.getByText(/Soft-Radiance Drops SPF 40/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Sun Milk SPF 50/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Glow finish$/i).length).toBeGreaterThan(0);
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

    const compareButton = (await screen.findAllByRole('button', { name: /^Compare$/i }))
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
