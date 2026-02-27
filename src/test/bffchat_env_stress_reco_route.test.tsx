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
});
