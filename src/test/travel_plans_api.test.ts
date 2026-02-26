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
import { archiveTravelPlan } from '@/lib/travelPlansApi';

const summaryPayload = {
  active_trip_id: null,
  counts: { in_trip: 0, upcoming: 0, completed: 0, archived: 1 },
};

describe('travelPlansApi archive behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends POST archive with empty json body', async () => {
    vi.mocked(bffJson).mockResolvedValueOnce({ plan: null, summary: summaryPayload });

    await archiveTravelPlan('EN', 'trip_1');

    expect(bffJson).toHaveBeenCalledTimes(1);
    expect(bffJson).toHaveBeenCalledWith(
      '/v1/travel-plans/trip_1/archive',
      expect.any(Object),
      expect.objectContaining({
        method: 'POST',
        body: '{}',
      }),
    );
  });

  it('falls back to PATCH is_archived when archive endpoint returns 400', async () => {
    vi.mocked(bffJson)
      .mockRejectedValueOnce(new PivotaAgentBffError('bad request', 400, { code: 'BAD_REQUEST' }) as never)
      .mockResolvedValueOnce({
        plan: {
          trip_id: 'trip_1',
          destination: 'Tokyo',
          start_date: '2099-03-01',
          end_date: '2099-03-05',
          created_at_ms: 1,
          updated_at_ms: 2,
          status: 'archived',
          prep_checklist: [],
          is_archived: true,
        },
        summary: summaryPayload,
      });

    const response = await archiveTravelPlan('EN', 'trip_1');

    expect(bffJson).toHaveBeenCalledTimes(2);
    expect(bffJson).toHaveBeenNthCalledWith(
      1,
      '/v1/travel-plans/trip_1/archive',
      expect.any(Object),
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
    expect(bffJson).toHaveBeenNthCalledWith(
      2,
      '/v1/travel-plans/trip_1',
      expect.any(Object),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_archived: true }),
      }),
    );
    expect(response.plan?.is_archived).toBe(true);
  });
});
