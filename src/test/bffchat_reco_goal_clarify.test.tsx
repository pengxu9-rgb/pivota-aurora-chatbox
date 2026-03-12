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

import { ShopProvider } from '@/contexts/shop';
import BffChat from '@/pages/BffChat';
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
  };
}

function setupBff(args?: { bootstrapProfile?: Record<string, unknown> | null; isReturning?: boolean }) {
  vi.mocked(bffJson).mockImplementation((path: string) => {
    if (path === '/v1/session/bootstrap') {
      return Promise.resolve(
        makeEnvelope({
          request_id: 'req_bootstrap',
          trace_id: 'trace_bootstrap',
          session_patch: {
            profile: args?.bootstrapProfile ?? null,
            is_returning: args?.isReturning ?? true,
            recent_logs: [],
            checkin_due: false,
          },
        }),
      );
    }

    if (path === '/v1/chat') {
      return Promise.resolve(makeEnvelope({ request_id: 'req_chat', trace_id: 'trace_chat' }));
    }

    return Promise.resolve(makeEnvelope());
  });
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

function getChatCalls() {
  return vi.mocked(bffJson).mock.calls.filter(([path]) => path === '/v1/chat');
}

function getLatestChatBody(): Record<string, any> {
  const latest = getChatCalls().at(-1);
  expect(latest).toBeTruthy();
  const init = latest?.[2] as RequestInit | undefined;
  return JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
}

describe('BffChat reco goal clarification', () => {
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

  it('clarifies the goal locally before sending bare return-welcome reco chips', async () => {
    setupBff({
      bootstrapProfile: {
        skinType: 'oily',
        sensitivity: 'low',
        barrierStatus: 'healthy',
      },
    });

    renderChat();

    const recoButton = await screen.findByRole('button', { name: 'Get product recommendations' });
    fireEvent.click(recoButton);

    expect(getChatCalls()).toHaveLength(0);
    await screen.findByText(/What do you want to prioritize first/i);

    fireEvent.click(screen.getByRole('button', { name: 'Breakouts' }));

    await waitFor(() => {
      expect(getChatCalls()).toHaveLength(1);
    });

    const body = getLatestChatBody();
    expect(body?.action?.action_id).toBe('chip.start.reco_products');
    expect(body?.action?.data?.profile_patch?.goals).toEqual(['acne']);
    expect(body?.action?.data?.trigger_source).toBe('reco_goal_clarify');
  });

  it('enriches return-welcome reco chips with the existing goal before sending chat', async () => {
    setupBff({
      bootstrapProfile: {
        skinType: 'oily',
        sensitivity: 'low',
        barrierStatus: 'healthy',
        goals: ['breakouts'],
      },
    });

    renderChat();

    const recoButton = await screen.findByRole('button', { name: 'Get product recommendations' });
    fireEvent.click(recoButton);

    await waitFor(() => {
      expect(getChatCalls()).toHaveLength(1);
    });

    expect(screen.queryByText(/What do you want to prioritize first/i)).not.toBeInTheDocument();

    const body = getLatestChatBody();
    expect(body?.action?.action_id).toBe('chip.start.reco_products');
    expect(body?.action?.data?.profile_patch?.goals).toEqual(['acne']);
    expect(body?.action?.data?.chip_id).toBe('chip_get_recos');
  });
});
