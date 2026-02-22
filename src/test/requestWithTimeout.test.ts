import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeoutError, requestWithTimeout } from '@/utils/requestWithTimeout';

describe('requestWithTimeout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('times out, aborts request, and throws TimeoutError', async () => {
    vi.useFakeTimers();

    const abortListener = vi.fn();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener(
          'abort',
          () => {
            abortListener();
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          },
          { once: true },
        );
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const pending = requestWithTimeout('/slow-endpoint', { method: 'GET', timeoutMs: 100 });
    const assertTimeout = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(120);

    await assertTimeout;
    expect(abortListener).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns response when request completes before timeout', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const res = await requestWithTimeout('/fast-endpoint', { method: 'GET', timeoutMs: 1000 });

    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('honors external abort signal without converting it into TimeoutError', async () => {
    const external = new AbortController();

    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener(
            'abort',
            () => {
              reject(Object.assign(new Error('Aborted by caller'), { name: 'AbortError' }));
            },
            { once: true },
          );
        });
      }),
    );

    const pending = requestWithTimeout('/abort-endpoint', {
      method: 'GET',
      timeoutMs: 1000,
      signal: external.signal,
    });

    external.abort();

    await expect(pending).rejects.not.toBeInstanceOf(TimeoutError);
  });
});
