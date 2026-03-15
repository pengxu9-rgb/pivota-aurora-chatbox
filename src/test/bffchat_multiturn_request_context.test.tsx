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
import type { ChatResponseV1 } from '@/lib/chatCardsTypes';

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

function makeChatResponse(args?: Partial<ChatResponseV1>): ChatResponseV1 {
  return {
    version: '1.0',
    request_id: args?.request_id ?? 'req_chat',
    trace_id: args?.trace_id ?? 'trace_chat',
    assistant_text: args?.assistant_text ?? 'reply',
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
      intent_confidence: 0.5,
      entities: [],
    },
  };
}

const READY_TIMEOUT_MS = 5000;

async function waitForEnabledComposer() {
  const input = await screen.findByPlaceholderText(/ask a question/i);
  await waitFor(() => expect(input).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return input;
}

async function sendPrompt(prompt: string) {
  const input = await waitForEnabledComposer();
  fireEvent.change(input, { target: { value: prompt } });
  const form = input.closest('form');
  expect(form).toBeTruthy();
  fireEvent.submit(form as HTMLFormElement);
}

describe('BffChat multi-turn request context', () => {
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

  it('sends recent text history in /v1/chat messages without duplicating the current prompt', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope());
      }
      if (path === '/v1/chat') {
        const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat').length;
        return Promise.resolve(
          makeChatResponse({
            request_id: `req_chat_${chatCalls}`,
            trace_id: `trace_chat_${chatCalls}`,
            assistant_text: chatCalls === 1 ? 'First answer.' : 'Second answer.',
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

    await waitFor(() => {
      const bootstrapCalls = mock.mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
      expect(bootstrapCalls.length).toBeGreaterThan(0);
    }, { timeout: READY_TIMEOUT_MS });

    await sendPrompt('First question');
    await screen.findByText('First answer.');

    await sendPrompt('Second question');
    await screen.findByText('Second answer.');

    const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
    expect(chatCalls.length).toBe(2);

    const secondInit = chatCalls[1]?.[2] as RequestInit | undefined;
    const secondBody = JSON.parse(typeof secondInit?.body === 'string' ? secondInit.body : '{}');
    expect(secondBody.messages).toEqual(expect.arrayContaining([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer.' },
    ]));
    expect(Array.isArray(secondBody.messages)).toBe(true);
    expect(secondBody.message).toBe('Second question');
    expect(secondBody.messages).not.toContainEqual({ role: 'user', content: 'Second question' });
  });

  it('hydrates latest_reco_context from bootstrap and forwards it in subsequent chat thread_state', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({
          session_patch: {
            state: {
              latest_reco_context: {
                reco_context_version: 'aurora.reco_context.v2',
                reco_context_source: 'analysis_skin',
                diagnosis_goal: 'barrier_repair',
                target_step: 'moisturizer',
                seed_terms: ['barrier_repair', 'ceramide', 'panthenol'],
              },
            },
          },
        }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(makeChatResponse({
          request_id: 'req_chat_reco_ctx',
          trace_id: 'trace_chat_reco_ctx',
          assistant_text: 'reply',
        }));
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

    await waitFor(() => {
      const bootstrapCalls = mock.mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
      expect(bootstrapCalls.length).toBeGreaterThan(0);
    }, { timeout: READY_TIMEOUT_MS });

    await sendPrompt('Recommend a moisturizer for me');
    await screen.findByText('reply');

    const chatCall = mock.mock.calls.find((call) => call[0] === '/v1/chat');
    expect(chatCall).toBeTruthy();
    const chatBody = JSON.parse(typeof chatCall?.[2]?.body === 'string' ? chatCall[2].body : '{}');
    expect(chatBody.thread_state?.latest_reco_context?.diagnosis_goal).toBe('barrier_repair');
    expect(chatBody.thread_state?.latest_reco_context?.target_step).toBe('moisturizer');
    expect(chatBody.thread_state?.latest_reco_context?.seed_terms).toEqual(expect.arrayContaining(['barrier_repair', 'ceramide']));
  });
});
