import React from 'react';
import { fireEvent, render, screen, waitFor } from '@/test/testProviders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const outletContext = {
  openSidebar: vi.fn(),
  startChat: vi.fn(),
  openComposer: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useOutletContext: () => outletContext,
  };
});

vi.mock('@/lib/activityApi', () => ({
  listActivity: vi.fn(),
}));

vi.mock('@/lib/persistence', () => ({
  getLangPref: () => 'en',
}));

import ActivityPage from '@/pages/Activity';
import { listActivity } from '@/lib/activityApi';

describe('Activity page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads first page and renders activities', async () => {
    vi.mocked(listActivity).mockResolvedValueOnce({
      items: [
        {
          activity_id: 'act_1',
          event_type: 'travel_plan_created',
          payload: { destination: 'Tokyo' },
          deeplink: '/plans/trip_tokyo',
          source: 'travel_plans',
          occurred_at_ms: Date.now(),
        },
      ],
      next_cursor: null,
    });

    render(<ActivityPage />);

    expect(await screen.findByText('Created a travel plan')).toBeInTheDocument();
    expect(screen.getByText(/Tokyo/)).toBeInTheDocument();
    expect(listActivity).toHaveBeenCalledWith('EN', { limit: 20, cursor: null });
  });

  it('supports pagination via Load more', async () => {
    vi.mocked(listActivity)
      .mockResolvedValueOnce({
        items: [
          {
            activity_id: 'act_1',
            event_type: 'chat_started',
            payload: {},
            deeplink: '/chat',
            source: 'mobile_shell',
            occurred_at_ms: Date.now(),
          },
        ],
        next_cursor: 'cursor_1',
      })
      .mockResolvedValueOnce({
        items: [
          {
            activity_id: 'act_2',
            event_type: 'tracker_logged',
            payload: { date: '2099-03-01' },
            deeplink: '/chat',
            source: 'tracker',
            occurred_at_ms: Date.now() - 1000,
          },
        ],
        next_cursor: null,
      });

    render(<ActivityPage />);
    await screen.findByText('Started a chat');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Logged a check-in')).toBeInTheDocument();
    await waitFor(() => {
      expect(listActivity).toHaveBeenNthCalledWith(2, 'EN', { limit: 20, cursor: 'cursor_1' });
    });
  });

  it('opens deeplink when activity item is clicked', async () => {
    vi.mocked(listActivity).mockResolvedValueOnce({
      items: [
        {
          activity_id: 'act_1',
          event_type: 'travel_plan_updated',
          payload: { destination: 'Paris' },
          deeplink: '/plans/trip_paris',
          source: 'travel_plans',
          occurred_at_ms: Date.now(),
        },
      ],
      next_cursor: null,
    });

    render(<ActivityPage />);
    fireEvent.click(await screen.findByText('Updated a travel plan'));

    expect(navigateMock).toHaveBeenCalledWith('/plans/trip_paris');
  });
});
