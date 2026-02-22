export class TimeoutError extends Error {
  readonly code = 'timeout';
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

const isAbortError = (err: unknown): boolean =>
  Boolean(err) && typeof err === 'object' && String((err as any).name || '').toLowerCase() === 'aborterror';

export async function requestWithTimeout(
  input: RequestInfo,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs: timeoutRaw, signal: externalSignal, ...fetchInit } = init;
  const timeoutMs = Number.isFinite(Number(timeoutRaw)) ? Math.max(1, Math.trunc(Number(timeoutRaw))) : DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  let didTimeout = false;
  let timeoutHandle: number | undefined;
  const onExternalAbort = () => {
    if (controller.signal.aborted) return;
    controller.abort((externalSignal as any)?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) onExternalAbort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  timeoutHandle = window.setTimeout(() => {
    didTimeout = true;
    if (!controller.signal.aborted) controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...fetchInit,
      signal: controller.signal,
    });
  } catch (err) {
    if (didTimeout && (isAbortError(err) || controller.signal.aborted)) {
      throw new TimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    if (typeof timeoutHandle === 'number') window.clearTimeout(timeoutHandle);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}
