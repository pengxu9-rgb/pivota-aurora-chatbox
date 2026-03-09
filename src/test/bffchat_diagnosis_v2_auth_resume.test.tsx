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

describe('BffChat diagnosis v2 auth resume', () => {
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

  it('opens the auth sheet in-place and resumes diagnosis after password login', async () => {
    let diagnosisStartCount = 0;

    vi.mocked(bffJson).mockImplementation((path: string, headers?: Record<string, unknown>) => {
      if (path === '/v1/session/bootstrap') {
        return Promise.resolve(
          makeEnvelope({
            request_id: 'req_bootstrap',
            trace_id: 'trace_bootstrap',
          }),
        );
      }

      if (path === '/v1/diagnosis/start') {
        diagnosisStartCount += 1;
        if (diagnosisStartCount === 1) {
          return Promise.resolve({
            ok: true,
            stage: 'login_prompt',
            card: {
              type: 'diagnosis_v2_login_prompt',
              payload: {
                prompt_text: 'Log in for better diagnosis',
                login_action: { type: 'login_then_diagnose', label: 'Log in', payload: { pending_goals: ['barrier_repair'] } },
                skip_action: { type: 'skip_login', label: 'Skip, start now', payload: { pending_goals: ['barrier_repair'] } },
                pending_goals: ['barrier_repair'],
              },
            },
          });
        }

        expect(headers?.auth_token).toBe('auth_token_123');
        return Promise.resolve({
          ok: true,
          stage: 'intro',
          card: {
            type: 'diagnosis_v2_intro',
            payload: {
              goal_profile: {
                selected_goals: ['barrier_repair'],
                custom_input: '',
                constraints: [],
              },
              is_cold_start: false,
              question_strategy: 'default',
              followup_questions: [],
              actions: [],
            },
          },
        });
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

    renderChat(`/chat?open=diagnosis_v2&goals=${encodeURIComponent(JSON.stringify(['barrier_repair']))}`);

    await screen.findByRole('button', { name: 'Log in' });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await screen.findByRole('button', { name: 'Password' });
    fireEvent.click(screen.getByRole('button', { name: 'Password' }));
    fireEvent.change(screen.getByPlaceholderText('name@email.com'), {
      target: { value: 'tester@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter password'), {
      target: { value: 'test-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('heading', { name: 'Choose your skincare goals' });
    await waitFor(() => {
      const diagnosisStartCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/diagnosis/start');
      expect(diagnosisStartCalls).toHaveLength(2);
    });
  });
});
