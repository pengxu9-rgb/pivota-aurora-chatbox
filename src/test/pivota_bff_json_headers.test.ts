import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bffJson, makeDefaultHeaders, type BffHeaders } from '@/lib/pivotaAgentBff';

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

  it('throws when a 200 response returns invalid json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"ok":', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(bffJson('/v1/analysis/skin', makeHeaders(), { method: 'POST' })).rejects.toThrow(
      'Service returned an incomplete response. Please try again.',
    );
  });

  it('maps non-Chinese UI locales to EN backend headers', async () => {
    await bffJson('/v1/analysis/skin', makeDefaultHeaders('FR'), { method: 'POST' });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const requestHeaders = (init.headers || {}) as Record<string, string>;

    expect(requestHeaders['X-Lang']).toBe('EN');
    expect(requestHeaders['X-Aurora-Lang']).toBe('en');
  });
});
