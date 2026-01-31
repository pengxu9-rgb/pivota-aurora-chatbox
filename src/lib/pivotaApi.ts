import type { Session } from './types';
import { getAuroraUid } from './persistence';

export class PivotaApiError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(message: string, status: number, responseBody: unknown) {
    super(message);
    this.name = 'PivotaApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

export const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!baseUrl) return undefined;

  const normalized = normalizeBaseUrl(baseUrl);

  // Most Glow Agent endpoints live under `/v1`. To reduce misconfiguration
  // (especially on Vercel), auto-append `/v1` when callers provide only the host.
  if (/\/v1$/i.test(normalized) || /\/v1\//i.test(normalized)) return normalized;
  return `${normalized}/v1`;
};

export const isBackendConfigured = () => Boolean(getApiBaseUrl());

export const getUploadBaseUrl = () => {
  const uploadUrl = import.meta.env.VITE_UPLOAD_ENDPOINT?.trim();
  if (uploadUrl) return normalizeBaseUrl(uploadUrl);
  return getApiBaseUrl();
};

const joinUrl = (baseUrl: string, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
};

const safeReadJson = async (res: Response) => {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return undefined;
  try {
    return await res.json();
  } catch {
    return undefined;
  }
};

const getAuroraUidHeader = () => {
  const uid = getAuroraUid();
  return uid ? { 'X-Aurora-UID': uid } : {};
};

export const pivotaJson = async <TResponse>(
  session: Pick<Session, 'brief_id' | 'trace_id'>,
  path: string,
  init: RequestInit & { baseUrl?: string } = {}
): Promise<TResponse> => {
  const baseUrl = init.baseUrl ?? getApiBaseUrl();
  if (!baseUrl) {
    throw new PivotaApiError('Missing VITE_API_BASE_URL', 0, undefined);
  }

  const res = await fetch(joinUrl(baseUrl, path), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Brief-ID': session.brief_id,
      'X-Trace-ID': session.trace_id,
      ...getAuroraUidHeader(),
      ...(init.headers || {}),
    },
  });

  const body = await safeReadJson(res);
  if (!res.ok) {
    throw new PivotaApiError(`Request failed: ${res.status} ${res.statusText}`, res.status, body);
  }

  return body as TResponse;
};

export const pivotaUpload = async <TResponse>(
  session: Pick<Session, 'brief_id' | 'trace_id'>,
  path: string,
  form: FormData,
  init: RequestInit & { baseUrl?: string } = {}
): Promise<TResponse> => {
  const baseUrl = init.baseUrl ?? getUploadBaseUrl();
  if (!baseUrl) {
    throw new PivotaApiError('Missing VITE_UPLOAD_ENDPOINT or VITE_API_BASE_URL', 0, undefined);
  }

  const res = await fetch(joinUrl(baseUrl, path), {
    ...init,
    method: init.method ?? 'POST',
    body: form,
    headers: {
      Accept: 'application/json',
      'X-Brief-ID': session.brief_id,
      'X-Trace-ID': session.trace_id,
      ...getAuroraUidHeader(),
      ...(init.headers || {}),
    },
  });

  const body = await safeReadJson(res);
  if (!res.ok) {
    throw new PivotaApiError(`Upload failed: ${res.status} ${res.statusText}`, res.status, body);
  }

  return body as TResponse;
};
