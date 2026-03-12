import { t as translate } from '@/locales';
import type { Language, Market, BudgetTier } from './types';

export function t(key: string, lang: Language, params?: Record<string, string | number>): string {
  return translate(key, lang, params);
}

export function getMarketLabel(market: Market, lang: Language): string {
  return translate(`market.${market}`, lang);
}

export function getBudgetLabel(budget: BudgetTier, lang: Language): string {
  return translate(`budget.${budget}`, lang);
}

export function getConfidenceLabel(confidence: 'pretty_sure' | 'somewhat_sure' | 'not_sure', lang: Language): string {
  return translate(`s5.confidence.${confidence}`, lang);
}

export function getBadgeLabel(badge: string, lang: Language): string {
  return translate(`badge.${badge}`, lang);
}
