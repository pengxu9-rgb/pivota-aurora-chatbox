import React from 'react';
import { fireEvent, render, screen, waitFor } from '@/test/testProviders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

const mockNavigate = vi.fn();
const outletContext = {
  openSidebar: vi.fn(),
  startChat: vi.fn(),
  openComposer: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => outletContext,
  };
});

vi.mock('@/lib/pivotaAgentBff', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pivotaAgentBff')>('@/lib/pivotaAgentBff');
  return {
    ...actual,
    bffJson: vi.fn(),
  };
});

import { bffJson } from '@/lib/pivotaAgentBff';
import Profile from '@/pages/Profile';
import { clearAuroraAuthSession, saveAuroraAuthSession } from '@/lib/auth';
import { setLangPref } from '@/lib/persistence';
import { toast } from '@/components/ui/use-toast';
import type { Card, V1Envelope } from '@/lib/pivotaAgentBff';

const PROFILE_TEST_TIMEOUT_MS = 15_000;

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

function buildAuthSessionCard(token: string, email: string): Card {
  return {
    card_id: 'auth_session_card',
    type: 'auth_session',
    payload: {
      token,
      user: { email },
      expires_at: null,
    },
  };
}

function mockProfileBff(options?: {
  bootstrapProfile?: Record<string, unknown>;
  verifyToken?: string;
  verifyEmail?: string;
}) {
  const bootstrapProfile = options?.bootstrapProfile ?? null;
  const verifyToken = options?.verifyToken ?? 'token_after_verify';
  const verifyEmail = options?.verifyEmail ?? 'user@example.com';

  vi.mocked(bffJson).mockImplementation((path: string) => {
    if (path === '/v1/session/bootstrap') {
      return Promise.resolve(
        makeEnvelope({
          request_id: 'req_bootstrap',
          trace_id: 'trace_bootstrap',
          session_patch: { profile: bootstrapProfile },
        }),
      );
    }

    if (path === '/v1/auth/start') {
      return Promise.resolve(makeEnvelope({ request_id: 'req_auth_start', trace_id: 'trace_auth_start' }));
    }

    if (path === '/v1/auth/verify') {
      return Promise.resolve(
        makeEnvelope({
          request_id: 'req_auth_verify',
          trace_id: 'trace_auth_verify',
          cards: [buildAuthSessionCard(verifyToken, verifyEmail)],
        }),
      );
    }
    if (path === '/v1/auth/password/set') {
      return Promise.resolve(
        makeEnvelope({
          request_id: 'req_auth_password_set',
          trace_id: 'trace_auth_password_set',
          assistant_message: {
            role: 'assistant',
            content: 'Password set. Next time you can sign in with email + password (OTP still works too).',
          },
          cards: [{ card_id: 'auth_password_set_card', type: 'auth_password_set', payload: { ok: true } }],
        }),
      );
    }

    return Promise.resolve(makeEnvelope({ request_id: 'req_default', trace_id: 'trace_default' }));
  });
}

describe('Profile quick profile status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setLangPref('en');
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        writable: true,
      });
    }
  });

  it('shows incomplete state and starts quick profile flow', async () => {
    mockProfileBff({ bootstrapProfile: { skinType: 'oily' } });

    render(<Profile />);

    await screen.findByRole('button', { name: 'Start quick profile' });
    expect(screen.queryByRole('button', { name: 'Sign in to sync profile' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Select language' }), {
      target: { value: 'cn' },
    });
    await screen.findByRole('button', { name: '开始快速画像' });

    fireEvent.click(screen.getByRole('button', { name: '开始快速画像' }));

    expect(outletContext.startChat).toHaveBeenCalledWith({
      kind: 'chip',
      title: '快速画像',
      chip_id: 'chip_quick_profile',
    });
  }, PROFILE_TEST_TIMEOUT_MS);

  it('shows complete_guest state with sync CTA', async () => {
    mockProfileBff({
      bootstrapProfile: {
        skinType: 'oily',
        sensitivity: 'unknown',
        goals: ['breakouts'],
      },
    });

    render(<Profile />);

    await screen.findByRole('button', { name: 'Sign in to sync profile' });
    expect(screen.queryByRole('button', { name: 'Start quick profile' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in to sync profile' }));
    expect(await screen.findByText('Sign in to sync this device profile to your account.')).toBeInTheDocument();
  }, PROFILE_TEST_TIMEOUT_MS);

  it('resets auth UI after external auth changes and clears stale sync prompts', async () => {
    mockProfileBff({
      bootstrapProfile: {
        skinType: 'oily',
        sensitivity: 'unknown',
        goals: ['breakouts'],
      },
    });

    render(<Profile />);

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in to sync profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Password' }));
    fireEvent.change(screen.getByPlaceholderText('name@email.com'), {
      target: { value: 'stale@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'stale-password' },
    });

    expect(await screen.findByText('Please enter your email in the Account section below to sign in.')).toBeInTheDocument();

    saveAuroraAuthSession({ token: 'external_token', email: 'external@example.com', expires_at: null });

    await waitFor(() => {
      expect(screen.getAllByText('external@example.com').length).toBeGreaterThan(0);
    });
    await waitFor(() => {
      expect(screen.queryByText('Please enter your email in the Account section below to sign in.')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign in to sync this device profile to your account.')).not.toBeInTheDocument();
    });

    clearAuroraAuthSession();

    await screen.findByRole('button', { name: 'Send code' });
    expect(screen.getByText('New user? Just enter your email — a code will be sent and your account will be created automatically.')).toBeInTheDocument();
    expect(screen.queryByText('No password yet? Use Email code to sign in first, then set a password.')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('stale@example.com')).not.toBeInTheDocument();
  }, PROFILE_TEST_TIMEOUT_MS);

  it('shows complete_signed state and exposes the inline profile editor', async () => {
    saveAuroraAuthSession({ token: 'token_signed', email: 'signed@example.com', expires_at: null });
    mockProfileBff({
      bootstrapProfile: {
        skinType: 'dry',
        sensitivity: 'low',
        goals: ['barrier'],
      },
    });

    render(<Profile />);

    await screen.findByRole('button', { name: 'Save profile' });
    expect(screen.getByLabelText('Display name')).toHaveValue('');
    expect(screen.getByText('signed@example.com')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  }, PROFILE_TEST_TIMEOUT_MS);

  it('refreshes bootstrap with auth token after verify login', async () => {
    mockProfileBff({
      bootstrapProfile: {
        skinType: 'combination',
        sensitivity: 'medium',
        goals: ['texture'],
      },
      verifyToken: 'verified_token',
      verifyEmail: 'verify@example.com',
    });

    const mounted = render(<Profile />);

    await screen.findByRole('button', { name: 'Sign in to sync profile' });

    fireEvent.change(screen.getByPlaceholderText('name@email.com'), {
      target: { value: 'verify@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await screen.findByRole('button', { name: 'Verify' });

    fireEvent.change(screen.getByPlaceholderText('123456'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await screen.findByRole('button', { name: 'Save profile' });

    await waitFor(() => {
      const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
      expect(bootstrapCalls.length).toBeGreaterThanOrEqual(2);
    });

    const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
    const latestHeaders = bootstrapCalls[bootstrapCalls.length - 1]?.[1] as { auth_token?: string };
    expect(latestHeaders.auth_token).toBe('verified_token');
  }, PROFILE_TEST_TIMEOUT_MS);

  it('collapses password card after save and allows reopening via change password', async () => {
    saveAuroraAuthSession({ token: 'token_signed_pw', email: 'signed_pw@example.com', expires_at: null });
    mockProfileBff({
      bootstrapProfile: {
        skinType: 'dry',
        sensitivity: 'low',
        goals: ['barrier'],
      },
    });

    const mounted = render(<Profile />);

    await screen.findByRole('button', { name: 'Save password' });
    fireEvent.change(screen.getByLabelText('New password (min 8 chars)'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

    await screen.findByText('Password set. Next time you can sign in with email + password (OTP still works too).');
    await screen.findByRole('button', { name: 'Change password' });
    expect(screen.queryByRole('button', { name: 'Save password' })).not.toBeInTheDocument();

    mounted.unmount();
    render(<Profile />);
    await screen.findByRole('button', { name: 'Change password' });
    expect(screen.queryByRole('button', { name: 'Save password' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await screen.findByRole('button', { name: 'Save password' });
    expect(vi.mocked(toast)).toHaveBeenCalled();
  }, PROFILE_TEST_TIMEOUT_MS);

  it('saves display name with avatar upload entry for signed-in account and restores after remount', async () => {
    saveAuroraAuthSession({ token: 'token_signed_profile', email: 'signed_profile@example.com', expires_at: null });
    mockProfileBff({
      bootstrapProfile: {
        skinType: 'dry',
        sensitivity: 'low',
        goals: ['barrier'],
      },
    });

    const mounted = render(<Profile />);

    await screen.findByRole('button', { name: 'Save profile' });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Peng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await screen.findByText('Profile saved. Sidebar will show your latest name and avatar.');
    expect(screen.getByDisplayValue('Peng')).toBeInTheDocument();

    mounted.unmount();
    render(<Profile />);

    await screen.findByDisplayValue('Peng');
    await screen.findByRole('button', { name: 'Upload avatar' });
  }, PROFILE_TEST_TIMEOUT_MS);
});
