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
    request_id: args?.request_id ?? 'req_1',
    trace_id: args?.trace_id ?? 'trace_1',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
    reco_refresh_hint: args?.reco_refresh_hint,
  };
}

describe('BffChat check-in refresh routing', () => {
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

  it('routes refresh recommendations from CHECKIN_FLOW into RECO_GATE', async () => {
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
                goals: ['breakouts'],
              },
              is_returning: true,
              recent_logs: [],
              checkin_due: true,
            },
          }),
        );
      }

      if (path === '/v1/tracker/log') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_checkin',
            trace_id: 'trace_checkin',
            cards: [
              {
                card_id: 'tracker_1',
                type: 'tracker_log',
                payload: { ok: true },
              },
            ],
            reco_refresh_hint: {
              should_refresh: true,
              reason: 'checkin_logged',
              effective_window_days: 7,
            },
          }),
        );
      }

      if (path === '/v1/chat') {
        return Promise.resolve(makeEnvelope({ request_id: 'req_chat', trace_id: 'trace_chat' }));
      }

      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?chip_id=chip_checkin_now']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const saveButton = await screen.findByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButton);

    const refreshButton = await screen.findByRole('button', { name: /Refresh recommendations/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter(([path]) => path === '/v1/chat');
      expect(chatCalls).toHaveLength(1);
    });

    const chatCall = mock.mock.calls.find(([path]) => path === '/v1/chat');
    expect(chatCall).toBeTruthy();
    const body = JSON.parse(String((chatCall?.[2] as RequestInit | undefined)?.body || '{}')) as Record<string, any>;

    expect(body?.client_state).toBe('CHECKIN_FLOW');
    expect(body?.action?.action_id).toBe('chip.start.reco_products');
    expect(body?.requested_transition).toEqual({
      trigger_source: 'chip',
      trigger_id: 'chip.start.reco_products',
      requested_next_state: 'RECO_GATE',
    });
  });
});
