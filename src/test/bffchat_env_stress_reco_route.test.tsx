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
  };
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

    const input = await screen.findByPlaceholderText('Ask a question… (or paste a product link)');
    fireEvent.change(input, { target: { value: 'How is the weather in Paris this week?' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    const cta = await screen.findByRole('button', { name: 'See full recommendations' });
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
    expect(String(payload?.action?.data?.reply_text || '')).not.toMatch(/travel|weather/i);
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

    const input = await screen.findByPlaceholderText('Ask a question… (or paste a product link)');
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

    const input = await screen.findByPlaceholderText('Ask a question… (or paste a product link)');
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
