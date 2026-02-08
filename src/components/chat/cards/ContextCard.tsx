import React, { useState } from 'react';
import { Language, Market, BudgetTier } from '@/lib/types';
import { t, getMarketLabel, getBudgetLabel } from '@/lib/i18n';

interface ContextCardProps {
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

const MARKETS: Market[] = ['US', 'EU', 'UK', 'Canada', 'Singapore', 'Global'];
const BUDGETS: BudgetTier[] = ['$', '$$', '$$$'];

export function ContextCard({ onAction, language }: ContextCardProps) {
  const [market, setMarket] = useState<Market>('US');
  const [budget, setBudget] = useState<BudgetTier>('$$');

  return (
    <div className="chat-card space-y-3">
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          {t('s2.market.label', language)}
        </label>
        <div className="flex flex-wrap gap-2">
          {MARKETS.map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`chip-button ${market === m ? 'chip-button-primary' : ''}`}
            >
              {getMarketLabel(m, language)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          {t('s2.budget.label', language)}
        </label>
        <div className="flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <button
              key={b}
              onClick={() => setBudget(b)}
              className={`chip-button ${budget === b ? 'chip-button-primary' : ''}`}
            >
              {getBudgetLabel(b, language)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onAction('context_continue', { market, budget })}
          className="action-button action-button-primary flex-1"
        >
          {t('s2.btn.continue', language)}
        </button>
        <button
          onClick={() => onAction('context_skip')}
          className="action-button action-button-ghost"
        >
          {t('s2.btn.skip', language)}
        </button>
      </div>
    </div>
  );
}
