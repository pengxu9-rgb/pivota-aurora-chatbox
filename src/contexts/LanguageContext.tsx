import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { AURORA_AUTH_SESSION_CHANGED_EVENT, loadAuroraAuthSession } from '@/lib/auth';
import type { Language } from '@/lib/types';
import {
  getAccountLangPref,
  getLangPref,
  hasExplicitLangPref,
  isLangPref,
  setAccountLangPref,
  setLangPref,
  toUiLanguage,
  type LangPref,
} from '@/lib/persistence';
import { t as translate } from '@/locales';

type LanguageContextValue = {
  /** Uppercase UI locale used by existing components and APIs. */
  language: Language;
  /** Lowercase preference stored in localStorage. */
  langPref: LangPref;
  /** Update the language preference (triggers re-render for all consumers) */
  setLanguage: (pref: LangPref) => void;
  /** Translate helper pre-bound to the current language */
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPref] = useState<LangPref>(() => getLangPref());

  useEffect(() => {
    const onLangChanged = (evt: Event) => {
      const next = (evt as CustomEvent).detail;
      if (isLangPref(next)) setPref(next);
    };
    window.addEventListener('aurora_lang_pref_changed', onLangChanged as EventListener);
    return () => window.removeEventListener('aurora_lang_pref_changed', onLangChanged as EventListener);
  }, []);

  useEffect(() => {
    const syncWithAuthSession = () => {
      const session = loadAuroraAuthSession();
      const email = String(session?.email || '').trim();
      if (!email) return;

      const boundPref = getAccountLangPref(email);
      if (boundPref) {
        setLangPref(boundPref);
        setPref(boundPref);
        return;
      }

      if (hasExplicitLangPref()) {
        setAccountLangPref(email, getLangPref());
      }
    };

    syncWithAuthSession();
    window.addEventListener(AURORA_AUTH_SESSION_CHANGED_EVENT, syncWithAuthSession);
    return () => window.removeEventListener(AURORA_AUTH_SESSION_CHANGED_EVENT, syncWithAuthSession);
  }, []);

  const setLanguage = useCallback((next: LangPref) => {
    setLangPref(next);
    const email = String(loadAuroraAuthSession()?.email || '').trim();
    if (email) setAccountLangPref(email, next);
    setPref(next);
  }, []);

  const language = toUiLanguage(pref);

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
