import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/pivotaAgentBff', () => {
  class MockPivotaAgentBffError extends Error {
    status: number;
    responseBody: unknown;

    constructor(message: string, status: number, responseBody: unknown) {
      super(message);
      this.name = 'PivotaAgentBffError';
      this.status = status;
      this.responseBody = responseBody;
    }
  }

  return {
    bffJson: vi.fn(),
    makeDefaultHeaders: vi.fn(() => ({
      aurora_uid: 'uid_test',
      trace_id: 'trace_test',
      brief_id: 'brief_test',
      lang: 'EN',
    })),
    PivotaAgentBffError: MockPivotaAgentBffError,
  };
});

import { PivotaAgentBffError, bffJson } from '@/lib/pivotaAgentBff';
import { archiveTravelPlan, createTravelPlan, getDestinationAmbiguityPayload } from '@/lib/travelPlansApi';

const summaryPayload = {
  active_trip_id: null,
  counts: { in_trip: 0, upcoming: 0, completed: 0, archived: 1 },
};

describe('travelPlansApi behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends create payload with departure_region', async () => {
    vi.mocked(bffJson).mockResolvedValueOnce({ plan: null, summary: summaryPayload });

    await createTravelPlan('EN', {
      destination: 'Tokyo',
      departure_region: 'San Francisco',
      start_date: '2099-03-01',
      end_date: '2099-03-05',
    });

    expect(bffJson).toHaveBeenCalledWith(
      '/v1/travel-plans',
      expect.objectContaining({ lang: 'EN' }),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          destination: 'Tokyo',
          departure_region: 'San Francisco',
          start_date: '2099-03-01',
          end_date: '2099-03-05',
        }),
      }),
    );
  });

  it('sends POST archive request', async () => {
    vi.mocked(bffJson).mockResolvedValueOnce({ plan: null, summary: summaryPayload });

    await archiveTravelPlan('EN', 'trip_1');

    expect(bffJson).toHaveBeenCalledTimes(1);
    expect(bffJson).toHaveBeenCalledWith(
      '/v1/travel-plans/trip_1/archive',
      expect.objectContaining({
        aurora_uid: 'uid_test',
        trace_id: 'trace_test',
        brief_id: 'brief_test',
        lang: 'EN',
      }),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('parses destination ambiguity payloads', () => {
    const err = new PivotaAgentBffError('conflict', 409, {
      error: 'DESTINATION_AMBIGUOUS',
      field: 'destination',
      normalized_query: 'Paris',
      candidates: [
        {
          label: 'Paris, Ile-de-France, France',
          canonical_name: 'Paris',
          latitude: 48.85341,
          longitude: 2.3488,
          timezone: 'Europe/Paris',
        },
      ],
    });

    expect(getDestinationAmbiguityPayload(err)).toEqual({
      error: 'DESTINATION_AMBIGUOUS',
      field: 'destination',
      normalized_query: 'Paris',
      candidates: [
        expect.objectContaining({
          canonical_name: 'Paris',
          timezone: 'Europe/Paris',
        }),
      ],
    });
  });

  it('returns null for non-ambiguity errors', () => {
    const err = new PivotaAgentBffError('bad request', 400, { error: 'BAD_REQUEST' });
    expect(getDestinationAmbiguityPayload(err)).toBeNull();
  });
});
