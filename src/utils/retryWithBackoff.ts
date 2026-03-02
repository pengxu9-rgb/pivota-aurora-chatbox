import { TimeoutError } from './requestWithTimeout';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;

  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 429 || status === 503 || status === 502) return true;

    if ('responseBody' in error) {
      const body = (error as { responseBody: unknown }).responseBody as Record<string, unknown> | undefined;
      const errorCode = String(body?.error_code ?? body?.research_error_code ?? '').toLowerCase();
      if (
        errorCode.includes('rate_limited') ||
        errorCode.includes('timeout') ||
        errorCode.includes('circuit_open')
      ) {
        return true;
      }
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('abort')) return true;
  }

  return false;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelayMs = 800,
    maxDelayMs = 5000,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: unknown;
  const maxAttempts = 1 + Math.max(0, maxRetries);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const canRetry = attempt < maxAttempts - 1 && shouldRetry(err, attempt);
      if (!canRetry) throw err;

      const delayMs = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * Math.min(delayMs * 0.3, 300));
      await new Promise((r) => setTimeout(r, delayMs + jitter));
    }
  }

  throw lastError;
}
