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

vi.mock('@/lib/travelPlansApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/travelPlansApi')>('@/lib/travelPlansApi');
  return {
    ...actual,
    listTravelPlans: vi.fn(),
    createTravelPlan: vi.fn(),
    updateTravelPlan: vi.fn(),
    archiveTravelPlan: vi.fn(),
  };
});

import Plans from '@/pages/Plans';
import { toast } from '@/components/ui/use-toast';
import { PivotaAgentBffError } from '@/lib/pivotaAgentBff';
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
      plan: makePlan({
        trip_id: 'trip_new',
        destination_place: {
          label: 'Tokyo, Tokyo, Japan',
          canonical_name: 'Tokyo',
          latitude: 35.6895,
          longitude: 139.69171,
          country_code: 'JP',
          country: 'Japan',
          admin1: 'Tokyo',
          timezone: 'Asia/Tokyo',
          resolution_source: 'auto_resolved',
        },
      }),
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

    const startDateInput = screen.getByLabelText('Start date');
    const endDateInput = screen.getByLabelText('End date');
    const createDateGrid = startDateInput.closest('.travel-date-grid');
    expect(createDateGrid).toBeTruthy();
    expect(endDateInput.closest('.travel-date-grid')).toBe(createDateGrid);
    expect(startDateInput.className).toContain('travel-date-input');
    expect(endDateInput.className).toContain('travel-date-input');

    fireEvent.change(screen.getByPlaceholderText('e.g. Tokyo / Paris'), {
      target: { value: 'Tokyo' },
    });
    fireEvent.change(startDateInput, { target: { value: '2099-03-01' } });
    fireEvent.change(endDateInput, { target: { value: '2099-03-05' } });

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
        session_patch: expect.objectContaining({
          profile: expect.objectContaining({
            travel_plan: expect.objectContaining({
              destination: 'Tokyo',
              destination_place: expect.objectContaining({
                canonical_name: 'Tokyo',
                timezone: 'Asia/Tokyo',
              }),
            }),
          }),
        }),
      }),
    );
    expect(toast).toHaveBeenCalled();
  });

  it('uses responsive travel date classes in inline edit form', async () => {
    vi.mocked(listTravelPlans).mockResolvedValueOnce({
      plans: [
        makePlan({
          trip_id: 'trip_edit_layout',
          destination: 'Kyoto',
          start_date: '2099-04-11',
          end_date: '2099-04-16',
        }),
      ],
      summary: {
        active_trip_id: 'trip_edit_layout',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });

    render(<Plans />);
    await screen.findByText('Kyoto');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const editStartDateInput = screen.getByDisplayValue('2099-04-11');
    const editEndDateInput = screen.getByDisplayValue('2099-04-16');
    const editDateGrid = editStartDateInput.closest('.travel-date-grid');

    expect(editDateGrid).toBeTruthy();
    expect(editEndDateInput.closest('.travel-date-grid')).toBe(editDateGrid);
    expect(editStartDateInput.className).toContain('travel-date-input');
    expect(editEndDateInput.className).toContain('travel-date-input');
  });

  it('starts chat only when Open in chat is clicked', async () => {
    vi.mocked(listTravelPlans).mockResolvedValueOnce({
      plans: [
        makePlan({
          trip_id: 'trip_chat',
          destination_place: {
            label: 'Tokyo, Tokyo, Japan',
            canonical_name: 'Tokyo',
            latitude: 35.6895,
            longitude: 139.69171,
            country_code: 'JP',
            country: 'Japan',
            admin1: 'Tokyo',
            timezone: 'Asia/Tokyo',
            resolution_source: 'auto_resolved',
          },
        }),
      ],
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
        session_patch: expect.objectContaining({
          profile: expect.objectContaining({
            travel_plan: expect.objectContaining({
              trip_id: 'trip_chat',
              destination_place: expect.objectContaining({
                canonical_name: 'Tokyo',
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('retries create after destination ambiguity selection', async () => {
    vi.mocked(createTravelPlan)
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
          trip_id: 'trip_paris',
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
          active_trip_id: 'trip_paris',
          counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
        },
      });

    render(<Plans />);
    await screen.findByText('Create new plan');

    fireEvent.change(screen.getByPlaceholderText('e.g. Tokyo / Paris'), {
      target: { value: 'Paris' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2099-06-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2099-06-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(await screen.findByText('Confirm destination')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Paris, Ile-de-France, France/i }));

    await waitFor(() => {
      expect(createTravelPlan).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(createTravelPlan).mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        destination: 'Paris',
        destination_place: expect.objectContaining({
          canonical_name: 'Paris',
          resolution_source: 'user_selected',
          timezone: 'Europe/Paris',
        }),
      }),
    );
    await waitFor(() => {
      expect(outletContext.startChat).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the real Greenland candidate when destination input is geographically ambiguous', async () => {
    vi.mocked(createTravelPlan).mockRejectedValueOnce(
      new PivotaAgentBffError('Request failed: 409 Conflict', 409, {
        error: 'DESTINATION_AMBIGUOUS',
        normalized_query: 'Greenland',
        candidates: [
          {
            label: 'Greenland',
            canonical_name: 'Greenland',
            latitude: 71.70694,
            longitude: -42.6043,
            country_code: 'GL',
            country: 'Greenland',
            admin1: '',
            timezone: 'America/Nuuk',
          },
          {
            label: 'Greenland, Arkansas, United States',
            canonical_name: 'Greenland',
            latitude: 35.99453,
            longitude: -94.1752,
            country_code: 'US',
            country: 'United States',
            admin1: 'Arkansas',
            timezone: 'America/Chicago',
          },
        ],
      }) as never,
    );

    render(<Plans />);
    await screen.findByText('Create new plan');

    fireEvent.change(screen.getByPlaceholderText('e.g. Tokyo / Paris'), {
      target: { value: 'Greenland' },
    });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2099-07-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2099-07-05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

    expect(await screen.findByText('Confirm destination')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Greenland.*America\/Nuuk/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Greenland, Arkansas, United States/i })).toBeInTheDocument();
  });

  it('keeps plan details collapsed until user expands', async () => {
    vi.mocked(listTravelPlans).mockResolvedValueOnce({
      plans: [
        makePlan({
          trip_id: 'trip_fold',
          destination: 'Seoul',
          itinerary: 'Mostly outdoor daytime with one red-eye flight.',
          prep_checklist: ['Pack sunscreen', 'Bring barrier cream'],
        }),
      ],
      summary: {
        active_trip_id: 'trip_fold',
        counts: { in_trip: 0, upcoming: 1, completed: 0, archived: 0 },
      },
    });

    render(<Plans />);
    await screen.findByText('Seoul');

    expect(screen.queryByText('Mostly outdoor daytime with one red-eye flight.')).toBeNull();
    expect(screen.queryByText('Bring barrier cream')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(await screen.findByText('Mostly outdoor daytime with one red-eye flight.')).toBeTruthy();
    expect(screen.getByText('Bring barrier cream')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide details' }));
    await waitFor(() => {
      expect(screen.queryByText('Mostly outdoor daytime with one red-eye flight.')).toBeNull();
    });
  });
});
