import { describe, it, expect, beforeEach, vi } from 'vitest';

import { getLangPref, getOrCreateAuroraUid, setLangPref } from '@/lib/persistence';

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
});
