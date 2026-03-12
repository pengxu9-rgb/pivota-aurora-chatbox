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
    sendRecoEmployeeFeedback: vi.fn(),
  };
});

vi.mock('@/lib/glowSessionProfile', async () => {
  const actual = await vi.importActual<typeof import('@/lib/glowSessionProfile')>('@/lib/glowSessionProfile');
  return {
    ...actual,
    patchGlowSessionProfile: vi.fn(),
  };
});

import { ShopProvider } from '@/contexts/shop';
import BffChat from '@/pages/BffChat';
import { toast } from '@/components/ui/use-toast';
import { clearAuroraAuthSession, saveAuroraAuthSession } from '@/lib/auth';
import { bffJson } from '@/lib/pivotaAgentBff';
import { patchGlowSessionProfile } from '@/lib/glowSessionProfile';
import type { V1Envelope } from '@/lib/pivotaAgentBff';

const QUICK_PROFILE_TEST_TIMEOUT_MS = 60_000;

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

function mockBff(opts?: {
  onProfileUpdate?: () => Promise<unknown>;
}) {
  vi.mocked(bffJson).mockImplementation((path: string) => {
    if (path === '/v1/session/bootstrap') {
      return Promise.resolve(
        makeEnvelope({
          request_id: 'req_bootstrap',
          trace_id: 'trace_bootstrap',
        }),
      );
    }
    if (path === '/v1/profile/update') {
      if (opts?.onProfileUpdate) return opts.onProfileUpdate();
      return Promise.resolve(makeEnvelope({ request_id: 'req_profile_update', trace_id: 'trace_profile_update' }));
    }
    return Promise.resolve(makeEnvelope());
  });
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

async function openQuickProfile() {
  renderChat();

  await waitFor(() => {
    const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
    expect(bootstrapCalls.length).toBeGreaterThan(0);
  });

  fireEvent.click(screen.getByRole('button', { name: '30-sec quick profile' }));
  await screen.findByText(/A few hours after cleansing/i);
}

async function completeQuickProfile() {
  fireEvent.click(screen.getByRole('button', { name: 'Oily' }));
  await screen.findByText(/#1 goal/i);

  fireEvent.click(screen.getByRole('button', { name: 'Breakouts' }));
  await screen.findByText(/consider your skin sensitive/i);

  fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
  await screen.findByText(/Two more for accuracy/i);

  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
}

describe('BffChat quick profile persistence and bind prompt', () => {
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

  it(
    'continues quick profile flow even when legacy /session/profile/patch fails',
    async () => {
    mockBff();
    vi.mocked(patchGlowSessionProfile).mockRejectedValue(new Error('legacy_down'));

    await openQuickProfile();
    await completeQuickProfile();

    await screen.findByText(/Quick tip/i);
    await waitFor(() => {
      const profileUpdateCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/profile/update');
      expect(profileUpdateCalls.length).toBe(3);
    });
      expect(vi.mocked(patchGlowSessionProfile)).toHaveBeenCalledTimes(3);
    },
    QUICK_PROFILE_TEST_TIMEOUT_MS,
  );

  it(
    'does not block progression when /v1/profile/update fails and shows non-blocking toast',
    async () => {
    mockBff({
      onProfileUpdate: () => Promise.reject(new Error('timeout')),
    });
    vi.mocked(patchGlowSessionProfile).mockResolvedValue({
      ok: true,
      schema_version: 'v1',
      session: { schema_version: 'v1', profile: null },
    });

    await openQuickProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Oily' }));

    await screen.findByText(/#1 goal/i);
    expect(vi.mocked(toast)).toHaveBeenCalled();
    },
    QUICK_PROFILE_TEST_TIMEOUT_MS,
  );

  it(
    'shows sign-in sync prompt after completion when user is not signed in',
    async () => {
    mockBff();
    vi.mocked(patchGlowSessionProfile).mockResolvedValue({
      ok: true,
      schema_version: 'v1',
      session: { schema_version: 'v1', profile: null },
    });

    await openQuickProfile();
    await completeQuickProfile();

    await screen.findByText('Saved on this device; sign in to bind and sync across devices.');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to sync profile' }));
    await screen.findByRole('button', { name: 'Send code' });
    },
    QUICK_PROFILE_TEST_TIMEOUT_MS,
  );

  it(
    'sends auth token on the first bootstrap when chat opens signed in',
    async () => {
      saveAuroraAuthSession({ token: 'seed_token', email: 'seed@example.com', expires_at: null });
      mockBff();

      renderChat();

      await waitFor(() => {
        const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
        expect(bootstrapCalls.length).toBeGreaterThan(0);
      });

      const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
      const firstHeaders = bootstrapCalls[0]?.[1] as { auth_token?: string };
      expect(firstHeaders.auth_token).toBe('seed_token');
    },
    QUICK_PROFILE_TEST_TIMEOUT_MS,
  );

  it(
    'refreshes bootstrap and resets auth UI after external auth changes',
    async () => {
      mockBff();

      renderChat('/chat?open=auth');

      await screen.findByRole('button', { name: 'Password' });
      fireEvent.click(screen.getByRole('button', { name: 'Password' }));
      fireEvent.change(screen.getByPlaceholderText('name@email.com'), {
        target: { value: 'stale@example.com' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter password'), {
        target: { value: 'stale-password' },
      });

      saveAuroraAuthSession({ token: 'external_token', email: 'external@example.com', expires_at: null });

      await screen.findByText('Signed in');
      await waitFor(() => {
        const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
        expect(bootstrapCalls.length).toBeGreaterThanOrEqual(2);
        const latestHeaders = bootstrapCalls[bootstrapCalls.length - 1]?.[1] as { auth_token?: string };
        expect(latestHeaders.auth_token).toBe('external_token');
      });

      const bootstrapCountAfterSignIn = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap').length;
      clearAuroraAuthSession();

      await screen.findByRole('button', { name: 'Send code' });
      await waitFor(() => {
        const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
        expect(bootstrapCalls.length).toBeGreaterThan(bootstrapCountAfterSignIn);
        const latestHeaders = bootstrapCalls[bootstrapCalls.length - 1]?.[1] as { auth_token?: string };
        expect(latestHeaders.auth_token).toBeUndefined();
      });
      expect(screen.getByText('Enter your email to get a sign-in code (for cross-device profile).')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Enter password')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('stale@example.com')).not.toBeInTheDocument();
    },
    QUICK_PROFILE_TEST_TIMEOUT_MS,
  );
});
