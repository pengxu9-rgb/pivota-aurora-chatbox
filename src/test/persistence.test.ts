import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  __resetPersistenceMemoryForTests,
  getAccountLangPref,
  getLangMismatchHintMutedUntil,
  getLangPref,
  getLangReplyMode,
  getOrCreateAuroraUid,
  setAccountLangPref,
  setLangMismatchHintMutedUntil,
  setLangPref,
  setLangReplyMode,
} from '@/lib/persistence';

describe('persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetPersistenceMemoryForTests();
  });

  it('getOrCreateAuroraUid persists under `aurora_uid`', () => {
    const a = getOrCreateAuroraUid();
    const b = getOrCreateAuroraUid();
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(window.localStorage.getItem('aurora_uid')).toBe(a);
  });

  it('migrates legacy `pivota_aurora_uid_v1` -> `aurora_uid`', () => {
    window.localStorage.setItem('pivota_aurora_uid_v1', 'legacy_uid');
    expect(window.localStorage.getItem('aurora_uid')).toBeNull();
    const uid = getOrCreateAuroraUid();
    expect(uid).toBe('legacy_uid');
    expect(window.localStorage.getItem('aurora_uid')).toBe('legacy_uid');
  });

  it('lang_pref defaults to english unless explicitly set', () => {
    expect(getLangPref()).toBe('en');
    setLangPref('cn');
    expect(getLangPref()).toBe('cn');
    expect(window.localStorage.getItem('lang_pref')).toBe('cn');
  });

  it.each([
    'zh-CN',
    'fr-FR',
    'de-DE',
    'ja-JP',
    'es-ES',
  ] as const)('ignores browser language %s and still defaults to english', (browserLanguage) => {
    const langSpy = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(browserLanguage);
    const langsSpy = vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue([browserLanguage]);
    window.localStorage.clear();
    expect(getLangPref()).toBe('en');
    langSpy.mockRestore();
    langsSpy.mockRestore();
  });

  it('migrates legacy `pivota_aurora_lang_pref_v1` -> `lang_pref`', () => {
    window.localStorage.setItem('pivota_aurora_lang_pref_v1', 'CN');
    expect(getLangPref()).toBe('cn');
    expect(window.localStorage.getItem('lang_pref')).toBe('cn');
  });

  it('supports extended locale prefs while keeping EN as the legacy fallback', () => {
    setLangPref('fr');
    expect(getLangPref()).toBe('fr');
    expect(window.localStorage.getItem('lang_pref')).toBe('fr');
    expect(window.localStorage.getItem('pivota_aurora_lang_pref_v1')).toBe('EN');
  });

  it('migrates uppercase extended locale values from legacy storage', () => {
    window.localStorage.setItem('pivota_aurora_lang_pref_v1', 'JA');
    expect(getLangPref()).toBe('ja');
    expect(window.localStorage.getItem('lang_pref')).toBe('ja');
  });

  it('stores and restores account-bound language prefs by normalized email', () => {
    expect(getAccountLangPref('User@Example.com')).toBeNull();
    setAccountLangPref('User@Example.com', 'fr');
    expect(getAccountLangPref('user@example.com')).toBe('fr');
    expect(getAccountLangPref(' USER@example.com ')).toBe('fr');
  });

  it('does not throw when localStorage setItem fails', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => getOrCreateAuroraUid()).not.toThrow();
    expect(() => setLangPref('en')).not.toThrow();

    spy.mockRestore();
  });

  it('lang reply mode defaults to ui_lock and can be persisted', () => {
    expect(getLangReplyMode()).toBe('ui_lock');
    setLangReplyMode('auto_follow_input');
    expect(getLangReplyMode()).toBe('auto_follow_input');
    expect(window.localStorage.getItem('lang_reply_mode')).toBe('auto_follow_input');
  });

  it('language mismatch hint muted-until can be set and cleared', () => {
    expect(getLangMismatchHintMutedUntil()).toBe(0);
    setLangMismatchHintMutedUntil(1700000000123);
    expect(getLangMismatchHintMutedUntil()).toBe(1700000000123);
    setLangMismatchHintMutedUntil(0);
    expect(getLangMismatchHintMutedUntil()).toBe(0);
    expect(window.localStorage.getItem('lang_mismatch_hint_muted_until')).toBeNull();
  });
});
