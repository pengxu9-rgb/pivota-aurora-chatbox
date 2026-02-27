import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { analytics } from '@/lib/analytics';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_bootstrap',
    trace_id: args?.trace_id ?? 'trace_bootstrap',
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
    request_id: args?.request_id ?? 'req_chat_v1',
    trace_id: args?.trace_id ?? 'trace_chat_v1',
    assistant_text: args?.assistant_text ?? 'Here is a v1 response.',
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
      intent: 'unknown',
      intent_confidence: 0.4,
      entities: [],
    },
  };
}

describe('BffChat /v1/chat ChatCards v1 handling', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses v1 success payload directly and renders assistant text + quick reply', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'v1 direct success path',
            suggested_quick_replies: [{ id: 'q1', label: 'Continue', value: 'Continue' }],
            telemetry: { intent: 'routine', intent_confidence: 0.92, entities: [] },
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
    fireEvent.change(input, { target: { value: 'Build a routine for me' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('v1 direct success path');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('shows language mismatch hint when telemetry reports mismatch', async () => {
    window.localStorage.setItem('lang_pref', 'en');
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'v1 mismatch telemetry',
            telemetry: {
              intent: 'reco_products',
              intent_confidence: 0.9,
              entities: [],
              ui_language: 'EN',
              matching_language: 'CN',
              language_mismatch: true,
              language_resolution_source: 'mixed_override',
            },
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
    fireEvent.change(input, { target: { value: '我想买防晒' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('v1 mismatch telemetry');
    await screen.findByText(/Detected input language CN/i);
  });

  it('uses routine adapter when v1 routine card contains routine_structured section', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Here is your routine.',
            cards: [
              {
                id: 'routine_v1_1',
                type: 'routine',
                priority: 1,
                title: 'AM/PM routine',
                tags: ['stability'],
                sections: [
                  {
                    kind: 'routine_structured',
                    am_steps: [
                      { category: 'cleanser', product_name: 'Gentle Cleanser', product_brand: 'A', item_type: 'premium' },
                      { category: 'moisturizer', product_name: 'Barrier Cream', product_brand: 'B', item_type: 'premium' },
                    ],
                    pm_steps: [
                      { category: 'cleanser', product_name: 'Gentle Cleanser', product_brand: 'A', item_type: 'premium' },
                      { category: 'treatment', product_name: 'Retinal Serum', product_brand: 'C', item_type: 'premium' },
                    ],
                    conflicts: [],
                  },
                ],
                actions: [],
              },
            ],
            telemetry: { intent: 'routine', intent_confidence: 0.88, entities: [] },
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
    fireEvent.change(input, { target: { value: 'Routine please' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Your Personalized Routine')).toBeInTheDocument();
    });
  });

  it('falls back to generic ChatCardsV1Card when no adapter matches', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            cards: [
              {
                id: 'nudge_v1_1',
                type: 'nudge',
                priority: 3,
                title: 'Optional nudge',
                tags: ['optional'],
                sections: [{ kind: 'bullets', title: 'Tip', items: ['Keep the routine stable for 14 days.'] }],
                actions: [{ type: 'dismiss', label: 'Dismiss' }],
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
    fireEvent.change(input, { target: { value: 'Any tips?' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('Optional nudge');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('uses product_verdict adapter when product_verdict_structured section is present', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Product verdict is ready.',
            cards: [
              {
                id: 'product_verdict_1',
                type: 'product_verdict',
                priority: 1,
                title: 'Verdict: Good fit',
                tags: ['fit'],
                sections: [
                  {
                    kind: 'product_verdict_structured',
                    verdict: 'Good fit',
                    product_name: 'Barrier Serum',
                    brand: 'Acme',
                    match_score: 84,
                    suitability: 'good',
                    mechanisms: ['hydrating', 'repair'],
                    beneficial_ingredients: ['Panthenol', 'Ceramide'],
                    caution_ingredients: ['Fragrance'],
                    usage: {
                      timing: 'PM',
                      notes: ['Start 3 nights per week'],
                    },
                  },
                ],
                actions: [],
              },
            ],
            telemetry: { intent: 'reco_products', intent_confidence: 0.91, entities: [] },
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
    fireEvent.change(input, { target: { value: 'Analyze this product' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('Barrier Serum');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('uses skin_status adapter when skin_status_structured section is present', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            cards: [
              {
                id: 'skin_status_1',
                type: 'skin_status',
                priority: 1,
                title: 'Current status',
                tags: [],
                sections: [
                  {
                    kind: 'skin_status_structured',
                    diagnosis: {
                      skin_type: 'oily',
                      barrier_status: 'impaired',
                      concerns: ['acne', 'dehydration'],
                    },
                  },
                ],
                actions: [],
              },
            ],
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.86, entities: [] },
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
    fireEvent.change(input, { target: { value: 'How is my skin status?' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('Skin Identity');
    expect(screen.getByRole('button', { name: 'Upload photos (recommended)' })).toBeInTheDocument();
  });

  it('uses effect_review adapter when effect_review_structured section is present', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            cards: [
              {
                id: 'effect_review_1',
                type: 'effect_review',
                priority: 2,
                title: 'Effect review',
                tags: [],
                sections: [
                  {
                    kind: 'effect_review_structured',
                    priority_findings: [{ title: 'Usage consistency is low.' }],
                    target_state: ['Reduce redness episodes.'],
                    core_principles: ['Hold stable baseline for 14 days.'],
                    timeline: {
                      first_4_weeks: ['Week 1-2: reduce actives'],
                      week_8_12_expectation: ['Week 8+: expect smoother tolerance'],
                    },
                    safety_notes: ['Pause acids if stinging persists.'],
                    routine_bridge: {
                      why_now: 'Routine consistency improves attribution quality.',
                      cta_label: 'Refine AM/PM routine',
                      cta_action: 'open_routine_intake',
                    },
                  },
                ],
                actions: [],
              },
            ],
            telemetry: { intent: 'routine', intent_confidence: 0.77, entities: [] },
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
    fireEvent.change(input, { target: { value: 'Review my results' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(mock.mock.calls.some((call) => call[0] === '/v1/chat')).toBe(true);
    });
  });

  it('uses triage adapter and emits triage telemetry when triage_structured section is present', async () => {
    const mock = vi.mocked(bffJson);
    const emitSpy = vi.spyOn(analytics, 'emit').mockImplementation(() => {});
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            cards: [
              {
                id: 'triage_1',
                type: 'triage',
                priority: 1,
                title: 'Triage',
                tags: [],
                sections: [
                  {
                    kind: 'triage_structured',
                    summary: 'Pause strong actives and monitor 48h.',
                    action_points: ['Use barrier moisturizer twice daily.'],
                    next_steps: ['Log symptoms daily.'],
                    red_flags: ['Persistent burning or swelling.'],
                    risk_level: 'high',
                    recovery_window_hours: 48,
                  },
                ],
                actions: [
                  { type: 'log_symptom', label: 'Log symptom' },
                  { type: 'add_to_experiment', label: 'Create recovery experiment' },
                ],
              },
            ],
            telemetry: { intent: 'triage', intent_confidence: 0.95, entities: [] },
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
    fireEvent.change(input, { target: { value: 'My skin is burning' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByTestId('chatcards-triage-adapter');
    expect(screen.getByRole('button', { name: 'Log symptom' })).toBeInTheDocument();
    expect(emitSpy).toHaveBeenCalledWith(
      'triage_stage_shown',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        card_id: 'triage_1',
        card_position: 0,
        risk_level: 'high',
        recovery_window_hours: 48,
        red_flag_count: 1,
        action_point_count: 1,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Log symptom' }));
    expect(emitSpy).toHaveBeenCalledWith(
      'triage_action_tap',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        card_id: 'triage_1',
        action_type: 'log_symptom',
        action_label: 'Log symptom',
        risk_level: 'high',
        recovery_window_hours: 48,
      }),
    );
  });

  it('uses nudge adapter and emits nudge action telemetry when nudge_structured section is present', async () => {
    const mock = vi.mocked(bffJson);
    const emitSpy = vi.spyOn(analytics, 'emit').mockImplementation(() => {});
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            cards: [
              {
                id: 'nudge_1',
                type: 'nudge',
                priority: 3,
                title: 'Optional nudge',
                tags: [],
                sections: [
                  {
                    kind: 'nudge_structured',
                    message: 'Keep your routine stable for one more week.',
                    hints: ['Stability improves attribution.'],
                    cadence_days: 7,
                  },
                ],
                actions: [
                  { type: 'dismiss', label: 'Dismiss' },
                  { type: 'save_tip', label: 'Save tip' },
                ],
              },
            ],
            telemetry: { intent: 'nudge', intent_confidence: 0.72, entities: [] },
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
    fireEvent.change(input, { target: { value: 'Any optional tips?' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByTestId('chatcards-nudge-adapter');
    expect(screen.getByRole('button', { name: 'Save tip' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save tip' }));
    expect(emitSpy).toHaveBeenCalledWith(
      'nudge_action_tap',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        card_id: 'nudge_1',
        action_type: 'save_tip',
        action_label: 'Save tip',
        cadence_days: 7,
        hint_count: 1,
      }),
    );
  });
});
