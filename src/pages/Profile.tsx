import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HelpCircle, KeyRound, LogIn, LogOut, Mail, Menu, Shield, User } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { clearAuroraAuthSession, loadAuroraAuthSession, saveAuroraAuthSession, type AuroraAuthSession } from '@/lib/auth';
import { bffJson, makeDefaultHeaders, PivotaAgentBffError, type V1Envelope } from '@/lib/pivotaAgentBff';
import { deriveQuickProfileStatus, formatQuickProfileSummary, type QuickProfileStatus } from '@/lib/profileCompletion';
import { getLangPref } from '@/lib/persistence';
import { loadAuroraUserProfile, saveAuroraUserProfile } from '@/lib/userProfile';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const MIN_ACTIONABLE_NOTICE_LEN = 18;
const PASSWORD_SET_FLAG_KEY_PREFIX = 'pivota_aurora_password_set_v1:';
const MAX_DISPLAY_NAME_LEN = 40;

const passwordSetFlagKey = (email: string) => `${PASSWORD_SET_FLAG_KEY_PREFIX}${email.trim().toLowerCase()}`;

const hasPasswordSetFlag = (email: string): boolean => {
  try {
    return Boolean(email) && window.localStorage.getItem(passwordSetFlagKey(email)) === '1';
  } catch {
    return false;
  }
};

const markPasswordSetFlag = (email: string): void => {
  try {
    if (!email) return;
    window.localStorage.setItem(passwordSetFlagKey(email), '1');
  } catch {
    // ignore
  }
};

const isValidAvatarUrl = (value: string): boolean => {
  const v = String(value || '').trim();
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const extractBootstrapProfile = (env: V1Envelope): Record<string, unknown> | null => {
  const sessionPatch = asObject(env.session_patch);
  const profileFromPatch = asObject(sessionPatch?.profile);
  if (profileFromPatch) return profileFromPatch;

  const sessionCard = Array.isArray(env.cards)
    ? env.cards.find((c) => c && typeof c === 'object' && (c as any).type === 'session_bootstrap')
    : null;
  const payload = asObject((sessionCard as any)?.payload);
  return asObject(payload?.profile);
};

export default function Profile() {
  const { openSidebar, startChat, openComposer } = useOutletContext<MobileShellContext>();
  const navigate = useNavigate();

  const lang = useMemo(() => (getLangPref() === 'cn' ? 'CN' : 'EN') as const, []);
  const isCN = lang === 'CN';
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
  const [passwordEditorOpen, setPasswordEditorOpen] = useState(true);
  const [bootstrapProfile, setBootstrapProfile] = useState<Record<string, unknown> | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<{ displayName: string; avatarUrl: string }>({ displayName: '', avatarUrl: '' });
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const email = authSession?.email?.trim() || '';
    if (!email) {
      setPasswordEditorOpen(true);
      return;
    }
    setPasswordEditorOpen(!hasPasswordSetFlag(email));
  }, [authSession?.email]);

  useEffect(() => {
    const email = authSession?.email?.trim() || '';
    if (!email) {
      setProfileDraft({ displayName: '', avatarUrl: '' });
      setProfileNotice(null);
      setProfileError(null);
      return;
    }
    const stored = loadAuroraUserProfile(email);
    setProfileDraft({
      displayName: stored?.displayName || '',
      avatarUrl: stored?.avatarUrl || '',
    });
    setProfileNotice(null);
    setProfileError(null);
  }, [authSession?.email]);

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

  const refreshBootstrapProfile = useCallback(async () => {
    setBootstrapLoading(true);
    setBootstrapError(null);
    try {
      const env = await bffJson<V1Envelope>('/v1/session/bootstrap', makeHeaders({ authToken: authSession?.token || null }), {
        method: 'GET',
      });
      setBootstrapProfile(extractBootstrapProfile(env));
    } catch (err) {
      setBootstrapError(toBffErrorMessage(err));
      setBootstrapProfile(null);
    } finally {
      setBootstrapLoading(false);
    }
  }, [authSession?.token, makeHeaders, toBffErrorMessage]);

  useEffect(() => {
    void refreshBootstrapProfile();
  }, [refreshBootstrapProfile]);

  const quickProfileStatus = useMemo<QuickProfileStatus>(
    () => deriveQuickProfileStatus(bootstrapProfile, Boolean(authSession?.token)),
    [authSession?.token, bootstrapProfile],
  );

  const quickProfileSummary = useMemo(
    () => formatQuickProfileSummary(bootstrapProfile, lang),
    [bootstrapProfile, lang],
  );

  const openQuickProfile = useCallback(() => {
    startChat({ kind: 'chip', title: 'Quick Profile', chip_id: 'chip_quick_profile' });
  }, [startChat]);

  const openProfileEditor = useCallback(() => {
    const headers = makeDefaultHeaders(lang);
    const sp = new URLSearchParams();
    sp.set('brief_id', headers.brief_id);
    sp.set('trace_id', headers.trace_id);
    sp.set('open', 'profile');
    navigate({ pathname: '/chat', search: `?${sp.toString()}` });
  }, [lang, navigate]);

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
      markPasswordSetFlag(nextSession.email);
      setPasswordEditorOpen(false);
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

      const passwordCard = Array.isArray(env?.cards)
        ? env.cards.find((c) => c && typeof c === 'object' && (c as any).type === 'auth_password_set')
        : null;
      const passwordSetOk = Boolean((passwordCard as any)?.payload?.ok);
      if (!passwordSetOk) {
        throw new Error(lang === 'CN' ? '服务器未确认密码已更新，请重试。' : 'Server did not confirm password update. Please retry.');
      }

      const serverMessageRaw =
        typeof env?.assistant_message?.content === 'string' ? env.assistant_message.content.trim() : '';
      const serverMessage = serverMessageRaw.length >= MIN_ACTIONABLE_NOTICE_LEN ? serverMessageRaw : '';
      const notice =
        serverMessage ||
        (lang === 'CN'
          ? '密码已设置成功。下次可用邮箱 + 密码直接登录（验证码仍可用）。'
          : 'Password updated successfully. Next time you can sign in with email + password (OTP still works).');
      markPasswordSetFlag(authSession?.email || '');
      setAuthDraft((prev) => ({ ...prev, newPassword: '', newPasswordConfirm: '' }));
      setPasswordEditorOpen(false);
      setAuthNotice(notice);
      toast({
        title: lang === 'CN' ? '密码已设置' : 'Password updated',
        description: notice,
      });
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.newPassword, authDraft.newPasswordConfirm, authSession?.email, authSession?.token, lang, makeHeaders, toBffErrorMessage]);

  const saveProfileDetails = useCallback(() => {
    const email = authSession?.email?.trim() || '';
    if (!email) {
      setProfileError(isCN ? '请先登录后再保存。' : 'Please sign in before saving.');
      setProfileNotice(null);
      return;
    }
    const displayName = String(profileDraft.displayName || '')
      .trim()
      .slice(0, MAX_DISPLAY_NAME_LEN);
    const avatarUrl = String(profileDraft.avatarUrl || '').trim();
    if (!isValidAvatarUrl(avatarUrl)) {
      setProfileError(isCN ? '头像链接需为 http(s) 地址。' : 'Avatar URL must be a valid http(s) URL.');
      setProfileNotice(null);
      return;
    }
    const saved = saveAuroraUserProfile(email, { displayName, avatarUrl });
    setProfileDraft({
      displayName: saved?.displayName || '',
      avatarUrl: saved?.avatarUrl || '',
    });
    const notice = isCN ? '资料已保存，侧边栏会显示最新用户名和头像。' : 'Profile saved. Sidebar will show your latest name and avatar.';
    setProfileError(null);
    setProfileNotice(notice);
    toast({
      title: isCN ? '资料已更新' : 'Profile updated',
      description: notice,
    });
  }, [authSession?.email, isCN, profileDraft.avatarUrl, profileDraft.displayName]);

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
      setPasswordEditorOpen(true);
      setProfileDraft({ displayName: '', avatarUrl: '' });
      setProfileNotice(null);
      setProfileError(null);
      setAuthMode('code');
      setAuthStage('email');
      setAuthDraft({ email: '', code: '', password: '', newPassword: '', newPasswordConfirm: '' });
      setAuthLoading(false);
    }
  }, [authSession?.token, makeHeaders]);

  return (
    <div className="ios-page">
      <div className="ios-page-header">
        <button
          type="button"
          onClick={openSidebar}
          className="ios-nav-button"
          aria-label="Open menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="ios-page-title">Profile</div>
        <div className="ios-header-spacer" />
      </div>

      <div className="ios-panel mt-4">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <User className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="ios-section-title">Quick profile</div>
            <div className="ios-caption mt-1">
              {quickProfileStatus === 'incomplete'
                ? (isCN
                    ? '建议先完成 30 秒快速画像，Aurora 才能更准确地个性化推荐。'
                    : 'Best practice: complete the 30‑sec quick profile once so Aurora can personalize recommendations.')
                : quickProfileStatus === 'complete_guest'
                  ? (isCN
                      ? '快速画像已完成，当前仅保存在本设备。登录后可绑定并跨设备同步。'
                      : 'Quick profile is complete on this device. Sign in to bind and sync across devices.')
                  : (isCN
                      ? '快速画像已完成并已同步到账号。'
                      : 'Quick profile is complete and synced to your account.')}
            </div>
            {quickProfileStatus !== 'incomplete' ? (
              <div className="mt-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-[12px] text-muted-foreground">
                {quickProfileSummary}
              </div>
            ) : null}
            {bootstrapLoading ? (
              <div className="mt-2 text-[12px] text-muted-foreground">{isCN ? '正在刷新画像状态…' : 'Refreshing profile status…'}</div>
            ) : null}
            {bootstrapError ? (
              <div className="mt-2 text-[12px] text-red-600">{bootstrapError}</div>
            ) : null}
          </div>
        </div>

        {quickProfileStatus === 'incomplete' ? (
          <button
            type="button"
            className="aurora-home-role-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99]"
            onClick={openQuickProfile}
          >
            {isCN ? '开始快速画像' : 'Start quick profile'}
          </button>
        ) : null}

        {quickProfileStatus === 'complete_guest' ? (
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="aurora-home-role-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99]"
              onClick={() => {
                setAuthMode('code');
                setAuthStage('email');
                setAuthError(null);
                setAuthNotice(isCN ? '登录后将把当前设备画像绑定到账号。' : 'Sign in to bind this device profile to your account.');
              }}
            >
              {isCN ? '登录并绑定资料' : 'Sign in to bind profile'}
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
                'active:scale-[0.99]',
              )}
              onClick={openQuickProfile}
            >
              {isCN ? '重新填写快速画像' : 'Retake quick profile'}
            </button>
          </div>
        ) : null}

        {quickProfileStatus === 'complete_signed' ? (
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="aurora-home-role-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99]"
              onClick={openProfileEditor}
            >
              {isCN ? '编辑完整资料' : 'Edit full profile'}
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
                'active:scale-[0.99]',
              )}
              onClick={openQuickProfile}
            >
              {isCN ? '重新填写快速画像' : 'Retake quick profile'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="ios-panel mt-3">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <Shield className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1">
            <div className="ios-section-title">Account</div>
            <div className="ios-caption mt-1">Sign in to sync profile, routines, and history.</div>
          </div>
        </div>

        {authSession ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <div className="text-[12px] text-muted-foreground">Signed in as</div>
              <div className="mt-0.5 text-[15px] font-semibold text-foreground">{authSession.email}</div>
              {authSession.expires_at ? (
                <div className="mt-1 text-[12px] text-muted-foreground">Expires: {authSession.expires_at}</div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <div className="text-[15px] font-semibold text-foreground">{isCN ? '个人资料' : 'Profile details'}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {isCN ? '更新用户名与头像，左侧栏会同步显示。' : 'Update your name and avatar for the left sidebar.'}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="aurora-home-role-icon inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border">
                  {profileDraft.avatarUrl ? (
                    <img
                      src={profileDraft.avatarUrl}
                      alt={isCN ? '头像预览' : 'Avatar preview'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-[18px] w-[18px]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-foreground">
                    {profileDraft.displayName.trim() || authSession.email.split('@')[0] || (isCN ? '用户' : 'User')}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">{authSession.email}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                <label className="space-y-1 text-[12px] text-muted-foreground">
                  {isCN ? '用户名' : 'Display name'}
                  <input
                    className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.displayName}
                    onChange={(e) => {
                      setProfileDraft((prev) => ({ ...prev, displayName: e.target.value }));
                      setProfileNotice(null);
                      setProfileError(null);
                    }}
                    placeholder={isCN ? '例如：Peng' : 'e.g. Peng'}
                    maxLength={MAX_DISPLAY_NAME_LEN}
                    disabled={authLoading}
                  />
                </label>
                <label className="space-y-1 text-[12px] text-muted-foreground">
                  {isCN ? '头像 URL' : 'Avatar URL'}
                  <input
                    className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.avatarUrl}
                    onChange={(e) => {
                      setProfileDraft((prev) => ({ ...prev, avatarUrl: e.target.value }));
                      setProfileNotice(null);
                      setProfileError(null);
                    }}
                    placeholder="https://example.com/avatar.jpg"
                    inputMode="url"
                    autoComplete="url"
                    disabled={authLoading}
                  />
                </label>
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
                    'active:scale-[0.99]',
                  )}
                  onClick={saveProfileDetails}
                  disabled={authLoading}
                >
                  {isCN ? '保存资料' : 'Save profile'}
                </button>
              </div>
              {profileNotice ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
                  {profileNotice}
                </div>
              ) : null}
              {profileError ? <div className="mt-3 text-[12px] text-red-600">{profileError}</div> : null}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
              {passwordEditorOpen ? (
                <>
                  <div className="text-[15px] font-semibold text-foreground">Password (optional)</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">Set a password for faster sign‑in next time.</div>
                  <div className="mt-3 grid gap-3">
                    <label className="space-y-1 text-[12px] text-muted-foreground">
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
                    <label className="space-y-1 text-[12px] text-muted-foreground">
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
                      className={cn(
                        'aurora-home-role-primary inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card',
                        'active:scale-[0.99]',
                      )}
                      onClick={() => void savePassword()}
                      disabled={authLoading || !authDraft.newPassword || !authDraft.newPasswordConfirm}
                    >
                      <KeyRound className="h-4 w-4" />
                      {authLoading ? 'Saving…' : 'Save password'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[15px] font-semibold text-foreground">{isCN ? '密码已设置' : 'Password is set'}</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {isCN ? '你可以随时重新设置密码。' : 'You can change your password anytime.'}
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
                      'active:scale-[0.99]',
                    )}
                    onClick={() => {
                      setPasswordEditorOpen(true);
                      setAuthNotice(null);
                    }}
                    disabled={authLoading}
                  >
                    {isCN ? '更改密码' : 'Change password'}
                  </button>
                </>
              )}
              {authNotice ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
                  {authNotice}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
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
                className={cn(
                  'flex-1 rounded-2xl border border-border/60 px-3 py-2 text-[14px] font-semibold',
                  authMode === 'code' ? 'aurora-home-role-primary' : 'bg-background/60 text-foreground',
                )}
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
                className={cn(
                  'flex-1 rounded-2xl border border-border/60 px-3 py-2 text-[14px] font-semibold',
                  authMode === 'password' ? 'aurora-home-role-primary' : 'bg-background/60 text-foreground',
                )}
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

            <label className="space-y-1 text-[12px] text-muted-foreground">
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
                <label className="space-y-1 text-[12px] text-muted-foreground">
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
                  className={cn(
                    'aurora-home-role-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card',
                    'active:scale-[0.99]',
                  )}
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
                className={cn(
                  'aurora-home-role-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card',
                  'active:scale-[0.99]',
                )}
                onClick={() => void startAuth()}
                disabled={authLoading || !authDraft.email.trim()}
              >
                <LogIn className="h-4 w-4" />
                {authLoading ? 'Sending…' : 'Send code'}
              </button>
            ) : (
              <>
                <label className="space-y-1 text-[12px] text-muted-foreground">
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
                    className={cn(
                      'flex-1 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
                      'active:scale-[0.99]',
                    )}
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
                    className={cn(
                      'aurora-home-role-primary flex-1 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card',
                      'active:scale-[0.99]',
                    )}
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

        {!authSession && authNotice ? <div className="mt-3 text-[12px] text-emerald-700">{authNotice}</div> : null}
        {authError ? <div className="mt-3 text-[12px] text-red-600">{authError}</div> : null}
      </div>

      <div className="ios-panel-soft mt-3">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <HelpCircle className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1">
            <div className="ios-section-title">Help Center</div>
            <div className="ios-caption mt-1">Tips + FAQs (opens the Ask Aurora drawer).</div>
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
                'inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-left text-[14px] font-semibold text-foreground shadow-card',
                'active:scale-[0.99]',
              )}
              onClick={() => openComposer({ query: it.q })}
            >
              <span className="truncate">{it.label}</span>
              <span className="text-[12px] text-muted-foreground">Ask</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
