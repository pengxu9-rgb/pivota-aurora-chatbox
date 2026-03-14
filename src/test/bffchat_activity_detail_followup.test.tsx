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
    bffChatStream: vi.fn().mockRejectedValue(new Error('stream unavailable in test')),
    sendRecoEmployeeFeedback: vi.fn(),
  };
});

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { bffJson } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_followup',
    trace_id: args?.trace_id ?? 'trace_followup',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

function getChatBodies(mock: any) {
  return mock.mock.calls
    .filter((call) => call[0] === '/v1/chat')
    .map((call) => JSON.parse(String((call[2] as any)?.body || '{}')));
}

describe('BffChat activity detail follow-up deeplink', () => {
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

  it('converts activity deep links into explicit solution_next_steps actions with artifact context', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeEnvelope());
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter
        initialEntries={[
          '/chat?chip_id=chip.aurora.next_action.solution_next_steps&q=Continue%20from%20my%20saved%20skin%20analysis.%20Do%20not%20ask%20me%20to%20restate%20my%20goals.&artifact_id=da_saved_1&activity_id=act_saved_1',
        ]}
      >
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await screen.findByPlaceholderText(/ask a question/i);
    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(1));
    expect(
      screen.getByText('Continue from my saved skin analysis. Do not ask me to restate my goals.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Continue from my saved analysis')).not.toBeInTheDocument();

    const [body] = getChatBodies(mock);
    expect(body.message).toBeUndefined();
    expect(body.action?.action_id).toBe('chip.aurora.next_action.solution_next_steps');
    expect(body.action?.data?.reply_text).toBe(
      'Continue from my saved skin analysis. Do not ask me to restate my goals.',
    );
    expect(body.session?.meta?.latest_artifact_id).toBe('da_saved_1');
    expect(body.session?.meta?.source_activity_id).toBe('act_saved_1');
  });

  it('keeps saved analysis follow-up session meta on the next free-text turn', async () => {
    const mock = vi.mocked(bffJson);
    let chatCallCount = 0;
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        chatCallCount += 1;
        if (chatCallCount === 1) {
          return Promise.resolve(makeEnvelope({
            session_patch: {
              meta: {
                latest_artifact_id: 'da_saved_1',
                source_activity_id: 'act_saved_1',
                analysis_context: {
                  followup_mode: 'saved_analysis',
                  analysis_origin: 'photo',
                  analysis_story_snapshot: {
                    schema_version: 'aurora.analysis_story.v2',
                    priority_findings: [{ title: 'Recurring breakouts' }],
                    confidence_overall: { level: 'high', score: 0.86 },
                    ui_card_v1: { headline: 'Focus on clearing recurring breakouts first' },
                  },
                },
              },
            },
          }));
        }
        return Promise.resolve(makeEnvelope());
      }
      return Promise.resolve(makeEnvelope());
    });

    const view = render(
      <MemoryRouter
        initialEntries={[
          '/chat?chip_id=chip.aurora.next_action.solution_next_steps&q=Continue%20from%20my%20saved%20skin%20analysis.&artifact_id=da_saved_1&activity_id=act_saved_1',
        ]}
      >
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await screen.findByPlaceholderText(/ask a question/i);
    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(1));
    expect(screen.queryByText('Continue from my saved analysis')).not.toBeInTheDocument();

    const input = screen.getByPlaceholderText(/ask a question/i);
    fireEvent.change(input, { target: { value: 'solve my acne problems' } });
    const submit = view.container.querySelector('form button[type="submit"]');
    expect(submit).toBeTruthy();
    fireEvent.click(submit as HTMLButtonElement);

    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(2));

    const [, secondBody] = getChatBodies(mock);
    expect(secondBody.message).toBe('solve my acne problems');
    expect(secondBody.session?.meta?.latest_artifact_id).toBe('da_saved_1');
    expect(secondBody.session?.meta?.source_activity_id).toBe('act_saved_1');
    expect(secondBody.session?.meta?.analysis_context?.followup_mode).toBe('saved_analysis');
    expect(secondBody.session?.meta?.analysis_context?.analysis_origin).toBe('photo');
    expect(secondBody.session?.meta?.analysis_context?.analysis_story_snapshot?.ui_card_v1?.headline).toBe(
      'Focus on clearing recurring breakouts first',
    );
  });

  it('routes saved-analysis follow-up product CTA into chip.start.reco_products', async () => {
    const mock = vi.mocked(bffJson);
    let chatCallCount = 0;
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        chatCallCount += 1;
        if (chatCallCount === 1) {
          return Promise.resolve(makeEnvelope({
            session_patch: {
              meta: {
                latest_artifact_id: 'da_saved_1',
                source_activity_id: 'act_saved_1',
                analysis_context: {
                  followup_mode: 'saved_analysis',
                  analysis_origin: 'photo',
                  analysis_story_snapshot: {
                    schema_version: 'aurora.analysis_story.v2',
                    priority_findings: [{ title: 'Recurring breakouts' }],
                    confidence_overall: { level: 'high', score: 0.86 },
                  },
                },
              },
            },
          }));
        }
        if (chatCallCount === 2) {
          return Promise.resolve(makeEnvelope({
            cards: [{
              card_id: 'saved_analysis_next_steps_req',
              type: 'analysis_summary',
              payload: {
                title: 'Acne next steps from your saved analysis',
                subtitle: 'Based on your saved photo analysis',
                key_takeaways_title: 'What to focus on now',
                plan_title: 'How to approach acne next',
                hide_quick_check: true,
                hide_tuning_actions: true,
                primary_cta_label: 'See acne-safe product recommendations',
                primary_action_id: 'analysis_continue_products',
                primary_action_data: {
                  reply_text: 'Based on my saved skin analysis, recommend acne-safe products for me.',
                  include_alternatives: true,
                  profile_patch: { goals: ['acne'] },
                },
                analysis: {
                  features: [{ observation: 'Priority ingredients: salicylic acid, azelaic acid', confidence: 'pretty_sure' }],
                  strategy: '1) Keep barrier support.\n2) Add one acne active.\n3) Move into products.',
                  needs_risk_check: false,
                },
              },
            }],
          }));
        }
        return Promise.resolve(makeEnvelope());
      }
      return Promise.resolve(makeEnvelope());
    });

    const view = render(
      <MemoryRouter
        initialEntries={[
          '/chat?chip_id=chip.aurora.next_action.solution_next_steps&q=Continue%20from%20my%20saved%20skin%20analysis.&artifact_id=da_saved_1&activity_id=act_saved_1',
        ]}
      >
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await screen.findByPlaceholderText(/ask a question/i);
    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(1));

    const input = screen.getByPlaceholderText(/ask a question/i);
    fireEvent.change(input, { target: { value: 'solve my acne problems' } });
    const submit = view.container.querySelector('form button[type="submit"]');
    expect(submit).toBeTruthy();
    fireEvent.click(submit as HTMLButtonElement);

    await screen.findByRole('button', { name: 'See acne-safe product recommendations' });
    fireEvent.click(screen.getByRole('button', { name: 'See acne-safe product recommendations' }));

    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(3));
    const [, , thirdBody] = getChatBodies(mock);
    expect(thirdBody.action?.action_id).toBe('chip.start.reco_products');
    expect(thirdBody.action?.kind).toBe('chip');
    expect(thirdBody.action?.data?.reply_text).toBe(
      'Based on my saved skin analysis, recommend acne-safe products for me.',
    );
    expect(thirdBody.action?.data?.profile_patch).toEqual({ goals: ['acne'] });
  });
});
