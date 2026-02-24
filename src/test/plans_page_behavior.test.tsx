import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const outletContext = {
  openSidebar: vi.fn(),
  startChat: vi.fn(),
  openComposer: vi.fn(),
};

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => outletContext,
    useNavigate: () => navigateMock,
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
    vi.mocked(archiveTravelPlan).mockResolvedValue({
      plan: makePlan({ trip_id: 'trip_1', status: 'archived', is_archived: true }),
      summary: {
        active_trip_id: null,
        counts: { in_trip: 0, upcoming: 0, completed: 0, archived: 1 },
      },
    });
  });

  it('renders create section before plan list section', async () => {
    render(<Plans />);
    const createTitle = await screen.findByText('Create new plan');
    const listTitle = screen.getByText('Your travel plans');

    expect(createTitle.compareDocumentPosition(listTitle) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('create plan stays on page and does not auto-start chat', async () => {
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
    expect(outletContext.startChat).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalled();
  });

  it('uses compact list cards and navigates via View details', async () => {
    vi.mocked(listTravelPlans).mockResolvedValueOnce({
      plans: [
        makePlan({
          trip_id: 'trip_chat',
          destination: 'Paris',
          itinerary: 'mostly outdoor daytime',
          prep_checklist: ['Avoid strong actives', 'Pack sunscreen'],
        }),
      ],
      summary: {
        active_trip_id: 'trip_chat',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });

    render(<Plans />);
    await screen.findByText('Paris');

    expect(screen.queryByText('Prep checklist')).not.toBeInTheDocument();
    expect(screen.queryByText('mostly outdoor daytime')).not.toBeInTheDocument();

    const viewDetailsButton = screen.getByRole('button', { name: 'View details' });
    fireEvent.click(viewDetailsButton);

    expect(navigateMock).toHaveBeenCalledWith('/plans/trip_chat', {
      state: {
        plan: expect.objectContaining({ trip_id: 'trip_chat', destination: 'Paris' }),
      },
    });
  });

  it('starts chat only when Open in chat is clicked', async () => {
    vi.mocked(listTravelPlans).mockResolvedValueOnce({
      plans: [makePlan({ trip_id: 'trip_chat', destination: 'Seoul' })],
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

  it('archives a plan directly from list card', async () => {
    vi.mocked(listTravelPlans).mockResolvedValueOnce({
      plans: [makePlan({ trip_id: 'trip_archive', destination: 'Berlin' })],
      summary: {
        active_trip_id: 'trip_archive',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });

    render(<Plans />);
    const archiveButton = await screen.findByRole('button', { name: 'Archive' });
    fireEvent.click(archiveButton);

    await waitFor(() => {
      expect(archiveTravelPlan).toHaveBeenCalledWith('EN', 'trip_archive');
    });
  });
});
