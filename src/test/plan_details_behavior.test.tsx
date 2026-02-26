import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TravelPlanCardModel } from '@/lib/travelPlansApi';

const outletContext = {
  openSidebar: vi.fn(),
  startChat: vi.fn(),
  openComposer: vi.fn(),
};

const navigateMock = vi.fn();
let routeState: { plan?: TravelPlanCardModel | null } | null = null;
let routeParams: { tripId?: string } = { tripId: 'trip_1' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => outletContext,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: routeState }),
    useParams: () => routeParams,
  };
});

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/travelPlansApi', () => ({
  getTravelPlanById: vi.fn(),
  archiveTravelPlan: vi.fn(),
  updateTravelPlan: vi.fn(),
}));

import PlanDetails from '@/pages/PlanDetails';
import { toast } from '@/components/ui/use-toast';
import { archiveTravelPlan, getTravelPlanById } from '@/lib/travelPlansApi';

function makePlan(overrides: Partial<TravelPlanCardModel> = {}): TravelPlanCardModel {
  return {
    trip_id: overrides.trip_id ?? 'trip_1',
    destination: overrides.destination ?? 'Paris',
    start_date: overrides.start_date ?? '2099-02-01',
    end_date: overrides.end_date ?? '2099-02-05',
    created_at_ms: overrides.created_at_ms ?? 1,
    updated_at_ms: overrides.updated_at_ms ?? 1,
    status: overrides.status ?? 'upcoming',
    itinerary: overrides.itinerary ?? 'mostly outdoor daytime',
    prep_checklist: overrides.prep_checklist ?? ['Pack sunscreen'],
    ...overrides,
  };
}

describe('PlanDetails behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams = { tripId: 'trip_1' };
    routeState = null;
    vi.mocked(getTravelPlanById).mockResolvedValue({
      plan: makePlan(),
      summary: {
        active_trip_id: 'trip_1',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });
    vi.mocked(archiveTravelPlan).mockResolvedValue({
      plan: makePlan({ status: 'archived', is_archived: true }),
      summary: {
        active_trip_id: null,
        counts: { in_trip: 0, upcoming: 0, completed: 0, archived: 1 },
      },
    });
  });

  it('renders from route state without extra fetch', async () => {
    routeState = { plan: makePlan({ trip_id: 'trip_state', destination: 'Tokyo' }) };
    routeParams = { tripId: 'trip_state' };

    render(<PlanDetails />);

    await screen.findByText('Tokyo');
    expect(screen.getByText('mostly outdoor daytime')).toBeInTheDocument();
    expect(screen.getByText('Pack sunscreen')).toBeInTheDocument();
    expect(getTravelPlanById).not.toHaveBeenCalled();
  });

  it('loads by trip id on deep link when route state is missing', async () => {
    routeState = null;
    routeParams = { tripId: 'trip_deep' };
    vi.mocked(getTravelPlanById).mockResolvedValueOnce({
      plan: makePlan({ trip_id: 'trip_deep', destination: 'Seoul' }),
      summary: {
        active_trip_id: 'trip_deep',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });

    render(<PlanDetails />);

    await screen.findByText('Seoul');
    expect(getTravelPlanById).toHaveBeenCalledWith('EN', 'trip_deep');
  });

  it('opens chat only when Open in chat is clicked', async () => {
    routeState = { plan: makePlan({ trip_id: 'trip_chat', destination: 'London' }) };
    routeParams = { tripId: 'trip_chat' };

    render(<PlanDetails />);
    await screen.findByText('London');

    expect(outletContext.startChat).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open in chat' }));

    expect(outletContext.startChat).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'query',
        title: 'Travel skincare: London',
      }),
    );
  });

  it('archives the plan and shows success toast', async () => {
    routeState = { plan: makePlan({ trip_id: 'trip_archive' }) };
    routeParams = { tripId: 'trip_archive' };

    render(<PlanDetails />);
    await screen.findByText('Paris');

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => {
      expect(archiveTravelPlan).toHaveBeenCalledWith('EN', 'trip_archive');
    });
    expect(toast).toHaveBeenCalled();
  });
});
