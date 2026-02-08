import React, { useCallback, useMemo, useState } from 'react';
import { HelpCircle, KeyRound, LogIn, LogOut, Mail, Menu, Shield, User } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { clearAuroraAuthSession, loadAuroraAuthSession, saveAuroraAuthSession, type AuroraAuthSession } from '@/lib/auth';
import { bffJson, makeDefaultHeaders, PivotaAgentBffError, type V1Envelope } from '@/lib/pivotaAgentBff';
import { getLangPref } from '@/lib/persistence';
import { cn } from '@/lib/utils';

export default function Profile() {
  const { openSidebar, startChat, openComposer } = useOutletContext<MobileShellContext>();

  const lang = useMemo(() => (getLangPref() === 'cn' ? 'CN' : 'EN') as const, []);
  const [authSession, setAuthSession] = useState<AuroraAuthSession | null>(() => loadAuroraAuthSession());
  const [authMode, setAuthMode] = useState<'code' | 'password'>('code');
  const [authStage, setAuthStage] = useState<'email' | 'code'>('email');
  const [authDraft, setAuthDraft] = useState(() => ({
    email: authSession?.email ?? '',
    code: '',
    password: '',
    newPassword: '',
    newPasswordConfirm: '',
  }));
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const toBffErrorMessage = useCallback((err: unknown): string => {
    if (err instanceof PivotaAgentBffError) {
      const body = err.responseBody as any;
      const msg = body?.assistant_message?.content;
      if (typeof msg === 'string' && msg.trim()) return msg.trim();
      return err.message;
    }
    return err instanceof Error ? err.message : String(err);
  }, []);

  const extractAuthSessionFromEnvelope = useCallback((env: V1Envelope, fallbackEmail: string): AuroraAuthSession => {
    const sessionCard = Array.isArray(env.cards) ? env.cards.find((c) => c && typeof c === 'object' && (c as any).type === 'auth_session') : null;
    const token = String((sessionCard as any)?.payload?.token || '').trim();
    const userEmail = String((sessionCard as any)?.payload?.user?.email || fallbackEmail || '').trim();
    const expiresAtRaw = (sessionCard as any)?.payload?.expires_at;
    const expires_at = typeof expiresAtRaw === 'string' ? expiresAtRaw.trim() : null;
    if (!token || !userEmail) throw new Error('Missing auth token from server.');
    return { token, email: userEmail, expires_at };
  }, []);

  const makeHeaders = useCallback(
    (args?: { authToken?: string | null }) => {
      const base = makeDefaultHeaders(lang);
      const token = String(args?.authToken || '').trim();
      return { ...base, ...(token ? { auth_token: token } : {}) };
    },
    [lang],
  );

  const startAuth = useCallback(async () => {
    const email = authDraft.email.trim();
    if (!email) {
      setAuthError(lang === 'CN' ? '请输入邮箱。' : 'Please enter your email.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const env = await bffJson<V1Envelope>('/v1/auth/start', makeHeaders(), {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      void env;
      setAuthStage('code');
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.email, lang, makeHeaders, toBffErrorMessage]);

  const verifyAuth = useCallback(async () => {
    const email = authDraft.email.trim();
    const code = authDraft.code.trim();
    if (!email || !code) {
      setAuthError(lang === 'CN' ? '请输入邮箱和验证码。' : 'Please enter email + code.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const env = await bffJson<V1Envelope>('/v1/auth/verify', makeHeaders(), {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      const nextSession = extractAuthSessionFromEnvelope(env, email);
      saveAuroraAuthSession(nextSession);
      setAuthSession(nextSession);
      setAuthDraft((prev) => ({ ...prev, code: '', password: '' }));
      setAuthStage('email');
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.code, authDraft.email, extractAuthSessionFromEnvelope, lang, makeHeaders, toBffErrorMessage]);

  const passwordLogin = useCallback(async () => {
    const email = authDraft.email.trim();
    const password = authDraft.password;
    if (!email || !password) {
      setAuthError(lang === 'CN' ? '请输入邮箱和密码。' : 'Please enter email + password.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const env = await bffJson<V1Envelope>('/v1/auth/password/login', makeHeaders(), {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const nextSession = extractAuthSessionFromEnvelope(env, email);
      saveAuroraAuthSession(nextSession);
      setAuthSession(nextSession);
      setAuthDraft((prev) => ({ ...prev, password: '' }));
      setAuthStage('email');
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.email, authDraft.password, extractAuthSessionFromEnvelope, lang, makeHeaders, toBffErrorMessage]);

  const savePassword = useCallback(async () => {
    const token = authSession?.token || '';
    if (!token) {
      setAuthError(lang === 'CN' ? '请先登录。' : 'Please sign in first.');
      return;
    }
    const password = authDraft.newPassword;
    const confirm = authDraft.newPasswordConfirm;
    if (!password || password.length < 8) {
      setAuthError(lang === 'CN' ? '密码至少 8 位。' : 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setAuthError(lang === 'CN' ? '两次输入的密码不一致。' : "Passwords don't match.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const env = await bffJson<V1Envelope>('/v1/auth/password/set', makeHeaders({ authToken: token }), {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      void env;
      setAuthDraft((prev) => ({ ...prev, newPassword: '', newPasswordConfirm: '' }));
      setAuthNotice(lang === 'CN' ? '密码已设置。' : 'Password set.');
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.newPassword, authDraft.newPasswordConfirm, authSession?.token, lang, makeHeaders, toBffErrorMessage]);

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const token = authSession?.token || '';
      if (token) {
        await bffJson<V1Envelope>('/v1/auth/logout', makeHeaders({ authToken: token }), { method: 'POST' });
      }
    } catch {
      // ignore
    } finally {
      clearAuroraAuthSession();
      setAuthSession(null);
      setAuthMode('code');
      setAuthStage('email');
      setAuthDraft({ email: '', code: '', password: '', newPassword: '', newPasswordConfirm: '' });
      setAuthLoading(false);
    }
  }, [authSession?.token, makeHeaders]);

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={openSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-card/80 text-foreground/80 active:scale-[0.97]"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold text-foreground">Profile</div>
        <div className="h-10 w-10" />
      </div>

      <div className="mt-4 rounded-3xl border border-border/50 bg-card/70 p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Quick profile</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Best practice: complete the 30‑sec quick profile once so Aurora can personalize recommendations.
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.99]"
          onClick={() => startChat({ kind: 'chip', title: 'Quick Profile', chip_id: 'chip_quick_profile' })}
        >
          Start quick profile
        </button>
      </div>

      <div className="mt-3 rounded-3xl border border-border/50 bg-card/70 p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Account</div>
            <div className="mt-1 text-xs text-muted-foreground">Sign in to sync profile, routines, and history.</div>
          </div>
        </div>

        {authSession ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <div className="text-xs text-muted-foreground">Signed in as</div>
              <div className="mt-0.5 text-sm font-semibold text-foreground">{authSession.email}</div>
              {authSession.expires_at ? (
                <div className="mt-1 text-[11px] text-muted-foreground">Expires: {authSession.expires_at}</div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <div className="text-sm font-semibold text-foreground">Password (optional)</div>
              <div className="mt-1 text-xs text-muted-foreground">Set a password for faster sign‑in next time.</div>
              <div className="mt-3 grid gap-3">
                <label className="space-y-1 text-xs text-muted-foreground">
                  New password (min 8 chars)
                  <input
                    className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={authDraft.newPassword}
                    onChange={(e) => setAuthDraft((p) => ({ ...p, newPassword: e.target.value }))}
                    disabled={authLoading}
                    type="password"
                    autoComplete="new-password"
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Confirm password
                  <input
                    className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={authDraft.newPasswordConfirm}
                    onChange={(e) => setAuthDraft((p) => ({ ...p, newPasswordConfirm: e.target.value }))}
                    disabled={authLoading}
                    type="password"
                    autoComplete="new-password"
                  />
                </label>
                <button
                  type="button"
                  className={cn('inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card', 'active:scale-[0.99]')}
                  onClick={() => void savePassword()}
                  disabled={authLoading || !authDraft.newPassword || !authDraft.newPasswordConfirm}
                >
                  <KeyRound className="h-4 w-4" />
                  {authLoading ? 'Saving…' : 'Save password'}
                </button>
              </div>
            </div>

            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground shadow-card',
                'active:scale-[0.99]',
              )}
              onClick={() => void signOut()}
              disabled={authLoading}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                className={cn('flex-1 rounded-2xl border border-border/60 px-3 py-2 text-sm font-semibold', authMode === 'code' ? 'bg-primary text-primary-foreground' : 'bg-background/60 text-foreground')}
                onClick={() => {
                  setAuthMode('code');
                  setAuthStage('email');
                  setAuthError(null);
                  setAuthNotice(null);
                }}
                disabled={authLoading}
              >
                Email code
              </button>
              <button
                type="button"
                className={cn('flex-1 rounded-2xl border border-border/60 px-3 py-2 text-sm font-semibold', authMode === 'password' ? 'bg-primary text-primary-foreground' : 'bg-background/60 text-foreground')}
                onClick={() => {
                  setAuthMode('password');
                  setAuthStage('email');
                  setAuthError(null);
                  setAuthNotice(null);
                }}
                disabled={authLoading}
              >
                Password
              </button>
            </div>

            <label className="space-y-1 text-xs text-muted-foreground">
              Email
              <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  className="h-11 flex-1 bg-transparent text-sm text-foreground outline-none"
                  value={authDraft.email}
                  onChange={(e) => setAuthDraft((p) => ({ ...p, email: e.target.value }))}
                  placeholder="name@email.com"
                  inputMode="email"
                  autoComplete="email"
                  disabled={authLoading}
                />
              </div>
            </label>

            {authMode === 'password' ? (
              <>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Password
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <input
                      className="h-11 flex-1 bg-transparent text-sm text-foreground outline-none"
                      value={authDraft.password}
                      onChange={(e) => setAuthDraft((p) => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••"
                      type="password"
                      autoComplete="current-password"
                      disabled={authLoading}
                    />
                  </div>
                </label>
                <button
                  type="button"
                  className={cn('inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card', 'active:scale-[0.99]')}
                  onClick={() => void passwordLogin()}
                  disabled={authLoading || !authDraft.email.trim() || !authDraft.password}
                >
                  <LogIn className="h-4 w-4" />
                  {authLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </>
            ) : authStage === 'email' ? (
              <button
                type="button"
                className={cn('inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card', 'active:scale-[0.99]')}
                onClick={() => void startAuth()}
                disabled={authLoading || !authDraft.email.trim()}
              >
                <LogIn className="h-4 w-4" />
                {authLoading ? 'Sending…' : 'Send code'}
              </button>
            ) : (
              <>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Verification code
                  <input
                    className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={authDraft.code}
                    onChange={(e) => setAuthDraft((p) => ({ ...p, code: e.target.value }))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={authLoading}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn('flex-1 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground shadow-card', 'active:scale-[0.99]')}
                    onClick={() => {
                      setAuthStage('email');
                      setAuthDraft((p) => ({ ...p, code: '' }));
                      setAuthError(null);
                      setAuthNotice(null);
                    }}
                    disabled={authLoading}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={cn('flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card', 'active:scale-[0.99]')}
                    onClick={() => void verifyAuth()}
                    disabled={authLoading || !authDraft.code.trim()}
                  >
                    {authLoading ? 'Verifying…' : 'Verify'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {authNotice ? <div className="mt-3 text-xs text-emerald-700">{authNotice}</div> : null}
        {authError ? <div className="mt-3 text-xs text-red-600">{authError}</div> : null}
      </div>

      <div className="mt-3 rounded-3xl border border-border/50 bg-card/70 p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Help Center</div>
            <div className="mt-1 text-xs text-muted-foreground">Tips + FAQs (opens the Ask Aurora drawer).</div>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {[
            { label: 'Photo analysis tips', q: 'How do I take good photos for skin analysis?' },
            { label: 'Build a routine faster', q: 'Help me build a simple AM/PM routine. What info do you need?' },
            { label: 'Privacy & data', q: 'What data do you store? How do you use my photos and skin logs?' },
          ].map((it) => (
            <button
              key={it.label}
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-left text-sm font-semibold text-foreground shadow-card',
                'active:scale-[0.99]',
              )}
              onClick={() => openComposer({ query: it.q })}
            >
              <span className="truncate">{it.label}</span>
              <span className="text-xs text-muted-foreground">Ask</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
