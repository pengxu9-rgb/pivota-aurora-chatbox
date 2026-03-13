import en, { type LocaleKeys } from './en';
import de from './de';
import fr from './fr';
import ja from './ja';
import zh from './zh';
import type { Language } from '@/lib/types';

const locales: Record<Language, Record<string, string>> = {
  EN: en,
  CN: zh,
  FR: fr,
  DE: de,
  JA: ja,
};

export type { LocaleKeys };

/**
 * Translate a key for the given language with optional parameter interpolation.
 * Falls back to EN, then returns the raw key.
 */
export function t(key: string, lang: Language, params?: Record<string, string | number>): string {
  const table = locales[lang] ?? locales.EN;
  let text = table[key] ?? locales.EN[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export { de, en, fr, ja, zh };
