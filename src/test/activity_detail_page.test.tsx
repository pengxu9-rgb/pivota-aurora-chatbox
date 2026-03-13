import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ activityId: 'act_1' }),
  };
});

vi.mock('@/lib/activityApi', () => ({
  getActivityDetail: vi.fn(),
}));

vi.mock('@/lib/persistence', () => ({
  getLangPref: () => 'en',
}));

import ActivityDetailPage from '@/pages/ActivityDetail';
import { getActivityDetail } from '@/lib/activityApi';

describe('Activity detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders skin analysis snapshot and actions', async () => {
    vi.mocked(getActivityDetail).mockResolvedValueOnce({
      item: {
        activity_id: 'act_1',
        event_type: 'skin_analysis',
        payload: { used_photos: true },
        deeplink: '/chat?brief_id=brief_1',
        source: 'analysis_skin',
        occurred_at_ms: Date.now(),
        detail_available: true,
      },
      detail: {
        kind: 'skin_analysis',
        snapshot: {
          skin_type: 'oily',
          barrier_status: 'healthy',
          sensitivity: 'low',
          confidence_level: 'high',
          goals: ['acne', 'hydration'],
          ingredient_plan: {
            intensity: 'balanced',
            targets: [{ ingredient_name: 'niacinamide', why: 'oil balance' }],
          },
        },
        actions: [
          {
            action_id: 'continue_chat',
            label: 'Continue chat',
            deeplink: '/chat?q=followup',
            variant: 'primary',
          },
        ],
      },
    });

    render(<ActivityDetailPage />);

    expect(await screen.findByText('Completed skin analysis')).toBeInTheDocument();
    expect(screen.getByText('oily')).toBeInTheDocument();
    expect(screen.getByText('Continue chat')).toBeInTheDocument();
    expect(getActivityDetail).toHaveBeenCalledWith('EN', 'act_1');
  });

  it('navigates using action deeplink', async () => {
    vi.mocked(getActivityDetail).mockResolvedValueOnce({
      item: {
        activity_id: 'act_1',
        event_type: 'tracker_logged',
        payload: { date: '2099-03-01' },
        deeplink: '/chat?open=checkin',
        source: 'tracker',
        occurred_at_ms: Date.now(),
        detail_available: true,
      },
      detail: {
        kind: 'tracker_logged',
        snapshot: {
          date: '2099-03-01',
          redness: 2,
          acne: 1,
          hydration: 4,
        },
        actions: [
          {
            action_id: 'open_tracker',
            label: 'Open check-in',
            deeplink: '/chat?open=checkin',
            variant: 'primary',
          },
        ],
      },
    });

    render(<ActivityDetailPage />);
    fireEvent.click(await screen.findByText('Open check-in'));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/chat?open=checkin');
    });
  });
});
