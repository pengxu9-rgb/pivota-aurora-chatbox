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
    fetchRecoAlternatives: vi.fn(),
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

function renderChat(initialEntry = '/chat') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ShopProvider>
        <BffChat />
      </ShopProvider>
    </MemoryRouter>,
  );
}

describe('BffChat auth sheet password sign-in', () => {
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

  it('opens in-place from the route and signs in with password', async () => {
    vi.mocked(bffJson).mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap',
            trace_id: 'trace_bootstrap',
          }),
        );
      }

      if (path === '/v1/auth/password/login') {
        return Promise.resolve(
          makeEnvelope({
            cards: [
              {
                card_id: 'auth_session_1',
                type: 'auth_session',
                payload: {
                  token: 'auth_token_123',
                  user: { email: 'tester@example.com' },
                  expires_at: null,
                },
              },
            ],
          }),
        );
      }

      return Promise.resolve(makeEnvelope());
    });

    renderChat('/chat?open=auth');

    await screen.findByText('Enter your email to get a sign-in code (for cross-device profile).');
    fireEvent.click(screen.getByRole('button', { name: 'Password' }));

    fireEvent.change(screen.getByPlaceholderText('name@email.com'), {
      target: { value: 'tester@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'test-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      const loginCalls = vi.mocked(bffJson).mock.calls.filter(([path]) => path === '/v1/auth/password/login');
      expect(loginCalls).toHaveLength(1);
      const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter(([path]) => path === '/v1/session/bootstrap');
      expect(bootstrapCalls.length).toBeGreaterThanOrEqual(2);
      const latestHeaders = bootstrapCalls[bootstrapCalls.length - 1]?.[1] as { auth_token?: string };
      expect(latestHeaders.auth_token).toBe('auth_token_123');
    });
  });
});
