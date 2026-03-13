import React from 'react';
import { render, screen, waitFor } from '@/test/testProviders';
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

  it('converts activity deep links into explicit deep_dive_skin actions with artifact context', async () => {
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
          '/chat?chip_id=chip.aurora.next_action.deep_dive_skin&q=Continue%20from%20my%20saved%20skin%20analysis.%20Do%20not%20ask%20me%20to%20restate%20my%20goals.&artifact_id=da_saved_1&activity_id=act_saved_1',
        ]}
      >
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    await screen.findByPlaceholderText(/ask a question/i);
    await waitFor(() => expect(getChatBodies(mock)).toHaveLength(1));

    const [body] = getChatBodies(mock);
    expect(body.message).toBeUndefined();
    expect(body.action?.action_id).toBe('chip.aurora.next_action.deep_dive_skin');
    expect(body.action?.data?.reply_text).toBe(
      'Continue from my saved skin analysis. Do not ask me to restate my goals.',
    );
    expect(body.session?.meta?.latest_artifact_id).toBe('da_saved_1');
    expect(body.session?.meta?.source_activity_id).toBe('act_saved_1');
  });
});
