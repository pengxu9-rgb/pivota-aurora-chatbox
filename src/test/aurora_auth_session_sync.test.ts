import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuroraAuthSession,
  loadAuroraAuthSession,
  loadAuroraAuthSessionForRevalidation,
  saveAuroraAuthSession,
  syncAuroraAuthSessionFromResponse,
} from '@/lib/auth';
import { bffChatStream, bffJson, type BffHeaders, PivotaAgentBffError } from '@/lib/pivotaAgentBff';
import { chatResponseV1ToEnvelope, parseChatResponseV1 } from '@/lib/chatCardsParser';

const makeHeaders = (): BffHeaders => ({
  aurora_uid: 'uid_auth_sync',
  trace_id: 'trace_auth_sync',
  brief_id: 'brief_auth_sync',
  lang: 'EN',
});

describe('Aurora auth session sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('avoids duplicate dispatches, refreshes expiry, and clears invalid auth state', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const initialExpiry = '2099-03-13T10:00:00.000Z';
    const refreshedExpiry = '2099-03-13T14:00:00.000Z';

    saveAuroraAuthSession({
      token: 'session_token',
      email: 'user@example.com',
      expires_at: initialExpiry,
    });

    dispatchSpy.mockClear();

    syncAuroraAuthSessionFromResponse(
      {
        meta: {
          auth: {
            state: 'authenticated',
            user: { email: 'user@example.com' },
            expires_at: initialExpiry,
          },
        },
      },
      { fallbackToken: 'session_token' },
    );

    expect(dispatchSpy).not.toHaveBeenCalled();

    syncAuroraAuthSessionFromResponse(
      {
        meta: {
          auth: {
            state: 'authenticated',
            user: { email: 'user@example.com' },
            expires_at: refreshedExpiry,
          },
        },
      },
      { fallbackToken: 'session_token' },
    );

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(loadAuroraAuthSession()).toEqual({
      token: 'session_token',
      email: 'user@example.com',
      expires_at: refreshedExpiry,
    });

    syncAuroraAuthSessionFromResponse({
      meta: {
        auth: {
          state: 'invalid',
          user: { email: null },
          expires_at: null,
        },
      },
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(2);
    expect(loadAuroraAuthSession()).toBeNull();
  });

  it('keeps expired local auth available for startup revalidation', () => {
    const expiredSession = {
      token: 'expired_token',
      email: 'expired@example.com',
      expires_at: '2026-03-13T01:00:00.000Z',
    };

    window.localStorage.setItem('pivota_aurora_auth_session_v1', JSON.stringify(expiredSession));

    expect(loadAuroraAuthSession()).toBeNull();
    expect(loadAuroraAuthSessionForRevalidation()).toEqual(expiredSession);
    expect(window.localStorage.getItem('pivota_aurora_auth_session_v1')).toBe(JSON.stringify(expiredSession));
  });

  it('bffJson refreshes auth state on success responses', async () => {
    const expiresAt = '2099-03-13T18:00:00.000Z';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            meta: {
              auth: {
                state: 'authenticated',
                user: { email: 'json@example.com' },
                expires_at: expiresAt,
              },
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    await bffJson('/v1/session/bootstrap', { ...makeHeaders(), auth_token: 'json_token' }, { method: 'GET' });

    expect(loadAuroraAuthSession()).toEqual({
      token: 'json_token',
      email: 'json@example.com',
      expires_at: expiresAt,
    });
  });

  it('bffJson clears auth state when error responses report invalid auth', async () => {
    saveAuroraAuthSession({
      token: 'stale_token',
      email: 'stale@example.com',
      expires_at: null,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'AUTH_INVALID',
            meta: {
              auth: {
                state: 'invalid',
                user: { email: null },
                expires_at: null,
              },
            },
          }),
          {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    await expect(
      bffJson('/v1/profile/update', { ...makeHeaders(), auth_token: 'stale_token' }, { method: 'POST' }),
    ).rejects.toBeInstanceOf(PivotaAgentBffError);
    expect(loadAuroraAuthSession()).toBeNull();
  });

  it('bffChatStream refreshes auth state from result events', async () => {
    const expiresAt = '2099-03-13T20:00:00.000Z';
    const sseBody = [
      'event: thinking',
      'data: {"step":"routing","message":"Routing..."}',
      '',
      'event: result',
      `data: ${JSON.stringify({
        cards: [],
        ops: {},
        next_actions: [],
        thinking_steps: [{ step: 'routing', message: 'Routing...' }],
        meta: {
          skill_id: 'ingredient_report',
          auth: {
            state: 'authenticated',
            user: { email: 'stream@example.com' },
            expires_at: expiresAt,
          },
        },
      })}`,
      '',
      'event: done',
      'data: {}',
      '',
    ].join('\n');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(sseBody, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    );

    await bffChatStream(
      { ...makeHeaders(), auth_token: 'stream_token' },
      { message: 'hello' },
      {
        onThinking: vi.fn(),
        onChunk: vi.fn(),
        onResult: vi.fn(),
        onDone: vi.fn(),
      },
      { timeoutMs: 1_000 },
    );

    expect(loadAuroraAuthSession()).toEqual({
      token: 'stream_token',
      email: 'stream@example.com',
      expires_at: expiresAt,
    });
  });

  it('chat response parser preserves top-level meta.auth', () => {
    const meta = {
      auth: {
        state: 'authenticated',
        user: { email: 'parser@example.com' },
        expires_at: '2099-03-13T22:00:00.000Z',
      },
    };

    const parsed = parseChatResponseV1({
      version: '1.0',
      request_id: 'req_parser',
      trace_id: 'trace_parser',
      assistant_text: 'Hello',
      cards: [],
      follow_up_questions: [],
      suggested_quick_replies: [],
      ops: {
        thread_ops: [],
        profile_patch: [],
        routine_patch: [],
        experiment_events: [],
      },
      safety: {
        risk_level: 'none',
        red_flags: [],
        disclaimer: '',
      },
      telemetry: {
        intent: 'unknown',
        intent_confidence: 0,
        entities: [],
      },
      meta,
    });

    expect(parsed?.meta).toEqual(meta);
    expect(parsed ? chatResponseV1ToEnvelope(parsed).meta : null).toEqual(meta);
  });

  it('clearAuroraAuthSession is a no-op when storage is already empty', () => {
    clearAuroraAuthSession();
    expect(loadAuroraAuthSession()).toBeNull();
  });
});
