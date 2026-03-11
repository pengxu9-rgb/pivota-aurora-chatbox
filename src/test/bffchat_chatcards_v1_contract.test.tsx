import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    bffChatStream: vi.fn().mockRejectedValue(new Error('stream unavailable in test')),
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

function installPhotoUploadPrimitives() {
  const originalFaceDetector = (window as any).FaceDetector;
  const originalImage = (globalThis as any).Image;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  class MockFaceDetector {
    detect(): Promise<Array<{ boundingBox: { x: number; y: number; width: number; height: number } }>> {
      return Promise.resolve([
        {
          boundingBox: {
            x: 180,
            y: 180,
            width: 720,
            height: 720,
          },
        },
      ]);
    }
  }

  class MockImage {
    onload: ((this: GlobalEventHandlers, ev: Event) => any) | null = null;
    onerror: ((this: GlobalEventHandlers, ev: Event | string) => any) | null = null;
    naturalWidth = 1200;
    naturalHeight = 1200;
    width = 1200;
    height = 1200;

    set src(_value: string) {
      setTimeout(() => {
        if (this.onload) this.onload(new Event('load'));
      }, 0);
    }
  }

  (window as any).FaceDetector = MockFaceDetector;
  (globalThis as any).Image = MockImage;
  URL.createObjectURL = vi.fn(() => 'blob:bffchat-photo-contract');
  URL.revokeObjectURL = vi.fn();

  return () => {
    if (originalFaceDetector === undefined) delete (window as any).FaceDetector;
    else (window as any).FaceDetector = originalFaceDetector;

    if (originalImage === undefined) delete (globalThis as any).Image;
    else (globalThis as any).Image = originalImage;

    if (originalCreateObjectURL) URL.createObjectURL = originalCreateObjectURL;
    if (originalRevokeObjectURL) URL.revokeObjectURL = originalRevokeObjectURL;
  };
}

describe('BffChat /v1/chat ChatCards v1 handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('lang_pref', 'en');
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

  it('renders localized intro_hint when assistant_text is omitted', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve({
          version: '1.0',
          request_id: 'req_intro_hint',
          trace_id: 'trace_intro_hint',
          intro_hint: {
            en: 'Here is your structured result.',
            zh: '以下是你的结构化结果。',
          },
          cards: [],
          follow_up_questions: [],
          suggested_quick_replies: [],
          ops: {
            thread_ops: [],
            profile_patch: [],
            routine_patch: [],
            experiment_events: [],
          },
          safety: {
            risk_level: 'none',
            red_flags: [],
            disclaimer: '',
          },
          telemetry: {
            intent: 'unknown',
            intent_confidence: 0.5,
            entities: [],
          },
        } satisfies ChatResponseV1);
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
    fireEvent.change(input, { target: { value: 'Show me cards only' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('Here is your structured result.');
  });

  it('renders ingredient hub card from v1 payload without nudge downgrade', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'ingredient v1 path',
            cards: [
              {
                id: 'ingredient_hub_test',
                type: 'ingredient_hub',
                priority: 1,
                title: 'Ingredient Hub',
                subtitle: 'Start with lookup or goal match',
                tags: [],
                sections: [],
                actions: [],
                payload: {
                  title: 'Ingredient Hub',
                  subtitle: 'Start with lookup or goal match',
                  suggested_goals: ['Acne', 'Brightening'],
                },
              },
            ],
            telemetry: { intent: 'ingredient_science', intent_confidence: 0.96, entities: [] },
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
    fireEvent.change(input, { target: { value: 'ingredients' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByText('Ingredient Hub')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Lookup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Match ingredients' })).toBeInTheDocument();
  });

  it('keeps ingredient hub card when v1 card title is missing', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'ingredient v1 path missing title',
            cards: [
              {
                id: 'ingredient_hub_missing_title',
                type: 'ingredient_hub',
                priority: 1,
                tags: [],
                sections: [],
                actions: [],
                payload: {
                  title: 'Ingredient Hub',
                  subtitle: 'Start with lookup or goal match',
                  suggested_goals: ['Acne', 'Brightening'],
                },
              },
            ],
            telemetry: { intent: 'ingredient_science', intent_confidence: 0.94, entities: [] },
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
    fireEvent.change(input, { target: { value: 'ingredient' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByRole('button', { name: 'Lookup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Match ingredients' })).toBeInTheDocument();
  });

  it('shows mixed-language strategy chips when telemetry reports mismatch', async () => {
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
    await screen.findByText(/Mixed-language chat is supported/i);
    expect(screen.getByRole('button', { name: 'Keep English replies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Chinese replies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto-follow my input language' })).toBeInTheDocument();
  });

  it('switches UI language from mismatch strategy chip and persists lang_pref', async () => {
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

    const switchButton = await screen.findByRole('button', { name: 'Switch to Chinese replies' });
    fireEvent.click(switchButton);

    await screen.findByText('Switched to Chinese replies.');
    expect(window.localStorage.getItem('lang_pref')).toBe('cn');
  });

  it('enables auto-follow mode from mismatch strategy chip', async () => {
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

    const autoFollowButton = await screen.findByRole('button', { name: 'Auto-follow my input language' });
    fireEvent.click(autoFollowButton);

    await screen.findByText(/Auto-follow is enabled/i);
    expect(window.localStorage.getItem('lang_reply_mode')).toBe('auto_follow_input');
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
    expect(screen.getByRole('button', { name: 'Upload photo (recommended)' })).toBeInTheDocument();
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

  it('opens photo camera locally for quick reply with client_action=open_camera without sending another /v1/chat turn', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Choose how you want to continue.',
            suggested_quick_replies: [
              {
                id: 'diag_upload',
                label: 'Upload photo now',
                metadata: {
                  action_id: 'diag.upload_photo',
                  client_action: 'open_camera',
                  trigger_source: 'action',
                },
              },
            ],
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.93, entities: [] },
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
    fireEvent.change(input, { target: { value: 'start diagnosis' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    const uploadChip = await screen.findByRole('button', { name: 'Upload photo now' });
    const chatCallsBeforeClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
    expect(chatCallsBeforeClick).toBe(1);

    fireEvent.click(uploadChip);

    await screen.findByText('Align your face inside the oval frame');
    await waitFor(() => {
      const chatCallsAfterClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
      expect(chatCallsAfterClick).toBe(1);
    });
  });

  it('dedupes repeated diagnosis CTAs from quick replies + follow-up options and keeps upload as local camera action', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Choose your next step.',
            suggested_quick_replies: [
              {
                id: 'diag_upload',
                label: 'Upload a photo (more accurate)',
                value: 'Upload a photo (more accurate)',
                metadata: {
                  action_id: 'diag.upload_photo',
                  trigger_source: 'action',
                },
              },
              {
                id: 'diag_skip',
                label: 'Skip photo (low confidence)',
                value: 'Skip photo (low confidence)',
                metadata: {
                  action_id: 'chip.intake.skip_analysis',
                  trigger_source: 'action',
                },
              },
              {
                id: 'diag_keep_chat',
                label: 'Just keep chatting',
                value: 'Just keep chatting',
                metadata: {
                  action_id: 'chip_keep_chatting',
                  trigger_source: 'action',
                },
              },
            ],
            follow_up_questions: [
              {
                id: 'diag_follow_up',
                question: 'How should I continue for the next step?',
                required: false,
                options: [
                  {
                    id: 'upload_again',
                    label: 'Upload a photo (more accurate)',
                    value: 'Upload a photo (more accurate)',
                    metadata: {
                      action_id: 'diag.upload_photo',
                      trigger_source: 'action',
                    },
                  },
                  {
                    id: 'skip_again',
                    label: 'Skip photo (low confidence)',
                    value: 'Skip photo (low confidence)',
                    metadata: {
                      action_id: 'chip.intake.skip_analysis',
                      trigger_source: 'action',
                    },
                  },
                ],
              },
            ],
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.93, entities: [] },
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
    fireEvent.change(input, { target: { value: 'start diagnosis' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('Choose your next step.');
    expect(screen.getAllByRole('button', { name: 'Upload a photo (more accurate)' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Skip photo (low confidence)' })).toHaveLength(1);

    const chatCallsBeforeClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
    expect(chatCallsBeforeClick).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Upload a photo (more accurate)' }));

    await screen.findByText('Align your face inside the oval frame');
    await waitFor(() => {
      const chatCallsAfterClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
      expect(chatCallsAfterClick).toBe(1);
    });
  });

  it('dedupes diagnosis CTAs and opens camera when metadata action IDs are missing', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Choose your next step.',
            suggested_quick_replies: [
              {
                id: 'chip.intake.upload_photos',
                label: 'Upload a photo (more accurate)',
                value: 'Upload a photo (more accurate)',
                metadata: {},
              },
              {
                id: 'chip.intake.skip_analysis',
                label: 'Skip photo (low confidence)',
                value: 'Skip photo (low confidence)',
                metadata: {},
              },
              {
                id: 'chip_keep_chatting',
                label: 'Just keep chatting',
                value: 'Just keep chatting',
                metadata: {},
              },
            ],
            follow_up_questions: [
              {
                id: 'diag_follow_up',
                question: 'How should I continue for the next step?',
                required: false,
                options: [
                  {
                    id: 'chip.intake.upload_photos',
                    label: 'Upload a photo (more accurate)',
                    value: 'Upload a photo (more accurate)',
                    metadata: {},
                  },
                  {
                    id: 'chip.intake.skip_analysis',
                    label: 'Skip photo (low confidence)',
                    value: 'Skip photo (low confidence)',
                    metadata: {},
                  },
                ],
              },
            ],
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.93, entities: [] },
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
    fireEvent.change(input, { target: { value: 'start diagnosis' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByText('Choose your next step.');
    expect(screen.getAllByRole('button', { name: 'Upload a photo (more accurate)' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Skip photo (low confidence)' })).toHaveLength(1);

    const chatCallsBeforeClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
    expect(chatCallsBeforeClick).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Upload a photo (more accurate)' }));
    await screen.findByText('Align your face inside the oval frame');
    await waitFor(() => {
      const chatCallsAfterClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
      expect(chatCallsAfterClick).toBe(1);
    });
  });

  it('opens camera locally for quick reply upload action ID even without metadata', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Choose your next step.',
            suggested_quick_replies: [
              {
                id: 'chip.intake.upload_photos',
                label: 'Upload a photo (more accurate)',
                value: 'Upload a photo (more accurate)',
                metadata: {},
              },
            ],
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.93, entities: [] },
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
    fireEvent.change(input, { target: { value: 'start diagnosis' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByRole('button', { name: 'Upload a photo (more accurate)' });
    const chatCallsBeforeClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
    expect(chatCallsBeforeClick).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Upload a photo (more accurate)' }));
    await screen.findByText('Align your face inside the oval frame');
    await waitFor(() => {
      const chatCallsAfterClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
      expect(chatCallsAfterClick).toBe(1);
    });
  });

  it('maps analysis_get_recommendations next-step action to recommendation request', async () => {
    const mock = vi.mocked(bffJson);
    let chatTurns = 0;
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        chatTurns += 1;
        if (chatTurns === 1) {
          return Promise.resolve(
            makeV1Response({
              assistant_text: 'Analysis complete.',
              cards: [
                {
                  id: 'analysis_summary_1',
                  type: 'analysis_summary',
                  priority: 1,
                  title: 'Analysis summary',
                  tags: [],
                  sections: [],
                  actions: [],
                  payload: {
                    analysis: {
                      features: [{ observation: 'Mild redness on cheeks', confidence: 'somewhat_sure' }],
                      strategy: 'Keep routine simple for 7 days.',
                      needs_risk_check: false,
                      deepening: { phase: 'refined' },
                      next_step_options: [{ id: 'analysis_get_recommendations', label: 'Get recommendations now' }],
                    },
                    low_confidence: false,
                  },
                },
              ],
              telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.92, entities: [] },
            }),
          );
        }
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Recommendations prepared.',
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
    fireEvent.change(input, { target: { value: 'help me with my routine' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByRole('button', { name: 'See product recommendations' });
    fireEvent.click(screen.getByRole('button', { name: 'See product recommendations' }));

    await screen.findByText('Recommendations prepared.');
    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
      expect(chatCalls).toHaveLength(2);
      const lastRawBody = String((chatCalls[1]?.[2] as any)?.body || '');
      expect(lastRawBody).toContain('chip.action.reco_routine');
      expect(lastRawBody).toContain('"include_alternatives":true');
    });
  });

  it('maps analysis_story_v2 deep-dive CTA to a follow-up chat action', async () => {
    const mock = vi.mocked(bffJson);
    let chatTurns = 0;
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        chatTurns += 1;
        if (chatTurns === 1) {
          return Promise.resolve(
            makeV1Response({
              assistant_text: 'Story generated.',
              cards: [
                {
                  id: 'analysis_story_1',
                  type: 'analysis_story_v2',
                  priority: 1,
                  title: 'Analysis story',
                  tags: [],
                  sections: [],
                  actions: [],
                  payload: {
                    confidence_overall: { level: 'medium', score: 0.66 },
                    skin_profile: { current_strengths: ['stable baseline'] },
                  },
                },
              ],
              telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.93, entities: [] },
            }),
          );
        }
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Deep dive follow-up received.',
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.9, entities: [] },
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
    fireEvent.change(input, { target: { value: 'analyze my skin' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    fireEvent.click(await screen.findByRole('button', { name: 'Dive deeper into skin' }));

    await screen.findByText('Deep dive follow-up received.');
    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
      expect(chatCalls).toHaveLength(2);
      const lastBody = JSON.parse(String((chatCalls[1]?.[2] as any)?.body || '{}'));
      expect(lastBody.action.action_id).toBe('chip.aurora.next_action.deep_dive_skin');
      expect(lastBody.action.kind).toBe('chip');
      expect(lastBody.action.data).toMatchObject({
        analysis_origin: 'profile',
        use_photo: false,
        source_card_type: 'analysis_story_v2',
      });
      expect(lastBody.action.data.photo_refs).toBeUndefined();
      expect(lastBody.session.meta.analysis_context).toMatchObject({
        analysis_origin: 'profile',
        use_photo: false,
        source_card_type: 'analysis_story_v2',
      });
      expect(lastBody.action.data.analysis_story_snapshot).toMatchObject({
        confidence_overall: { level: 'medium' },
      });
      expect(lastBody.session.meta.analysis_context.analysis_story_snapshot).toMatchObject({
        confidence_overall: { level: 'medium' },
      });
    });
  });

  it('keeps photo refs in the deep-dive follow-up after photo analysis', async () => {
    const restorePhotoPrimitives = installPhotoUploadPrimitives();
    const mock = vi.mocked(bffJson);
    let chatTurns = 0;

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/photos/upload') {
        return Promise.resolve(
          makeEnvelope({
            cards: [
              {
                card_id: 'photo_confirm_daylight',
                type: 'photo_confirm',
                payload: {
                  slot_id: 'daylight',
                  photo_id: 'photo_daylight_1',
                  qc_status: 'passed',
                },
              } as any,
            ],
          }),
        );
      }
      if (path === '/v1/analysis/skin') {
        return Promise.resolve(
          makeEnvelope({
            assistant_message: { role: 'assistant', content: 'Photo analysis ready.' },
            cards: [
              {
                card_id: 'analysis_story_photo',
                type: 'analysis_story_v2',
                payload: {
                  confidence_overall: { level: 'medium', score: 0.72 },
                  skin_profile: { current_strengths: ['balanced oil control'] },
                },
              } as any,
            ],
            session_patch: {
              next_state: 'S5_ANALYSIS_RESULT',
            },
          }),
        );
      }
      if (path === '/v1/chat') {
        chatTurns += 1;
        return Promise.resolve(
          makeV1Response({
            assistant_text: chatTurns === 1 ? 'Photo deep dive follow-up received.' : 'unexpected extra call',
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.94, entities: [] },
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    try {
      render(
        <MemoryRouter initialEntries={['/chat?open=photo']}>
          <ShopProvider>
            <BffChat />
          </ShopProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(document.querySelectorAll('input[type="file"]').length).toBeGreaterThan(0);
      });
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
      fireEvent.change(fileInputs[0], {
        target: { files: [new File(['face'], 'face.jpg', { type: 'image/jpeg' })] },
      });

      await screen.findByText('Frame good');
      fireEvent.click(screen.getByRole('checkbox'));
      const skipButton = screen.getByRole('button', { name: 'Skip photos' });
      const footerRow = skipButton.parentElement;
      expect(footerRow).toBeTruthy();
      fireEvent.click(within(footerRow as HTMLElement).getByRole('button', { name: 'Upload photo' }));

      fireEvent.click(await screen.findByRole('button', { name: 'Dive deeper into skin' }));
      await screen.findByText('Photo deep dive follow-up received.');

      await waitFor(() => {
        const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
        expect(chatCalls).toHaveLength(1);
        const body = JSON.parse(String((chatCalls[0]?.[2] as any)?.body || '{}'));
        expect(body.action.action_id).toBe('chip.aurora.next_action.deep_dive_skin');
        expect(body.action.kind).toBe('chip');
        expect(body.action.data).toMatchObject({
          analysis_origin: 'photo',
          use_photo: true,
          source_card_type: 'analysis_story_v2',
          photo_refs: [{ slot_id: 'daylight', photo_id: 'photo_daylight_1', qc_status: 'passed' }],
        });
        expect(body.session.meta.analysis_context).toMatchObject({
          analysis_origin: 'photo',
          use_photo: true,
          source_card_type: 'analysis_story_v2',
          photo_refs: [{ slot_id: 'daylight', photo_id: 'photo_daylight_1', qc_status: 'passed' }],
        });
        expect(body.action.data.analysis_story_snapshot).toMatchObject({
          confidence_overall: { level: 'medium', score: 0.72 },
        });
        expect(body.session.meta.analysis_context.analysis_story_snapshot).toMatchObject({
          confidence_overall: { level: 'medium', score: 0.72 },
        });
        expect(JSON.stringify(body)).not.toContain('blob:bffchat-photo-contract');
        expect(JSON.stringify(body)).not.toContain('"preview"');
        expect(JSON.stringify(body)).not.toContain('"file"');
      });
    } finally {
      restorePhotoPrimitives();
    }
  });

  it('maps analysis_story_v2 ingredient-plan CTA to a follow-up chat action', async () => {
    const mock = vi.mocked(bffJson);
    let chatTurns = 0;
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        chatTurns += 1;
        if (chatTurns === 1) {
          return Promise.resolve(
            makeV1Response({
              assistant_text: 'Story generated.',
              cards: [
                {
                  id: 'analysis_story_local_intake',
                  type: 'analysis_story_v2',
                  priority: 1,
                  title: 'Analysis story',
                  tags: [],
                  sections: [],
                  actions: [],
                  payload: {
                    confidence_overall: { level: 'medium', score: 0.66 },
                    skin_profile: { current_strengths: ['stable baseline'] },
                  },
                },
              ],
              telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.93, entities: [] },
            }),
          );
        }
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Ingredient-plan follow-up received.',
            telemetry: { intent: 'ingredient_plan', intent_confidence: 0.93, entities: [] },
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
    fireEvent.change(input, { target: { value: 'analyze my skin' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    fireEvent.click(await screen.findByRole('button', { name: 'Ingredient plan details' }));

    await screen.findByText('Ingredient-plan follow-up received.');
    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
      expect(chatCalls).toHaveLength(2);
      const lastRawBody = String((chatCalls[1]?.[2] as any)?.body || '');
      expect(lastRawBody).toContain('chip.aurora.next_action.ingredient_plan');
    });
  });

  it('renders routine_fit_summary cards through BffChat', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Routine fit generated.',
            cards: [
              {
                id: 'routine_fit_1',
                type: 'routine_fit_summary',
                priority: 1,
                title: 'Routine fit',
                tags: [],
                sections: [],
                actions: [],
                payload: {
                  overall_fit: 'partial_match',
                  fit_score: 0.5,
                  summary: 'Some strong matches, with a few gaps to adjust.',
                  highlights: ['Barrier support is solid.'],
                  concerns: ['AM protection could be stronger.'],
                  dimension_scores: {
                    ingredient_match: { score: 0.5, note: 'Mostly aligned' },
                    routine_completeness: { score: 0.4, note: 'AM needs more coverage' },
                    conflict_risk: { score: 0.8, note: 'No major stacking issues' },
                    sensitivity_safety: { score: 0.6, note: 'Generally tolerable' },
                  },
                  next_questions: ['What should I adjust first?'],
                },
              },
            ],
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.91, entities: [] },
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
    fireEvent.change(input, { target: { value: 'analyze my routine fit' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByText('Some strong matches, with a few gaps to adjust.')).toBeInTheDocument();
    expect(screen.getByText('Partial match · 50%')).toBeInTheDocument();
    expect(screen.getByText('What should I adjust first?')).toBeInTheDocument();
  });

  it('maps analysis_optimize_existing next-step action to local routine-review flow without extra chat turn', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeV1Response({
            assistant_text: 'Analysis complete.',
            cards: [
              {
                id: 'analysis_summary_2',
                type: 'analysis_summary',
                priority: 1,
                title: 'Analysis summary',
                tags: [],
                sections: [],
                actions: [],
                  payload: {
                    analysis: {
                      features: [{ observation: 'T-zone shine', confidence: 'somewhat_sure' }],
                      strategy: 'Use gentle balancing care.',
                      needs_risk_check: false,
                      deepening: { phase: 'refined' },
                    },
                    low_confidence: true,
                  },
                },
              ],
            telemetry: { intent: 'skin_diagnosis', intent_confidence: 0.92, entities: [] },
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
    fireEvent.change(input, { target: { value: 'help me with my routine' } });
    const form = input.closest('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await screen.findByRole('button', { name: 'Add AM/PM products (more accurate)' });
    const chatCallsBeforeClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
    expect(chatCallsBeforeClick).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add AM/PM products (more accurate)' }));

    await screen.findByText(/Fill in your AM\/PM products/i);
    await waitFor(() => {
      const chatCallsAfterClick = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
      expect(chatCallsAfterClick).toBe(1);
    });
  });
});
