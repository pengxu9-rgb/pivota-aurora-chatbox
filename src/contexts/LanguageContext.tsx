import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import type { Language } from '@/lib/types';
import { getLangPref, setLangPref, type LangPref } from '@/lib/persistence';
import { t as translate } from '@/locales';

type LanguageContextValue = {
  /** Legacy language code used by existing components and APIs: 'EN' | 'CN' */
  language: Language;
  /** Lowercase preference stored in localStorage: 'en' | 'cn' */
  langPref: LangPref;
  /** Update the language preference (triggers re-render for all consumers) */
  setLanguage: (pref: LangPref) => void;
  /** Translate helper pre-bound to the current language */
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const toLang = (pref: LangPref): Language => (pref === 'cn' ? 'CN' : 'EN');

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPref] = useState<LangPref>(() => getLangPref());

  useEffect(() => {
    const onLangChanged = (evt: Event) => {
      const next = (evt as CustomEvent).detail;
      if (next === 'en' || next === 'cn') setPref(next);
    };
    window.addEventListener('aurora_lang_pref_changed', onLangChanged as EventListener);
    return () => window.removeEventListener('aurora_lang_pref_changed', onLangChanged as EventListener);
  }, []);

  const setLanguage = useCallback((next: LangPref) => {
    setLangPref(next);
    setPref(next);
  }, []);

  const language = toLang(pref);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, language, params),
    [language],
  );

  const value: LanguageContextValue = { language, langPref: pref, setLanguage, t };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/**
 * Access the current language and bound `t()` helper.
 * Must be used within a `<LanguageProvider>`.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within <LanguageProvider>');
  return ctx;
}
