import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, KeyRound, LogIn, LogOut, Mail, Menu, Shield, User } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { AURORA_AUTH_SESSION_CHANGED_EVENT, clearAuroraAuthSession, loadAuroraAuthSession, saveAuroraAuthSession, type AuroraAuthSession } from '@/lib/auth';
import { bffJson, makeDefaultHeaders, PivotaAgentBffError, type V1Envelope } from '@/lib/pivotaAgentBff';
import { deriveQuickProfileStatus, formatQuickProfileSummary, type QuickProfileStatus } from '@/lib/profileCompletion';
import { loadAuroraUserProfile, saveAuroraUserProfile } from '@/lib/userProfile';
import { buildFullProfileDraft, buildProfileUpdatePatch, type FullProfileDraft } from '@/lib/auroraProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const MIN_ACTIONABLE_NOTICE_LEN = 18;
const PASSWORD_SET_FLAG_KEY_PREFIX = 'pivota_aurora_password_set_v1:';
const MAX_DISPLAY_NAME_LEN = 40;
const MAX_AVATAR_FILE_BYTES = 8 * 1024 * 1024;
const AVATAR_OUTPUT_MAX_SIDE = 320;
const AVATAR_OUTPUT_QUALITY = 0.86;

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

const isAllowedAvatarSource = (value: string): boolean => {
  const v = String(value || '').trim();
  if (!v) return true;
  if (v.startsWith('data:image/')) return true;
  return /^https?:\/\//i.test(v);
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('empty_file_result'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error || new Error('file_read_error'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_error'));
    img.src = src;
  });

const fileToAvatarDataUrl = async (file: File): Promise<string> => {
  if (!String(file.type || '').startsWith('image/')) {
    throw new Error('invalid_file_type');
  }
  const rawDataUrl = await fileToDataUrl(file);
  const image = await loadImage(rawDataUrl);
  const maxSide = Math.max(image.width || 0, image.height || 0, 1);
  const scale = Math.min(1, AVATAR_OUTPUT_MAX_SIDE / maxSide);
  const width = Math.max(1, Math.round((image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_context_unavailable');
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', AVATAR_OUTPUT_QUALITY);
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

function buildEmptyAuthDraft(email = '') {
  return {
    email,
    code: '',
    password: '',
    newPassword: '',
    newPasswordConfirm: '',
  };
}

export default function Profile() {
  const { openSidebar, startChat, openComposer } = useOutletContext<MobileShellContext>();

  const { language: lang, langPref, setLanguage, t } = useLanguage();
  const isCN = lang === 'CN';
  const [authSession, setAuthSession] = useState<AuroraAuthSession | null>(() => loadAuroraAuthSession());
  const [authMode, setAuthMode] = useState<'code' | 'password'>('code');
  const [authStage, setAuthStage] = useState<'email' | 'code'>('email');
  const [authDraft, setAuthDraft] = useState(() => buildEmptyAuthDraft(authSession?.email ?? ''));
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
  const [showSyncHint, setShowSyncHint] = useState(false);
  const [skinEditorOpen, setSkinEditorOpen] = useState(false);
  const [skinDraft, setSkinDraft] = useState<FullProfileDraft>(() => buildFullProfileDraft(null));
  const [skinSaving, setSkinSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const accountSectionRef = useRef<HTMLDivElement | null>(null);

  const toggleLang = useCallback(() => {
    setLanguage(langPref === 'cn' ? 'en' : 'cn');
  }, [langPref, setLanguage]);

  const resetAuthUi = useCallback((nextEmail = '') => {
    setAuthMode('code');
    setAuthStage('email');
    setAuthDraft(buildEmptyAuthDraft(nextEmail));
    setAuthError(null);
    setAuthNotice(null);
  }, []);

  useEffect(() => {
    const onAuthChanged = () => {
      const nextSession = loadAuroraAuthSession();
      setAuthSession(nextSession);
      resetAuthUi(nextSession?.email ?? '');
      setShowSyncHint(false);
    };
    window.addEventListener(AURORA_AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AURORA_AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
  }, [resetAuthUi]);


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
    startChat({ kind: 'chip', title: t('profile.quick_profile'), chip_id: 'chip_quick_profile' });
  }, [startChat, t]);

  const openProfileEditor = useCallback(() => {
    const profile = bootstrapProfile as any;
    setSkinDraft(buildFullProfileDraft(profile));
    setSkinEditorOpen(true);
  }, [bootstrapProfile]);

  const saveSkinProfile = useCallback(async () => {
    setSkinSaving(true);
    try {
      const patch = buildProfileUpdatePatch(skinDraft);
      await bffJson<V1Envelope>('/v1/profile/update', makeHeaders({ authToken: authSession?.token || null }), {
        method: 'POST',
        body: JSON.stringify(patch),
        timeoutMs: 15_000,
      });
      setSkinEditorOpen(false);
      toast({ title: t('profile.profile_updated') });
      void refreshBootstrapProfile();
    } catch (err) {
      toast({ title: t('profile.save_failed'), description: toBffErrorMessage(err), variant: 'destructive' });
    } finally {
      setSkinSaving(false);
    }
  }, [skinDraft, authSession?.token, makeHeaders, t, toBffErrorMessage, refreshBootstrapProfile]);

  const startAuth = useCallback(async () => {
    const email = authDraft.email.trim();
    if (!email) {
      setAuthError(t('profile.enter_email'));
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
  }, [authDraft.email, t, makeHeaders, toBffErrorMessage]);

  const verifyAuth = useCallback(async () => {
    const email = authDraft.email.trim();
    const code = authDraft.code.trim();
    if (!email || !code) {
      setAuthError(t('profile.enter_email_code'));
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
  }, [authDraft.code, authDraft.email, extractAuthSessionFromEnvelope, t, makeHeaders, toBffErrorMessage]);

  const passwordLogin = useCallback(async () => {
    const email = authDraft.email.trim();
    const password = authDraft.password;
    if (!email || !password) {
      setAuthError(t('profile.enter_email_password'));
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
  }, [authDraft.email, authDraft.password, extractAuthSessionFromEnvelope, t, makeHeaders, toBffErrorMessage]);

  const savePassword = useCallback(async () => {
    const token = authSession?.token || '';
    if (!token) {
      setAuthError(t('profile.sign_in_first'));
      return;
    }
    const password = authDraft.newPassword;
    const confirm = authDraft.newPasswordConfirm;
    if (!password || password.length < 8) {
      setAuthError(t('profile.password_min_length'));
      return;
    }
    if (password !== confirm) {
      setAuthError(t('profile.password_mismatch'));
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
        throw new Error(t('profile.password_server_error'));
      }

      const serverMessageRaw =
        typeof env?.assistant_message?.content === 'string' ? env.assistant_message.content.trim() : '';
      const serverMessage = serverMessageRaw.length >= MIN_ACTIONABLE_NOTICE_LEN ? serverMessageRaw : '';
      const notice = serverMessage || t('profile.password_success');
      markPasswordSetFlag(authSession?.email || '');
      setAuthDraft((prev) => ({ ...prev, newPassword: '', newPasswordConfirm: '' }));
      setPasswordEditorOpen(false);
      setAuthNotice(notice);
      toast({
        title: t('profile.password_updated'),
        description: notice,
      });
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.newPassword, authDraft.newPasswordConfirm, authSession?.email, authSession?.token, t, makeHeaders, toBffErrorMessage]);

  const saveProfileDetails = useCallback(() => {
    const email = authSession?.email?.trim() || '';
    if (!email) {
      setProfileError(t('profile.sign_in_before_saving'));
      setProfileNotice(null);
      return;
    }
    const displayName = String(profileDraft.displayName || '')
      .trim()
      .slice(0, MAX_DISPLAY_NAME_LEN);
    const avatarUrl = String(profileDraft.avatarUrl || '').trim();
    if (!isAllowedAvatarSource(avatarUrl)) {
      setProfileError(t('profile.avatar_invalid_format'));
      setProfileNotice(null);
      return;
    }
    const saved = saveAuroraUserProfile(email, { displayName, avatarUrl });
    setProfileDraft({
      displayName: saved?.displayName || '',
      avatarUrl: saved?.avatarUrl || '',
    });
    const notice = t('profile.profile_saved_notice');
    setProfileError(null);
    setProfileNotice(notice);
    toast({
      title: t('profile.profile_updated'),
      description: notice,
    });
  }, [authSession?.email, t, profileDraft.avatarUrl, profileDraft.displayName]);

  const chooseAvatarFile = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const removeAvatar = useCallback(() => {
    setProfileDraft((prev) => ({ ...prev, avatarUrl: '' }));
    setProfileError(null);
    setProfileNotice(t('profile.avatar_removed_notice'));
  }, [t]);

  const onAvatarFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (file.size > MAX_AVATAR_FILE_BYTES) {
        setProfileError(t('profile.avatar_too_large'));
        setProfileNotice(null);
        return;
      }
      try {
        const avatarDataUrl = await fileToAvatarDataUrl(file);
        setProfileDraft((prev) => ({ ...prev, avatarUrl: avatarDataUrl }));
        setProfileError(null);
        setProfileNotice(t('profile.avatar_updated_notice'));
      } catch {
        setProfileError(t('profile.avatar_process_failed'));
        setProfileNotice(null);
      }
    },
    [t],
  );

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
      resetAuthUi();
      setAuthLoading(false);
    }
  }, [authSession?.token, makeHeaders, resetAuthUi]);

  return (
    <div className="ios-page">
      <div className="ios-page-header">
        <button
          type="button"
          onClick={openSidebar}
          className="ios-nav-button"
          aria-label={t('common.open_menu')}
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="ios-page-title">{t('profile.title')}</div>
        <button
          type="button"
          onClick={toggleLang}
          className="ios-nav-button min-w-[66px] text-[12px] font-semibold"
          aria-label={isCN ? t('profile.switch_to_en') : t('profile.switch_to_cn')}
          title={isCN ? t('profile.switch_to_en') : t('profile.switch_to_cn')}
        >
          {isCN ? t('profile.lang_label_cn') : t('profile.lang_label_en')}
        </button>
      </div>

      <div ref={accountSectionRef} className="ios-panel mt-4">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <Shield className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1">
            <div className="ios-section-title">{t('profile.account')}</div>
            <div className="ios-caption mt-1">{t('profile.account_desc')}</div>
          </div>
        </div>

        {authSession ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
              <div className="text-[15px] font-semibold text-foreground">{t('profile.profile_details')}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {t('profile.profile_details_desc')}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="aurora-home-role-icon inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border">
                  {profileDraft.avatarUrl ? (
                    <img
                      src={profileDraft.avatarUrl}
                      alt={t('profile.avatar_preview')}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-[18px] w-[18px]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-foreground">
                    {profileDraft.displayName.trim() || authSession.email.split('@')[0] || t('sidebar.user_default')}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">{authSession.email}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                <label className="space-y-1 text-[12px] text-muted-foreground">
                  {t('profile.display_name')}
                  <input
                    className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.displayName}
                    onChange={(e) => {
                      setProfileDraft((prev) => ({ ...prev, displayName: e.target.value }));
                      setProfileNotice(null);
                      setProfileError(null);
                    }}
                    placeholder={t('profile.display_name_placeholder')}
                    maxLength={MAX_DISPLAY_NAME_LEN}
                    disabled={authLoading}
                  />
                </label>
                <div className="space-y-1 text-[12px] text-muted-foreground">
                  <div>{t('profile.avatar')}</div>
                  <input
                    ref={avatarInputRef}
                    className="hidden"
                    type="file"
                    accept="image/*"
                    onChange={(e) => void onAvatarFileChange(e)}
                    disabled={authLoading}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        'inline-flex flex-1 items-center justify-center rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[13px] font-semibold text-foreground shadow-card',
                        'active:scale-[0.99]',
                      )}
                      onClick={chooseAvatarFile}
                      disabled={authLoading}
                    >
                      {t('profile.upload_avatar')}
                    </button>
                    {profileDraft.avatarUrl ? (
                      <button
                        type="button"
                        className={cn(
                          'inline-flex flex-1 items-center justify-center rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[13px] font-semibold text-foreground shadow-card',
                          'active:scale-[0.99]',
                        )}
                        onClick={removeAvatar}
                        disabled={authLoading}
                      >
                        {t('profile.remove_avatar')}
                      </button>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-muted-foreground/90">
                    {t('profile.avatar_hint')}
                  </div>
                </div>
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
                    'active:scale-[0.99]',
                  )}
                  onClick={saveProfileDetails}
                  disabled={authLoading}
                >
                  {t('profile.save_profile')}
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
                  <div className="text-[15px] font-semibold text-foreground">{t('profile.password_optional')}</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">{t('profile.password_hint')}</div>
                  <div className="mt-3 grid gap-3">
                    <label className="space-y-1 text-[12px] text-muted-foreground">
                      {t('profile.new_password')}
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
                      {t('profile.confirm_password')}
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
                      {authLoading ? t('common.saving') : t('profile.save_password')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[15px] font-semibold text-foreground">{t('profile.password_is_set')}</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {t('profile.password_change_hint')}
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
                    {t('profile.change_password')}
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
              {t('profile.sign_out')}
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
                {t('profile.email_code')}
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
                {t('profile.password')}
              </button>
            </div>

            <label className="space-y-1 text-[12px] text-muted-foreground">
              {t('profile.email')}
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
                  {t('profile.password')}
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
                  {authLoading ? t('profile.signing_in') : t('profile.password_login')}
                </button>
                <div className="text-[12px] text-muted-foreground">
                  {t('profile.no_password_hint')}
                </div>
              </>
            ) : authStage === 'email' ? (
              <>
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
                  {authLoading ? t('profile.sending') : t('profile.send_code')}
                </button>
                <div className="text-[12px] text-muted-foreground">
                  {t('profile.new_user_hint')}
                </div>
              </>
            ) : (
              <>
                <label className="space-y-1 text-[12px] text-muted-foreground">
                  {t('profile.verification_code')}
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
                    {t('common.back')}
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
                    {authLoading ? t('profile.verifying') : t('profile.verify')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!authSession && authNotice ? <div className="mt-3 text-[12px] text-emerald-700">{authNotice}</div> : null}
        {authError ? <div className="mt-3 text-[12px] text-red-600">{authError}</div> : null}
      </div>

      <div className="ios-panel mt-3">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <User className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="ios-section-title">{t('profile.quick_profile')}</div>
            <div className="ios-caption mt-1">
              {quickProfileStatus === 'incomplete'
                ? t('profile.qp_incomplete')
                : quickProfileStatus === 'complete_guest'
                  ? t('profile.qp_complete_guest')
                  : t('profile.qp_complete_signed')}
            </div>
            {quickProfileStatus !== 'incomplete' ? (
              <div className="mt-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-[12px] text-muted-foreground">
                {quickProfileSummary}
              </div>
            ) : null}
            {bootstrapLoading ? (
              <div className="mt-2 text-[12px] text-muted-foreground">{t('profile.refreshing_status')}</div>
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
            {t('profile.start_quick_profile')}
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
                  setAuthNotice(t('profile.sync_notice'));
                setShowSyncHint(true);
                window.setTimeout(() => {
                  accountSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 60);
              }}
            >
              {t('profile.sign_in_sync')}
            </button>
            {showSyncHint ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
                {t('profile.sync_hint')}
              </div>
            ) : null}
            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
                'active:scale-[0.99]',
              )}
              onClick={openQuickProfile}
            >
              {t('profile.retake_quick_profile')}
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
              {t('profile.additional_info')}
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card',
                'active:scale-[0.99]',
              )}
              onClick={openQuickProfile}
            >
              {t('profile.retake_quick_profile')}
            </button>
          </div>
        ) : null}
      </div>

      <div className="ios-panel-soft mt-3">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <HelpCircle className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1">
            <div className="ios-section-title">{t('profile.help_center')}</div>
            <div className="ios-caption mt-1">{t('profile.help_desc')}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {[
            { label: t('profile.help.photo_tips'), q: t('profile.help.photo_tips_q') },
            { label: t('profile.help.routine_tips'), q: t('profile.help.routine_tips_q') },
            { label: t('profile.help.privacy'), q: t('profile.help.privacy_q') },
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
              <span className="text-[12px] text-muted-foreground">{t('common.ask')}</span>
            </button>
          ))}
        </div>
      </div>

      {skinEditorOpen ? (
        <div className="fixed inset-0 z-[60]">
          <button className="absolute inset-0 bg-black/35 backdrop-blur-sm" aria-label="Close" onClick={() => setSkinEditorOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[var(--aurora-shell-max)] overflow-hidden rounded-t-3xl border border-border/50 bg-card/90 shadow-elevated backdrop-blur-xl">
            <div className="flex max-h-[85vh] max-h-[85dvh] flex-col">
              <div className="flex items-center justify-between px-[var(--aurora-page-x)] pb-3 pt-4">
                <div className="text-sm font-semibold text-foreground">{t('profile.additional_info')}</div>
                <button
                  className="aurora-home-role-icon inline-flex h-9 w-9 items-center justify-center rounded-full border"
                  onClick={() => setSkinEditorOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-[var(--aurora-page-x)] pb-[calc(env(safe-area-inset-bottom)+16px)]">
                <div className="profile-sheet-compact space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-[11px] text-muted-foreground">
                      {t('profile.skin_editor.age_band')}
                      <select className="h-9 w-full rounded-xl border border-border/60 bg-background/60 px-2.5 text-[13px] text-foreground" value={skinDraft.age_band} onChange={(e) => setSkinDraft((p) => ({ ...p, age_band: e.target.value }))}>
                        <option value="unknown">{t('profile.skin_editor.unknown')}</option>
                        <option value="under_13">&lt;13</option>
                        <option value="13_17">13-17</option>
                        <option value="18_24">18-24</option>
                        <option value="25_34">25-34</option>
                        <option value="35_44">35-44</option>
                        <option value="45_54">45-54</option>
                        <option value="55_plus">55+</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-[11px] text-muted-foreground">
                      {t('profile.skin_editor.budget')}
                      <select className="h-9 w-full rounded-xl border border-border/60 bg-background/60 px-2.5 text-[13px] text-foreground" value={skinDraft.budgetTier} onChange={(e) => setSkinDraft((p) => ({ ...p, budgetTier: e.target.value }))}>
                        <option value="">{t('profile.skin_editor.not_selected')}</option>
                        <option value="¥200">¥200</option>
                        <option value="¥500">¥500</option>
                        <option value="¥1000+">¥1000+</option>
                        <option value="不确定">{t('profile.skin_editor.not_sure')}</option>
                      </select>
                    </label>
                  </div>

                  <label className="space-y-1 text-[11px] text-muted-foreground">
                    {t('profile.skin_editor.home_region')}
                    <input
                      className="h-9 w-full rounded-xl border border-border/60 bg-background/60 px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                      value={skinDraft.region}
                      onChange={(e) => setSkinDraft((p) => ({ ...p, region: e.target.value }))}
                      placeholder={t('profile.skin_editor.home_region_placeholder')}
                    />
                  </label>

                  <label className="space-y-1 text-[11px] text-muted-foreground">
                    {t('profile.skin_editor.high_risk_meds')}
                    <input
                      className="h-9 w-full rounded-xl border border-border/60 bg-background/60 px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                      value={skinDraft.high_risk_medications_text}
                      onChange={(e) => setSkinDraft((p) => ({ ...p, high_risk_medications_text: e.target.value }))}
                      placeholder={t('profile.skin_editor.high_risk_meds_placeholder')}
                    />
                  </label>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      className={cn(
                        'flex-1 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground',
                        'active:scale-[0.99]',
                      )}
                      onClick={() => setSkinEditorOpen(false)}
                      disabled={skinSaving}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'aurora-home-role-primary flex-1 rounded-2xl px-4 py-2.5 text-[14px] font-semibold',
                        'active:scale-[0.99]',
                      )}
                      onClick={() => void saveSkinProfile()}
                      disabled={skinSaving}
                    >
                      {skinSaving ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
