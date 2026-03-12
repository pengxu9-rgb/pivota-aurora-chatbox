import React from 'react';
import { fireEvent, render, screen, waitFor } from '@/test/testProviders';
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

vi.mock('@/lib/travelPlansApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/travelPlansApi')>('@/lib/travelPlansApi');
  return {
    ...actual,
    getTravelPlanById: vi.fn(),
    archiveTravelPlan: vi.fn(),
    updateTravelPlan: vi.fn(),
  };
});

import PlanDetails from '@/pages/PlanDetails';
import { toast } from '@/components/ui/use-toast';
import { PivotaAgentBffError } from '@/lib/pivotaAgentBff';
import { archiveTravelPlan, getTravelPlanById, updateTravelPlan } from '@/lib/travelPlansApi';

function makePlan(overrides: Partial<TravelPlanCardModel> = {}): TravelPlanCardModel {
  return {
    trip_id: overrides.trip_id ?? 'trip_1',
    destination: overrides.destination ?? 'Paris',
    departure_region: overrides.departure_region ?? 'San Francisco',
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
        home_region: 'San Francisco',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });
    vi.mocked(archiveTravelPlan).mockResolvedValue({
      plan: makePlan({ status: 'archived', is_archived: true }),
      summary: {
        active_trip_id: null,
        home_region: 'San Francisco',
        counts: { in_trip: 0, upcoming: 0, completed: 0, archived: 1 },
      },
    });
    vi.mocked(updateTravelPlan).mockResolvedValue({
      plan: makePlan({ destination: 'Paris Updated' }),
      summary: {
        active_trip_id: 'trip_1',
        home_region: 'San Francisco',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
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
        home_region: 'San Francisco',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });

    render(<PlanDetails />);

    await screen.findByText('Seoul');
    expect(getTravelPlanById).toHaveBeenCalledWith('EN', 'trip_deep');
  });

  it('opens chat only when Open in chat is clicked', async () => {
    routeState = {
      plan: makePlan({
        trip_id: 'trip_chat',
        destination: 'London',
        destination_place: {
          label: 'London, England, United Kingdom',
          canonical_name: 'London',
          latitude: 51.50853,
          longitude: -0.12574,
          country_code: 'GB',
          country: 'United Kingdom',
          admin1: 'England',
          timezone: 'Europe/London',
          resolution_source: 'auto_resolved',
        },
      }),
    };
    routeParams = { tripId: 'trip_chat' };

    render(<PlanDetails />);
    await screen.findByText('London');

    expect(outletContext.startChat).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open in chat' }));

    expect(outletContext.startChat).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'query',
        title: 'Travel skincare: London',
        session_patch: expect.objectContaining({
          profile: expect.objectContaining({
            travel_plan: expect.objectContaining({
              trip_id: 'trip_chat',
              departure_region: 'San Francisco',
              destination_place: expect.objectContaining({
                canonical_name: 'London',
                timezone: 'Europe/London',
              }),
            }),
          }),
        }),
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

  it('uses responsive travel date classes in edit panel', async () => {
    routeState = {
      plan: makePlan({
        trip_id: 'trip_edit_layout',
        destination: 'Lisbon',
        start_date: '2099-05-03',
        end_date: '2099-05-08',
      }),
    };
    routeParams = { tripId: 'trip_edit_layout' };

    render(<PlanDetails />);
    await screen.findByText('Lisbon');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const startDateInput = screen.getByLabelText('Start date');
    const endDateInput = screen.getByLabelText('End date');
    const dateGrid = startDateInput.closest('.travel-date-grid');

    expect(dateGrid).toBeTruthy();
    expect(endDateInput.closest('.travel-date-grid')).toBe(dateGrid);
    expect(startDateInput.className).toContain('travel-date-input');
    expect(endDateInput.className).toContain('travel-date-input');
  });

  it('retries update after destination ambiguity selection', async () => {
    routeState = { plan: makePlan({ trip_id: 'trip_ambiguous', destination: 'Paris' }) };
    routeParams = { tripId: 'trip_ambiguous' };
    vi.mocked(updateTravelPlan)
      .mockRejectedValueOnce(
        new PivotaAgentBffError('Request failed: 409 Conflict', 409, {
          error: 'DESTINATION_AMBIGUOUS',
          normalized_query: 'Paris',
          candidates: [
            {
              label: 'Paris, Ile-de-France, France',
              canonical_name: 'Paris',
              latitude: 48.85341,
              longitude: 2.3488,
              country_code: 'FR',
              country: 'France',
              admin1: 'Ile-de-France',
              timezone: 'Europe/Paris',
            },
            {
              label: 'Paris, Texas, United States',
              canonical_name: 'Paris',
              latitude: 33.66094,
              longitude: -95.55551,
              country_code: 'US',
              country: 'United States',
              admin1: 'Texas',
              timezone: 'America/Chicago',
            },
          ],
        }) as never,
      )
      .mockResolvedValueOnce({
        plan: makePlan({
          trip_id: 'trip_ambiguous',
          destination: 'Paris, Ile-de-France, France',
          destination_place: {
            label: 'Paris, Ile-de-France, France',
            canonical_name: 'Paris',
            latitude: 48.85341,
            longitude: 2.3488,
            country_code: 'FR',
            country: 'France',
            admin1: 'Ile-de-France',
            timezone: 'Europe/Paris',
            resolution_source: 'user_selected',
          },
        }),
        summary: {
          active_trip_id: 'trip_ambiguous',
          home_region: 'San Francisco',
          counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
        },
      });

    render(<PlanDetails />);
    await screen.findByText('Paris');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Confirm destination')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Paris, Ile-de-France, France/i }));

    await waitFor(() => {
      expect(updateTravelPlan).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(updateTravelPlan).mock.calls[1]?.[2]).toEqual(
      expect.objectContaining({
        destination: 'Paris',
        destination_place: expect.objectContaining({
          canonical_name: 'Paris',
          resolution_source: 'user_selected',
          timezone: 'Europe/Paris',
        }),
      }),
    );
    await screen.findByText('Paris, Ile-de-France, France');
  });
});
  it('blocks open in chat until departure is added', async () => {
    routeState = {
      plan: makePlan({
        trip_id: 'trip_missing_departure',
        destination: 'London',
        departure_region: '',
      }),
    };
    routeParams = { tripId: 'trip_missing_departure' };

    render(<PlanDetails />);
    await screen.findByText('London');

    fireEvent.click(screen.getByRole('button', { name: 'Open in chat' }));

    expect(outletContext.startChat).not.toHaveBeenCalled();
    expect(screen.getAllByText('Needs departure')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Add the departure location first before starting this travel analysis.')[0]).toBeInTheDocument();
  });
