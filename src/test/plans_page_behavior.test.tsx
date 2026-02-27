import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const outletContext = {
  openSidebar: vi.fn(),
  startChat: vi.fn(),
  openComposer: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => outletContext,
  };
});

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/travelPlansApi', () => ({
  listTravelPlans: vi.fn(),
  createTravelPlan: vi.fn(),
  updateTravelPlan: vi.fn(),
  archiveTravelPlan: vi.fn(),
}));

import Plans from '@/pages/Plans';
import { toast } from '@/components/ui/use-toast';
import {
  archiveTravelPlan,
  createTravelPlan,
  listTravelPlans,
  updateTravelPlan,
  type TravelPlanCardModel,
} from '@/lib/travelPlansApi';

function makePlan(overrides: Partial<TravelPlanCardModel> = {}): TravelPlanCardModel {
  return {
    trip_id: overrides.trip_id ?? 'trip_1',
    destination: overrides.destination ?? 'Tokyo',
    start_date: overrides.start_date ?? '2099-03-01',
    end_date: overrides.end_date ?? '2099-03-05',
    created_at_ms: overrides.created_at_ms ?? 1,
    updated_at_ms: overrides.updated_at_ms ?? 1,
    status: overrides.status ?? 'upcoming',
    prep_checklist: overrides.prep_checklist ?? ['Pack sunscreen'],
    ...overrides,
  };
}

describe('Plans page behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listTravelPlans).mockResolvedValue({
      plans: [],
      summary: {
        active_trip_id: null,
        counts: { in_trip: 0, upcoming: 0, completed: 0, archived: 0 },
      },
    });
    vi.mocked(createTravelPlan).mockResolvedValue({
      plan: makePlan({ trip_id: 'trip_new' }),
      summary: {
        active_trip_id: 'trip_new',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });
    vi.mocked(updateTravelPlan).mockResolvedValue({
      plan: makePlan({ trip_id: 'trip_1', destination: 'Tokyo Updated' }),
      summary: {
        active_trip_id: 'trip_1',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });
    vi.mocked(archiveTravelPlan).mockResolvedValue({
      plan: makePlan({ trip_id: 'trip_1', status: 'archived', is_archived: true }),
      summary: {
        active_trip_id: null,
        counts: { in_trip: 0, upcoming: 0, completed: 0, archived: 1 },
      },
    });
  });

  it('create plan auto-starts travel analysis chat', async () => {
    render(<Plans />);
    await screen.findByText('Create new plan');

    fireEvent.change(screen.getByPlaceholderText('e.g. Tokyo / Paris'), {
      target: { value: 'Tokyo' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2099-03-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2099-03-05' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

    await waitFor(() => {
      expect(createTravelPlan).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(outletContext.startChat).toHaveBeenCalledTimes(1);
    });
    expect(outletContext.startChat).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'query',
        title: 'Travel skincare plan',
      }),
    );
    expect(outletContext.startChat).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('Destination: Tokyo'),
      }),
    );
    expect(toast).toHaveBeenCalled();
  });

  it('starts chat only when Open in chat is clicked', async () => {
    vi.mocked(listTravelPlans).mockResolvedValueOnce({
      plans: [makePlan({ trip_id: 'trip_chat' })],
      summary: {
        active_trip_id: 'trip_chat',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });

    render(<Plans />);
    const openInChatButton = await screen.findByRole('button', { name: 'Open in chat' });
    fireEvent.click(openInChatButton);

    expect(outletContext.startChat).toHaveBeenCalledTimes(1);
    expect(outletContext.startChat).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'query',
        title: 'Travel skincare plan',
      }),
    );
  });
});
