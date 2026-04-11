import { getOrCreateAuroraUid } from './persistence';
import type { ChatIntroHintV1 } from './chatCardsTypes';
import { requestWithTimeout } from '@/utils/requestWithTimeout';
import { syncAuroraAuthSessionFromResponse } from './auth';

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

export type AnalysisMeta = {
  detector_source: string;
  llm_vision_called: boolean;
  llm_report_called: boolean;
  artifact_usable: boolean;
  degrade_reason?: string | null;
};

export type RecommendationMeta = {
  source_mode:
    | 'llm_primary'
    | 'llm_catalog_hybrid'
    | 'catalog_grounded'
    | 'framework_mainline'
    | 'step_aware_mainline'
    | 'catalog_transient_fallback'
    | 'bridge_error'
    | 'artifact_matcher'
    | 'upstream_fallback'
    | 'travel_handoff'
    | 'rules_only';
  used_recent_logs: boolean;
  used_itinerary: boolean;
  used_safety_flags: boolean;
  trigger_source?: string | null;
  recompute_from_profile_update?: boolean;
  llm_trace?: {
    template_id?: string;
    prompt_hash?: string;
    prompt_chars?: number;
    token_est?: number;
    latency_ms?: number | null;
    cache_hit?: boolean;
    provider?: string | null;
    model?: string | null;
    [k: string]: unknown;
  } | null;
  env_source?: string | null;
  epi?: number | null;
  active_trip_id?: string | null;
};

export type RecoRefreshHint = {
  should_refresh: boolean;
  reason: string;
  effective_window_days: number;
};

export type V1Envelope = {
  request_id: string;
  trace_id: string;
  assistant_message: AssistantMessage | null;
  suggested_chips: SuggestedChip[];
  cards: Card[];
  session_patch: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
  analysis_meta?: AnalysisMeta;
  recommendation_meta?: RecommendationMeta;
  reco_refresh_hint?: RecoRefreshHint;
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
  const hasBody = init.body != null;
  const isFormData =
    typeof FormData !== 'undefined' &&
    hasBody &&
    typeof init.body === 'object' &&
    init.body instanceof FormData;

  const requestInit: RequestInit = {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
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
  syncAuroraAuthSessionFromResponse(body, { fallbackToken: headers.auth_token ?? null });
  if (!res.ok) {
    throw new PivotaAgentBffError(`Request failed: ${res.status} ${res.statusText}`, res.status, body);
  }

  if (res.status !== 204 && body === undefined) {
    throw new Error('Service returned an incomplete response. Please try again.');
  }

  return body as TResponse;
};

// ─── SSE streaming for /v1/chat/stream ─────────────────────────────────────

export type SSEThinkingEvent = { step: string; message: string };
export type SSEChunkEvent = { text: string };
export type SSEResultEvent = {
  cards: Array<Record<string, unknown>>;
  ops: Record<string, unknown>;
  next_actions: Array<Record<string, unknown>>;
  thinking_steps: SSEThinkingEvent[];
  intro_hint?: ChatIntroHintV1;
  meta: {
    skill_id?: string;
    task_mode?: string;
    elapsed_ms?: number;
    quality_ok?: boolean;
  };
};

export type BffStreamCallbacks = {
  onThinking: (event: SSEThinkingEvent) => void;
  onChunk: (event: SSEChunkEvent) => void;
  onResult: (event: SSEResultEvent) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

/**
 * SSE streaming client for /v1/chat/stream.
 * Consumes server-sent events and dispatches to typed callbacks.
 */
export const bffChatStream = async (
  headers: BffHeaders,
  body: Record<string, unknown>,
  callbacks: BffStreamCallbacks,
  options: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<void> => {
  const baseUrl = options.baseUrl ?? getPivotaAgentBaseUrl();
  const requestUrl = joinUrl(baseUrl, '/v1/chat/stream');

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sawResult = false;
  const timeoutMs = options.timeoutMs ?? 90_000;
  if (timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-Aurora-Uid': headers.aurora_uid ?? '',
        'X-Trace-ID': headers.trace_id,
        'X-Brief-ID': headers.brief_id,
        'X-Lang': headers.lang,
        'X-Aurora-Lang': headers.lang === 'CN' ? 'cn' : 'en',
        ...(headers.auth_token ? { Authorization: `Bearer ${headers.auth_token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new PivotaAgentBffError(`Stream request failed: ${res.status}`, res.status, errBody);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Stream response body was empty.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const drainBuffer = (flush = false) => {
      while (true) {
        const boundary = buffer.match(/\r?\n\r?\n/);
        if (!boundary || boundary.index == null) break;
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        dispatchFrame(frame);
      }

      if (!flush) return;

      const trailing = buffer.trim();
      buffer = '';
      if (trailing) {
        dispatchFrame(trailing, true);
      }
    };

    const dispatchFrame = (frame: string, isTerminalFrame = false) => {
      const lines = frame.split(/\r?\n/);
      let eventType = '';
      const dataLines: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line || line.startsWith(':')) continue;

        const separatorIdx = line.indexOf(':');
        const field = separatorIdx === -1 ? line : line.slice(0, separatorIdx);
        const rawValue = separatorIdx === -1 ? '' : line.slice(separatorIdx + 1);
        const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

        if (field === 'event') {
          eventType = value.trim();
        } else if (field === 'data') {
          dataLines.push(value);
        }
      }

      if (!eventType) {
        if (isTerminalFrame) {
          throw new Error('Stream closed with an incomplete terminal frame.');
        }
        return;
      }

      if (eventType === 'done') {
        callbacks.onDone?.();
        return;
      }

      const rawPayload = dataLines.join('\n').trim();
      if (!rawPayload) {
        if (eventType === 'thinking' || eventType === 'chunk') return;
        throw new Error(`Stream ${eventType} event was missing data.`);
      }

      let data: unknown;
      try {
        data = JSON.parse(rawPayload);
      } catch {
        if (eventType === 'thinking' || eventType === 'chunk') return;
        throw new Error(`Stream ${eventType} event contained malformed JSON.`);
      }

      switch (eventType) {
        case 'thinking':
          callbacks.onThinking(data as SSEThinkingEvent);
          break;
        case 'chunk':
          callbacks.onChunk(data as SSEChunkEvent);
          break;
        case 'result':
          sawResult = true;
          syncAuroraAuthSessionFromResponse(data, { fallbackToken: headers.auth_token ?? null });
          callbacks.onResult(data as SSEResultEvent);
          break;
        case 'error': {
          const message =
            data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
              ? (data as { message: string }).message.trim() || 'Unknown error'
              : 'Unknown error';
          callbacks.onError?.(message);
          throw new Error(message);
        }
        default:
          break;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        drainBuffer(true);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      drainBuffer();
    }

    if (!sawResult) {
      throw new Error('Stream completed without a result event.');
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
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

export type RecoAlternativesRequest = {
  product_input?: string;
  product?: Record<string, unknown>;
  anchor_product_id?: string;
  max_total?: number;
  recommendation_mode?: 'pool_only' | 'hybrid_fallback' | 'open_world_only';
  disable_synthetic_local_fallback?: boolean;
  include_debug?: boolean;
};

export type RecoAlternativesResponse = {
  request_id: string;
  trace_id: string;
  ok: boolean;
  alternatives: Array<Record<string, unknown>>;
  field_missing?: Array<Record<string, unknown>>;
  llm_trace?: Record<string, unknown> | null;
  debug?: Record<string, unknown>;
};

export const fetchRecoAlternatives = async (
  headers: BffHeaders,
  body: RecoAlternativesRequest,
  options: { timeoutMs?: number } = {},
): Promise<RecoAlternativesResponse> => {
  return bffJson('/v1/reco/alternatives', headers, {
    method: 'POST',
    body: JSON.stringify(body),
    ...(Number.isFinite(Number(options.timeoutMs)) ? { timeoutMs: Number(options.timeoutMs) } : {}),
  });
};

export type RoutineSimulateRequest = {
  routine?: {
    am?: Array<Record<string, unknown>>;
    pm?:
      | Array<Record<string, unknown>>
      | 'same_as_am'
      | {
          pm_same_as_am?: boolean;
          pmSameAsAm?: boolean;
          same_as_am?: boolean;
          sameAsAm?: boolean;
        };
  };
  test_product?: Record<string, unknown>;
};

export const fetchRoutineSimulation = async (
  headers: BffHeaders,
  body: RoutineSimulateRequest,
  options: { timeoutMs?: number } = {},
): Promise<V1Envelope> => {
  return bffJson('/v1/routine/simulate', headers, {
    method: 'POST',
    body: JSON.stringify(body),
    ...(Number.isFinite(Number(options.timeoutMs)) ? { timeoutMs: Number(options.timeoutMs) } : {}),
  });
};
