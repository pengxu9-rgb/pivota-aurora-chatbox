import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { bffJson } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';
import type { ChatResponseV1 } from '@/lib/chatCardsTypes';

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

function makeV1Response(args?: Partial<ChatResponseV1>): ChatResponseV1 {
  return {
    version: '1.0',
    request_id: args?.request_id ?? 'req_chat',
    trace_id: args?.trace_id ?? 'trace_chat',
    assistant_text: args?.assistant_text ?? 'v1 response',
    cards: args?.cards ?? [],
    follow_up_questions: args?.follow_up_questions ?? [],
    suggested_quick_replies: args?.suggested_quick_replies ?? [],
    ops: args?.ops ?? {
      thread_ops: [],
      profile_patch: [],
      routine_patch: [],
      experiment_events: [],
    },
    safety: args?.safety ?? {
      risk_level: 'none',
      red_flags: [],
      disclaimer: '',
    },
    telemetry: args?.telemetry ?? {
      intent: 'travel',
      intent_confidence: 0.9,
      entities: [],
    },
    session_patch: args?.session_patch ?? {},
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const READY_TIMEOUT_MS = 5000;

async function waitForEnabledComposer() {
  const input = await screen.findByPlaceholderText(/ask a question/i);
  await waitFor(() => expect(input).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return input;
}

async function waitForEnabledButton(name: string | RegExp) {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return button;
}

describe('BffChat env stress recommendation routing', () => {
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

  it('includes one-shot travel_plan.destination_place in the first /v1/chat session payload', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string, _headers?: unknown, opts?: unknown) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap',
            trace_id: 'trace_bootstrap',
            session_patch: {},
            cards: [],
          }),
        );
      }

      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            request_id: 'req_chat',
            trace_id: 'trace_chat',
            assistant_text: 'Travel handoff received.',
          }),
        );
      }

      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/chat',
            search: '?q=Please+build+my+travel+plan',
            state: {
              session_patch: {
                profile: {
                  travel_plan: {
                    destination: 'Athens',
                    start_date: '2026-03-12',
                    end_date: '2026-03-15',
                    destination_place: {
                      label: 'Athens, Attica, Greece',
                      canonical_name: 'Athens',
                      latitude: 37.98376,
                      longitude: 23.72784,
                      country_code: 'GR',
                      country: 'Greece',
                      admin1: 'Attica',
                      timezone: 'Europe/Athens',
                      resolution_source: 'user_selected',
                    },
                  },
                },
              },
            },
          } as any,
        ]}
      >
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await waitForEnabledComposer();

    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat' && typeof (call?.[2] as any)?.body === 'string');
      expect(chatCalls.length).toBeGreaterThan(0);
      const body = JSON.parse(String((chatCalls[0]?.[2] as any).body || '{}'));
      expect(body?.session?.profile?.travel_plan?.destination_place).toEqual(
        expect.objectContaining({
          canonical_name: 'Athens',
          timezone: 'Europe/Athens',
        }),
      );
    }, { timeout: READY_TIMEOUT_MS });
  });

  it('sends force_route=reco_products when clicking "See full recommendations" in env card', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string, _headers?: unknown, opts?: unknown) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap',
            trace_id: 'trace_bootstrap',
            session_patch: {
              profile: {
                skinType: 'oily',
                sensitivity: 'low',
                barrierStatus: 'healthy',
                goals: ['pores'],
              },
            },
            cards: [
              {
                card_id: 'session_bootstrap_1',
                type: 'session_bootstrap',
                payload: {
                  profile: {
                    skinType: 'oily',
                    sensitivity: 'low',
                    barrierStatus: 'healthy',
                    goals: ['pores'],
                  },
                },
              },
            ],
          }),
        );
      }

      if (path === '/v1/chat') {
        const bodyRaw = opts && typeof opts === 'object' ? (opts as any).body : '{}';
        let payload: Record<string, any> = {};
        try {
          payload = JSON.parse(String(bodyRaw || '{}'));
        } catch {
          payload = {};
        }
        const actionId = String(payload?.action?.action_id || '').trim();
        if (actionId === 'chip.start.reco_products') {
          return Promise.resolve(
            makeV1Response({
              request_id: 'req_chat_reco',
              trace_id: 'trace_chat_reco',
              assistant_text: 'Routing to recommendations.',
            }),
          );
        }
        return Promise.resolve(
          makeV1Response({
            request_id: 'req_chat_env',
            trace_id: 'trace_chat_env',
            assistant_text: 'Here is your travel environment plan.',
            session_patch: {
              last_travel_readiness: {
                destination: 'Paris',
                start_date: '2026-02-27',
                end_date: '2026-03-02',
                env_source: 'weather_api',
                shopping_preview: {
                  products: [],
                  buying_channels: ['pharmacy', 'ecommerce'],
                },
                confidence: {
                  level: 'medium',
                },
              },
            },
            cards: [
              {
                id: 'env_bootstrap',
                type: 'travel',
                priority: 1,
                title: 'Travel mode',
                tags: ['travel'],
                sections: [
                  {
                    kind: 'travel_structured',
                    env_payload: {
                      schema_version: 'aurora.ui.env_stress.v1',
                      ess: 44,
                      tier: 'Medium',
                      radar: [{ axis: 'Weather', value: 40 }],
                      travel_readiness: {
                        destination_context: {
                          destination: 'Paris',
                          start_date: '2026-02-27',
                          end_date: '2026-03-02',
                          env_source: 'weather_api',
                          epi: 44,
                        },
                        delta_vs_home: {
                          temperature: { home: 16, destination: 9, delta: -7, unit: 'C' },
                          humidity: { home: 62, destination: 72, delta: 10, unit: '%' },
                          uv: { home: 4, destination: 5, delta: 1, unit: '' },
                          summary_tags: ['colder', 'more_humid'],
                          baseline_status: 'ok',
                        },
                        adaptive_actions: [{ why: 'humidity', what_to_do: 'Switch to lighter AM moisturizer.' }],
                        personal_focus: [{ focus: 'Barrier', why: 'sensitive', what_to_do: 'Avoid active stacking.' }],
                        jetlag_sleep: {
                          hours_diff: 9,
                          risk_level: 'high',
                          sleep_tips: ['Shift bedtime'],
                          mask_tips: ['Use hydration mask after flight'],
                        },
                        shopping_preview: {
                          products: [],
                          buying_channels: ['pharmacy', 'ecommerce'],
                        },
                        confidence: {
                          level: 'medium',
                          missing_inputs: ['recent_logs'],
                          improve_by: [],
                        },
                      },
                    },
                  },
                ],
                actions: [],
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

    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'How is the weather in Paris this week?' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    const cta = await waitForEnabledButton('See full recommendations');
    fireEvent.click(cta);

    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat' && typeof (call?.[2] as any)?.body === 'string');
      const hasRecoAction = chatCalls.some((call) => {
        try {
          const body = JSON.parse(String((call?.[2] as any).body || '{}'));
          return String(body?.action?.action_id || '').trim() === 'chip.start.reco_products';
        } catch {
          return false;
        }
      });
      expect(hasRecoAction).toBe(true);
    });

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat' && typeof (call?.[2] as any)?.body === 'string');
    const recoCall = [...chatCalls].reverse().find((call) => {
      try {
        const body = JSON.parse(String((call?.[2] as any).body || '{}'));
        return String(body?.action?.action_id || '').trim() === 'chip.start.reco_products';
      } catch {
        return false;
      }
    });
    const bodyRaw = recoCall?.[2] && typeof recoCall[2] === 'object' ? (recoCall[2] as any).body : null;
    expect(typeof bodyRaw).toBe('string');
    const payload = JSON.parse(String(bodyRaw));

    expect(payload?.action?.action_id).toBe('chip.start.reco_products');
    expect(payload?.action?.data?.force_route).toBe('reco_products');
    expect(payload?.action?.data?.trigger_source).toBe('travel_handoff');
    expect(payload?.action?.data?.source_card_type).toBe('travel');
    expect(String(payload?.action?.data?.reply_text || '')).not.toMatch(/travel|weather/i);
    expect(payload?.session?.meta?.last_travel_readiness?.destination).toBe('Paris');
  });

  it('opens the travel product sheet through the public products search route', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string, _headers?: unknown, opts?: unknown) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }

      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            request_id: 'req_chat_travel_products',
            trace_id: 'trace_chat_travel_products',
            assistant_text: 'Travel picks are ready.',
            cards: [
              {
                id: 'travel_with_products',
                type: 'travel',
                priority: 1,
                title: 'Travel mode',
                tags: ['travel'],
                sections: [
                  {
                    kind: 'travel_structured',
                    env_payload: {
                      schema_version: 'aurora.ui.env_stress.v1',
                      ess: 47,
                      tier: 'Medium',
                      radar: [{ axis: 'Weather', value: 43 }],
                      travel_readiness: {
                        destination_context: {
                          destination: 'Singapore',
                          start_date: '2026-03-12',
                          end_date: '2026-03-20',
                          env_source: 'weather_api',
                          epi: 52,
                        },
                        categorized_kit: [
                          {
                            id: 'sun_protection',
                            title: 'Warmer / more humid',
                            climate_link: 'UV 4 -> 7 (+3)',
                            why: 'Keep UV protection light and easy to reapply.',
                            ingredient_logic: 'Lightweight UV filters work best here.',
                            preparations: [{ name: 'SPF fluid', detail: 'Reapply outdoors' }],
                            brand_suggestions: [
                              {
                                product: 'Daily UV Fluid',
                                brand: 'Aurora Lab',
                                reason: 'Light texture for humid weather.',
                                match_status: 'catalog_verified',
                              },
                            ],
                          },
                        ],
                        shopping_preview: {
                          products: [],
                          buying_channels: ['pharmacy', 'ecommerce'],
                        },
                        confidence: {
                          level: 'medium',
                          missing_inputs: [],
                          improve_by: [],
                        },
                      },
                    },
                  },
                ],
                actions: [],
              },
            ],
          }),
        );
      }

      if (typeof path === 'string' && path.startsWith('/agent/v1/products/search?')) {
        const url = new URL(path, 'https://aurora.test');
        expect(url.searchParams.get('query')).toBe('SPF fluid');
        expect(url.searchParams.get('limit')).toBe('8');
        expect(url.searchParams.get('source')).toBe('aurora_chatbox');
        expect(url.searchParams.get('catalog_surface')).toBe('beauty');
        return Promise.resolve({
          status: 'success',
          products: [
            {
              product_id: 'prod_uv_fluid',
              merchant_id: 'merchant_1',
              title: 'Daily UV Fluid',
              brand: 'Aurora Lab',
              price: 32,
              currency: '$',
            },
          ],
        });
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

    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Show my travel skincare plan' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    const prepTrigger = await screen.findByText('SPF fluid');
    fireEvent.click(prepTrigger);

    expect(await screen.findByText('Daily UV Fluid')).toBeInTheDocument();
    expect(screen.queryByText('No matching products found')).not.toBeInTheDocument();
    expect(mock.mock.calls.some((call) => call[0] === '/agent/shop/v1/invoke')).toBe(false);
  });

  it('keeps the latest travel product results when lookups resolve out of order', async () => {
    const mock = vi.mocked(bffJson);
    const searchRequests = new Map<string, ReturnType<typeof createDeferred<any>>>();

    mock.mockImplementation((path: string, _headers?: unknown, opts?: unknown) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }

      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            request_id: 'req_chat_travel_race',
            trace_id: 'trace_chat_travel_race',
            assistant_text: 'Travel picks are ready.',
            cards: [
              {
                id: 'travel_with_two_lookups',
                type: 'travel',
                priority: 1,
                title: 'Travel mode',
                tags: ['travel'],
                sections: [
                  {
                    kind: 'travel_structured',
                    env_payload: {
                      schema_version: 'aurora.ui.env_stress.v1',
                      ess: 49,
                      tier: 'Medium',
                      radar: [{ axis: 'Weather', value: 41 }],
                      travel_readiness: {
                        destination_context: {
                          destination: 'Tokyo',
                          start_date: '2026-03-12',
                          end_date: '2026-03-20',
                          env_source: 'weather_api',
                          epi: 55,
                        },
                        categorized_kit: [
                          {
                            id: 'sun_protection',
                            title: 'Sun protection',
                            ingredient_logic: 'Photostable UV filters.',
                            preparations: [{ name: 'SPF fluid', detail: 'Reapply at midday' }],
                            brand_suggestions: [],
                          },
                          {
                            id: 'masks',
                            title: 'Masks',
                            ingredient_logic: 'Recovery mask for the first night.',
                            preparations: [{ name: 'Sleeping mask', detail: 'Use after the flight' }],
                            brand_suggestions: [],
                          },
                        ],
                        shopping_preview: {
                          products: [],
                          buying_channels: ['pharmacy'],
                        },
                        confidence: {
                          level: 'medium',
                          missing_inputs: [],
                          improve_by: [],
                        },
                      },
                    },
                  },
                ],
                actions: [],
              },
            ],
          }),
        );
      }

      if (typeof path === 'string' && path.startsWith('/agent/v1/products/search?')) {
        const url = new URL(path, 'https://aurora.test');
        const query = String(url.searchParams.get('query') || '');
        const deferred = createDeferred<any>();
        searchRequests.set(query, deferred);
        return deferred.promise;
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

    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Show my travel skincare plan' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    const firstPrep = await screen.findByText('SPF fluid');
    const secondPrep = await screen.findByText('Sleeping mask');

    fireEvent.click(firstPrep);
    fireEvent.click(secondPrep);

    await waitFor(() => {
      expect(searchRequests.has('SPF fluid')).toBe(true);
      expect(searchRequests.has('Sleeping mask')).toBe(true);
    });

    await act(async () => {
      searchRequests.get('Sleeping mask')?.resolve({
        products: [
          {
            product_id: 'prod_sleep_mask',
            merchant_id: 'merchant_mask',
            title: 'Sleep Recovery Mask',
            brand: 'Aurora Lab',
          },
        ],
      });
      await Promise.resolve();
    });

    expect(await screen.findByText('Sleep Recovery Mask')).toBeInTheDocument();

    await act(async () => {
      searchRequests.get('SPF fluid')?.resolve({
        products: [
          {
            product_id: 'prod_spf_fluid',
            merchant_id: 'merchant_spf',
            title: 'Daily SPF Fluid',
            brand: 'Aurora Lab',
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('Sleep Recovery Mask')).toBeInTheDocument();
      expect(screen.queryByText('Daily SPF Fluid')).not.toBeInTheDocument();
    });
  });

  it('renders contributor breakdown from travel_structured env payload when drivers exist', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap',
            trace_id: 'trace_bootstrap',
            session_patch: {
              profile: {
                skinType: 'oily',
                sensitivity: 'low',
                barrierStatus: 'healthy',
                goals: ['pores'],
              },
            },
          }),
        );
      }

      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            request_id: 'req_chat_env_drivers',
            trace_id: 'trace_chat_env_drivers',
            assistant_text: 'Travel environment analysis ready.',
            cards: [
              {
                id: 'env_with_drivers',
                type: 'travel',
                priority: 1,
                title: 'Travel mode',
                tags: ['travel'],
                sections: [
                  {
                    kind: 'travel_structured',
                    env_payload: {
                      schema_version: 'aurora.ui.env_stress.v1',
                      ess: 32,
                      tier: 'Medium',
                      tier_description: 'Medium stress: expect mild irritation/dryness.',
                      radar: [
                        { axis: 'Weather', value: 46, drivers: ['Temp: 19C', 'Humidity: 55.6%'] },
                        { axis: 'UV', value: 28, drivers: ['UV index: 4.1'] },
                        { axis: 'Barrier', value: 18, drivers: ['Drier than home'] },
                      ],
                      travel_readiness: {
                        destination_context: {
                          destination: 'Paris',
                          start_date: '2026-03-12',
                          end_date: '2026-03-20',
                          env_source: 'weather_api',
                          epi: 53,
                        },
                        delta_vs_home: {
                          temperature: { home: null, destination: 16.2, delta: null, unit: 'C' },
                          humidity: { home: null, destination: 64.7, delta: null, unit: '%' },
                          uv: { home: null, destination: 3.9, delta: null, unit: '' },
                          summary_tags: ['baseline_unavailable'],
                          baseline_status: 'baseline_unavailable',
                        },
                        structured_sections: {
                          routine_adjustments: [
                            'Keep AM cleanse+moisturizer+sunscreen; in PM prioritize recovery before stronger actives.',
                          ],
                          troubleshooting: [
                            'Tight, flaky, stinging: pause actives and focus on hydration.',
                          ],
                        },
                        shopping_preview: {
                          products: [
                            {
                              rank: 1,
                              name: 'Barrier repair cream',
                              category: 'Temperature swing / dryness',
                              reasons: ['Rule-based recommendation from travel condition deltas.'],
                              product_source: 'rule_fallback',
                              match_status: null,
                            },
                          ],
                          buying_channels: ['pharmacy', 'ecommerce'],
                          city_hint: 'paris',
                        },
                        confidence: {
                          level: 'medium',
                          missing_inputs: ['recent_logs'],
                          improve_by: [],
                        },
                      },
                    },
                  },
                ],
                actions: [],
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

    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'How stressful is my travel environment?' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('Medium stress: expect mild irritation/dryness.');
    expect(screen.getAllByText('Weather').length).toBeGreaterThan(0);
    expect(screen.getByText('Temp: 19C')).toBeInTheDocument();
    expect(screen.getByText('General recommendation')).toBeInTheDocument();
    expect(screen.getByText('Routine adjustments')).toBeInTheDocument();
    expect(screen.queryByText('Why this score (expand)')).not.toBeInTheDocument();
  });

  it('suppresses analysis cards when travel/env cards are present in the same turn', async () => {
    const mock = vi.mocked(bffJson);

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            request_id: 'req_chat_env_hide_analysis',
            trace_id: 'trace_chat_env_hide_analysis',
            assistant_text: 'Travel environment analysis ready.',
            cards: [
              {
                id: 'analysis_summary_hidden',
                type: 'analysis_summary',
                priority: 1,
                title: 'Skin summary should hide',
                tags: [],
                sections: [{ kind: 'markdown', text: 'SKIN_SUMMARY_SHOULD_NOT_RENDER' }],
                actions: [],
              },
              {
                id: 'analysis_story_hidden',
                type: 'analysis_story_v2',
                priority: 2,
                title: 'Skin story should hide',
                tags: [],
                sections: [{ kind: 'markdown', text: 'SKIN_STORY_SHOULD_NOT_RENDER' }],
                actions: [],
              },
              {
                id: 'travel_card_keep',
                type: 'travel',
                priority: 3,
                title: 'Travel mode',
                tags: ['travel'],
                sections: [
                  {
                    kind: 'travel_structured',
                    env_payload: {
                      schema_version: 'aurora.ui.env_stress.v1',
                      ess: 38,
                      tier: 'Medium',
                      tier_description: 'Medium stress: travel-focused adjustments recommended.',
                      radar: [{ axis: 'Weather', value: 42, drivers: ['UV index: 6.2'] }],
                      travel_readiness: {
                        destination_context: {
                          destination: 'Paris',
                          start_date: '2026-03-12',
                          end_date: '2026-03-20',
                          env_source: 'weather_api',
                          epi: 52,
                        },
                        delta_vs_home: {
                          temperature: { home: 12, destination: 18, delta: 6, unit: 'C' },
                          humidity: { home: 40, destination: 61, delta: 21, unit: '%' },
                          uv: { home: 3, destination: 6, delta: 3, unit: '' },
                          summary_tags: ['warmer', 'more_humid', 'higher_uv'],
                          baseline_status: 'ok',
                        },
                        shopping_preview: { products: [], buying_channels: ['ecommerce'] },
                        confidence: { level: 'medium', missing_inputs: [], improve_by: [] },
                      },
                    },
                  },
                ],
                actions: [],
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

    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'Plan my travel skincare for Paris.' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('Medium stress: travel-focused adjustments recommended.');
    expect(screen.queryByText('SKIN_SUMMARY_SHOULD_NOT_RENDER')).not.toBeInTheDocument();
    expect(screen.queryByText('SKIN_STORY_SHOULD_NOT_RENDER')).not.toBeInTheDocument();
    expect(screen.queryByText('Skin assessment (7-day plan)')).not.toBeInTheDocument();
    expect(screen.queryByText('Analysis story')).not.toBeInTheDocument();
  });
});
