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

  it('propagates archive endpoint errors (no PATCH fallback)', async () => {
    vi.mocked(bffJson).mockRejectedValueOnce(new PivotaAgentBffError('bad request', 400, { code: 'BAD_REQUEST' }) as never);

    await expect(archiveTravelPlan('EN', 'trip_1')).rejects.toMatchObject({
      name: 'PivotaAgentBffError',
      status: 400,
    });
    expect(bffJson).toHaveBeenCalledTimes(1);
  });
});
