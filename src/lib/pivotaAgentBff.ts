import { getOrCreateAuroraUid } from './persistence';
import { requestWithTimeout } from '@/utils/requestWithTimeout';

export type Language = 'EN' | 'CN';

export type AssistantMessage = {
  role: 'assistant';
  content: string;
  format?: 'text' | 'markdown';
};

export type SuggestedChip = {
  chip_id: string;
  label: string;
  kind?: string;
  data?: Record<string, unknown>;
};

export type Card = {
  card_id: string;
  type: string;
  title?: string;
  payload: Record<string, unknown>;
  field_missing?: Array<Record<string, unknown>>;
};

export type V1Envelope = {
  request_id: string;
  trace_id: string;
  assistant_message: AssistantMessage | null;
  suggested_chips: SuggestedChip[];
  cards: Card[];
  session_patch: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
};

export type V1Action =
  | string
  | {
      action_id: string;
      kind?: 'chip' | 'action';
      data?: Record<string, unknown>;
    };

export type BffHeaders = {
  aurora_uid?: string;
  trace_id: string;
  brief_id: string;
  lang: Language;
  auth_token?: string | null;
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, '');

export const getPivotaAgentBaseUrl = () => {
  const explicit = import.meta.env.VITE_PIVOTA_AGENT_URL?.trim();
  if (explicit) return normalizeBaseUrl(explicit);

  // Back-compat: many deployments already configure this to the pivota-agent host.
  const shopGatewayUrl = import.meta.env.VITE_SHOP_GATEWAY_URL?.trim();
  if (shopGatewayUrl) return normalizeBaseUrl(shopGatewayUrl);

  // Sensible default for local dev / quick start.
  return 'https://pivota-agent-production.up.railway.app';
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

export class PivotaAgentBffError extends Error {
  readonly status: number;
  readonly responseBody: unknown;

  constructor(message: string, status: number, responseBody: unknown) {
    super(message);
    this.name = 'PivotaAgentBffError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

export const makeDefaultHeaders = (lang: Language): BffHeaders => {
  const aurora_uid = getOrCreateAuroraUid();

  const cryptoObj = globalThis.crypto as Crypto | undefined;
  const id = (prefix: string) =>
    (cryptoObj?.randomUUID?.() ?? `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`).slice(0, 64);

  return {
    aurora_uid,
    trace_id: id('trace'),
    brief_id: id('brief'),
    lang,
  };
};

export const bffJson = async <TResponse>(
  path: string,
  headers: BffHeaders,
  init: RequestInit & { baseUrl?: string; timeoutMs?: number } = {}
): Promise<TResponse> => {
  const baseUrl = init.baseUrl ?? getPivotaAgentBaseUrl();
  const timeoutMs = Number.isFinite(Number(init.timeoutMs)) ? Number(init.timeoutMs) : undefined;
  const isFormData =
    typeof FormData !== 'undefined' &&
    init.body != null &&
    typeof init.body === 'object' &&
    init.body instanceof FormData;

  const requestInit: RequestInit = {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'X-Aurora-Uid': headers.aurora_uid ?? '',
      'X-Trace-ID': headers.trace_id,
      'X-Brief-ID': headers.brief_id,
      'X-Lang': headers.lang,
      'X-Aurora-Lang': headers.lang === 'CN' ? 'cn' : 'en',
      ...(headers.auth_token ? { Authorization: `Bearer ${headers.auth_token}` } : {}),
      ...(init.headers || {}),
    },
  };

  delete (requestInit as any).baseUrl;
  delete (requestInit as any).timeoutMs;

  const requestUrl = joinUrl(baseUrl, path);
  const res =
    typeof timeoutMs === 'number'
      ? await requestWithTimeout(requestUrl, { ...requestInit, timeoutMs })
      : await fetch(requestUrl, requestInit);

  const body = await safeReadJson(res);
  if (!res.ok) {
    throw new PivotaAgentBffError(`Request failed: ${res.status} ${res.statusText}`, res.status, body);
  }

  return body as TResponse;
};

export type RecoEmployeeFeedbackType = 'relevant' | 'not_relevant' | 'wrong_block';
export type RecoBlockType = 'competitors' | 'dupes' | 'related_products';

export type RecoEmployeeFeedbackRequest = {
  anchor_product_id: string;
  block: RecoBlockType;
  candidate_product_id?: string;
  candidate_name?: string;
  feedback_type: RecoEmployeeFeedbackType;
  wrong_block_target?: RecoBlockType;
  reason_tags?: string[];
  rank_position?: number;
  pipeline_version?: string;
  models?: string | Record<string, unknown>;
  suggestion_id?: string;
  llm_suggested_label?: RecoEmployeeFeedbackType;
  llm_confidence?: number;
  request_id?: string;
  session_id?: string;
  timestamp?: number;
};

export const sendRecoEmployeeFeedback = async (
  headers: BffHeaders,
  body: RecoEmployeeFeedbackRequest,
): Promise<{ ok: boolean; event?: Record<string, unknown> }> => {
  return bffJson('/v1/reco/employee-feedback', headers, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};
