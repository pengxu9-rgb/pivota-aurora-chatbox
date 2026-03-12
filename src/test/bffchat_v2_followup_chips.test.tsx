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
    request_id: args?.request_id ?? 'req_v2_followups',
    trace_id: args?.trace_id ?? 'trace_v2_followups',
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

async function submitPrompt(value: string) {
  const input = await waitForEnabledComposer();
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest('form') as HTMLFormElement);
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

function makeV2Response(nextAction: Record<string, unknown>) {
  return {
    cards: [
      {
        card_type: 'text_response',
        sections: [{ type: 'text_answer', text_en: 'Here is a follow-up option for you.' }],
      },
    ],
    ops: {},
    next_actions: [nextAction],
  };
}

function getChatBodies(mock: any) {
  return mock.mock.calls
    .filter((call) => call[0] === '/v1/chat')
    .map((call) => JSON.parse(String((call[2] as any)?.body || '{}')));
}

describe('BffChat V2 follow-up chips', () => {
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

  it('sends unmapped V2 follow-up chips as plain text messages', async () => {
    const mock = vi.mocked(bffJson);
    const chatResponses: unknown[] = [
      makeV2Response({
        action_type: 'navigate_skill',
        target_skill_id: 'tracker.checkin_insights',
        label: { en: 'See trends & insights' },
      }),
      makeEnvelope(),
    ];

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(chatResponses.shift() ?? makeEnvelope());
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await submitPrompt('Show my next steps');

    fireEvent.click(await screen.findByRole('button', { name: 'See trends & insights' }));

    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(2), { timeout: READY_TIMEOUT_MS });
    const [, secondBody] = getChatBodies(mock);

    expect(secondBody.message).toBe('See trends & insights');
    expect(secondBody.action).toBeUndefined();
  });

  it('sends actionable explore.add_to_routine chips through the legacy action path with product_anchor', async () => {
    const mock = vi.mocked(bffJson);
    const productAnchor = {
      brand: 'Lab Series',
      name: 'Defense Lotion SPF 35',
      product_type: 'sunscreen',
      product_id: 'prod_123',
    };
    const chatResponses: unknown[] = [
      makeV2Response({
        action_type: 'navigate_skill',
        target_skill_id: 'explore.add_to_routine',
        label: { en: 'Add to my routine' },
        params: { product_anchor: productAnchor },
      }),
      makeEnvelope(),
    ];

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(chatResponses.shift() ?? makeEnvelope());
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await submitPrompt('Analyze this sunscreen');

    fireEvent.click(await screen.findByRole('button', { name: 'Add to my routine' }));

    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(2), { timeout: READY_TIMEOUT_MS });
    const [, secondBody] = getChatBodies(mock);

    expect(secondBody.message).toBeUndefined();
    expect(secondBody.action?.action_id).toBe('chip.action.add_to_routine');
    expect(secondBody.action?.data?.product_anchor).toEqual(productAnchor);
  });

  it('downgrades explore.add_to_routine chips without product_anchor into plain text follow-ups', async () => {
    const mock = vi.mocked(bffJson);
    const chatResponses: unknown[] = [
      makeV2Response({
        action_type: 'navigate_skill',
        target_skill_id: 'explore.add_to_routine',
        label: { en: 'Add the better option to routine' },
      }),
      makeEnvelope(),
    ];

    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_bootstrap', trace_id: 'trace_bootstrap' }));
      }
      if (path === '/v1/chat') {
        return Promise.resolve(chatResponses.shift() ?? makeEnvelope());
      }
      return Promise.resolve(makeEnvelope());
    });

    renderChat();
    await submitPrompt('Compare these two products');

    fireEvent.click(await screen.findByRole('button', { name: 'Add the better option to routine' }));

    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(2), { timeout: READY_TIMEOUT_MS });
    const [, secondBody] = getChatBodies(mock);

    expect(secondBody.message).toBe('Add the better option to routine');
    expect(secondBody.action).toBeUndefined();
  });
});
