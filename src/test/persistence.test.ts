import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  getLangMismatchHintMutedUntil,
  getLangPref,
  getLangReplyMode,
  getOrCreateAuroraUid,
  setLangMismatchHintMutedUntil,
  setLangPref,
  setLangReplyMode,
} from '@/lib/persistence';

describe('persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it('lang_pref defaults from browser language and can be set', () => {
    const expected = /^zh\b/i.test(window.navigator.language || '') ? 'cn' : 'en';
    expect(getLangPref()).toBe(expected);
    setLangPref('cn');
    expect(getLangPref()).toBe('cn');
    expect(window.localStorage.getItem('lang_pref')).toBe('cn');
  });

  it('defaults to cn when browser language is zh-*', () => {
    const langSpy = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('zh-CN');
    const langsSpy = vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['zh-CN']);
    window.localStorage.clear();
    expect(getLangPref()).toBe('cn');
    langSpy.mockRestore();
    langsSpy.mockRestore();
  });

  it('migrates legacy `pivota_aurora_lang_pref_v1` -> `lang_pref`', () => {
    window.localStorage.setItem('pivota_aurora_lang_pref_v1', 'CN');
    expect(getLangPref()).toBe('cn');
    expect(window.localStorage.getItem('lang_pref')).toBe('cn');
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
