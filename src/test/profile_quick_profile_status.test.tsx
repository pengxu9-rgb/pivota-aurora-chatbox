import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { saveAuroraAuthSession } from '@/lib/auth';
import { toast } from '@/components/ui/use-toast';
import type { Card, V1Envelope } from '@/lib/pivotaAgentBff';

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
  });

  it('shows incomplete state and starts quick profile flow', async () => {
    mockProfileBff({ bootstrapProfile: { skinType: 'oily' } });

    render(<Profile />);

    await screen.findByRole('button', { name: 'Start quick profile' });
    expect(screen.queryByRole('button', { name: 'Sign in to bind profile' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start quick profile' }));

    expect(outletContext.startChat).toHaveBeenCalledWith({
      kind: 'chip',
      title: 'Quick Profile',
      chip_id: 'chip_quick_profile',
    });
  });

  it('shows complete_guest state with bind CTA', async () => {
    mockProfileBff({
      bootstrapProfile: {
        skinType: 'oily',
        sensitivity: 'unknown',
        goals: ['breakouts'],
      },
    });

    render(<Profile />);

    await screen.findByRole('button', { name: 'Sign in to bind profile' });
    expect(screen.queryByRole('button', { name: 'Start quick profile' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in to bind profile' }));
    expect(screen.getByText('Sign in to bind this device profile to your account.')).toBeInTheDocument();
  });

  it('shows complete_signed state and opens profile editor route', async () => {
    saveAuroraAuthSession({ token: 'token_signed', email: 'signed@example.com', expires_at: null });
    mockProfileBff({
      bootstrapProfile: {
        skinType: 'dry',
        sensitivity: 'low',
        goals: ['barrier'],
      },
    });

    render(<Profile />);

    const editButton = await screen.findByRole('button', { name: 'Edit full profile' });
    fireEvent.click(editButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navArg = mockNavigate.mock.calls[0]?.[0] as { pathname: string; search: string };
    expect(navArg.pathname).toBe('/chat');
    expect(navArg.search).toContain('open=profile');
  });

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

    await screen.findByRole('button', { name: 'Sign in to bind profile' });

    fireEvent.change(screen.getByPlaceholderText('name@email.com'), {
      target: { value: 'verify@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await screen.findByRole('button', { name: 'Verify' });

    fireEvent.change(screen.getByPlaceholderText('123456'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await screen.findByRole('button', { name: 'Edit full profile' });

    await waitFor(() => {
      const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
      expect(bootstrapCalls.length).toBeGreaterThanOrEqual(2);
    });

    const bootstrapCalls = vi.mocked(bffJson).mock.calls.filter((call) => call[0] === '/v1/session/bootstrap');
    const latestHeaders = bootstrapCalls[bootstrapCalls.length - 1]?.[1] as { auth_token?: string };
    expect(latestHeaders.auth_token).toBe('verified_token');
  });

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
  });

  it('saves display name and avatar url for signed-in account and restores after remount', async () => {
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
    fireEvent.change(screen.getByLabelText('Avatar URL'), {
      target: { value: 'https://example.com/avatar.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await screen.findByText('Profile saved. Sidebar will show your latest name and avatar.');
    expect(screen.getByDisplayValue('Peng')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.com/avatar.png')).toBeInTheDocument();

    mounted.unmount();
    render(<Profile />);

    await screen.findByDisplayValue('Peng');
    await screen.findByDisplayValue('https://example.com/avatar.png');
  });
});
