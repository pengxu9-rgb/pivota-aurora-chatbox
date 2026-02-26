import type { Session } from './types';
import { getAuroraUid, getLangPref } from './persistence';

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

export const getApiRootUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!baseUrl) return undefined;
  return normalizeBaseUrl(baseUrl);
};

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

export const getShopGatewayUrl = () => {
  const url = import.meta.env.VITE_SHOP_GATEWAY_URL?.trim();
  if (url) return normalizeBaseUrl(url);
  return getApiRootUrl();
};

export const getUploadBaseUrl = () => {
  const uploadUrl = import.meta.env.VITE_UPLOAD_ENDPOINT?.trim();
  if (uploadUrl) return normalizeBaseUrl(uploadUrl);
  return getApiBaseUrl();
};

const getOrigin = (rawUrl?: string) => {
  if (!rawUrl) return null;
  try {
    const resolved = new URL(rawUrl, window.location.href);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.origin;
  } catch {
    return null;
  }
};

const ensureLinkHint = (rel: 'dns-prefetch' | 'preconnect', href: string, withCors = false) => {
  if (typeof document === 'undefined') return;
  const selector = `link[rel="${rel}"][href="${href}"]`;
  if (document.head.querySelector(selector)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (withCors) link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
};

export const ensureApiPreconnectHints = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const currentOrigin = window.location.origin;
  const origins = new Set<string>();
  const candidates = [getApiRootUrl(), getApiBaseUrl(), getUploadBaseUrl(), getShopGatewayUrl()];
  for (const candidate of candidates) {
    const origin = getOrigin(candidate || undefined);
    if (!origin || origin === currentOrigin) continue;
    origins.add(origin);
  }

  for (const origin of origins) {
    ensureLinkHint('dns-prefetch', origin);
    ensureLinkHint('preconnect', origin, true);
  }
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

const cloneFormData = (form: FormData) => {
  const next = new FormData();
  for (const [key, value] of form.entries()) {
    if (value instanceof File) next.append(key, value, value.name);
    else next.append(key, value);
  }
  return next;
};

const getAuroraUidHeader = () => {
  const uid = getAuroraUid();
  return uid ? { 'X-Aurora-Uid': uid } : {};
};

const getAuroraLangHeader = () => {
  return { 'X-Aurora-Lang': getLangPref() };
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
      ...getAuroraLangHeader(),
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
  const uploadBaseUrl = init.baseUrl ?? getUploadBaseUrl();
  if (!uploadBaseUrl) {
    throw new PivotaApiError('Missing VITE_UPLOAD_ENDPOINT or VITE_API_BASE_URL', 0, undefined);
  }

  const apiBaseUrl = getApiBaseUrl();
  const configuredUploadUrl = import.meta.env.VITE_UPLOAD_ENDPOINT?.trim();

  const candidates: string[] = [uploadBaseUrl];
  if (!init.baseUrl && configuredUploadUrl && apiBaseUrl) {
    const normalizedConfigured = normalizeBaseUrl(configuredUploadUrl);
    const normalizedApi = normalizeBaseUrl(apiBaseUrl);
    if (normalizedConfigured !== normalizedApi && !candidates.includes(apiBaseUrl)) {
      candidates.push(apiBaseUrl);
    }
  }

  let lastError: { status: number; statusText: string; body: unknown; baseUrl: string } | null = null;

  for (const baseUrl of candidates) {
    try {
      const res = await fetch(joinUrl(baseUrl, path), {
        ...init,
        method: init.method ?? 'POST',
        body: candidates.length > 1 && baseUrl !== candidates[0] ? cloneFormData(form) : form,
        headers: {
          Accept: 'application/json',
          'X-Brief-ID': session.brief_id,
          'X-Trace-ID': session.trace_id,
          ...getAuroraUidHeader(),
          ...getAuroraLangHeader(),
          ...(init.headers || {}),
        },
      });

      const body = await safeReadJson(res);
      if (res.ok) return body as TResponse;

      lastError = { status: res.status, statusText: res.statusText, body, baseUrl };

      // If the upload endpoint is misconfigured (common on Vercel) we fall back to the API base url.
      // Only retry on "not found / method not allowed" or when we have an explicit second candidate.
      if ((res.status === 404 || res.status === 405) && baseUrl !== candidates[candidates.length - 1]) {
        continue;
      }
      throw new PivotaApiError(`Upload failed: ${res.status} ${res.statusText}`, res.status, body);
    } catch (err) {
      // Network error or CORS failure — retry once against API base if available.
      if (baseUrl !== candidates[candidates.length - 1]) continue;
      throw err;
    }
  }

  if (lastError) {
    throw new PivotaApiError(
      `Upload failed: ${lastError.status} ${lastError.statusText}`,
      lastError.status,
      lastError.body
    );
  }

  throw new PivotaApiError('Upload failed: unknown error', 0, undefined);
};
