import React from 'react';
import { fireEvent, render, screen, waitFor } from '@/test/testProviders';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/lib/activityApi', () => ({
  listActivity: vi.fn(),
}));

vi.mock('@/lib/persistence', () => ({
  getLangPref: () => 'en',
}));

import Home from '@/pages/Home';
import { listActivity } from '@/lib/activityApi';

describe('Home recent activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listActivity).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
  });

  it('renders recent activity list when activity exists', async () => {
    vi.mocked(listActivity).mockResolvedValueOnce({
      items: [
        {
          activity_id: 'act_chat',
          event_type: 'chat_started',
          payload: { entry: 'home' },
          deeplink: '/chat',
          source: 'mobile_shell',
          occurred_at_ms: Date.now(),
        },
        {
          activity_id: 'act_1',
          event_type: 'tracker_logged',
          payload: { date: '2099-03-01' },
          deeplink: '/chat?open=checkin',
          source: 'tracker',
          occurred_at_ms: Date.now() - 1000,
          detail_available: true,
        },
      ],
      next_cursor: null,
    });

    render(<Home />);

    expect(await screen.findByText('Logged a check-in')).toBeInTheDocument();
    await waitFor(() => {
      expect(listActivity).toHaveBeenCalledWith('EN', { limit: 10 });
    });
  });

  it('shows empty-state CTA when activity is empty', async () => {
    render(<Home />);

    expect(await screen.findByText('Start your first skin diagnosis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(outletContext.startChat).toHaveBeenCalledWith({
      kind: 'chip',
      title: 'Skin Diagnosis',
      chip_id: 'chip.start.diagnosis',
    });
  });

  it('navigates to /activity when See all is clicked', async () => {
    render(<Home />);
    await screen.findByText('Recent activity');

    fireEvent.click(screen.getByRole('button', { name: 'See all' }));
    expect(mockNavigate).toHaveBeenCalledWith('/activity');
    expect(outletContext.openComposer).not.toHaveBeenCalled();
  });

  it('opens activity detail instead of deeplink when detail is available', async () => {
    vi.mocked(listActivity).mockResolvedValueOnce({
      items: [
        {
          activity_id: 'act_1',
          event_type: 'skin_analysis',
          payload: { used_photos: true },
          deeplink: '/chat?brief_id=brief_1',
          source: 'analysis_skin',
          occurred_at_ms: Date.now(),
          detail_available: true,
        },
      ],
      next_cursor: null,
    });

    render(<Home />);
    fireEvent.click(await screen.findByText('Completed skin analysis'));

    expect(mockNavigate).toHaveBeenCalledWith('/activity/act_1');
  });
});
