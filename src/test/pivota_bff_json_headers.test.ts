import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bffJson, type BffHeaders } from '@/lib/pivotaAgentBff';

const makeHeaders = (): BffHeaders => ({
  aurora_uid: 'uid_test',
  trace_id: 'trace_test',
  brief_id: 'brief_test',
  lang: 'EN',
});

describe('bffJson header behavior', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('does not send content-type when request has no body', async () => {
    await bffJson('/v1/travel-plans/trip_1/archive', makeHeaders(), { method: 'POST' });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestHeaders = (init.headers || {}) as Record<string, string>;

    expect(requestHeaders['Content-Type']).toBeUndefined();
  });

  it('sends content-type when request has json body', async () => {
    await bffJson('/v1/travel-plans', makeHeaders(), {
      method: 'POST',
      body: JSON.stringify({ destination: 'Tokyo' }),
    });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestHeaders = (init.headers || {}) as Record<string, string>;

    expect(requestHeaders['Content-Type']).toBe('application/json');
  });
});
