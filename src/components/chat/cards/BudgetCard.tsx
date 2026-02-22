import React, { useState } from 'react';
import { Language, BudgetTier } from '@/lib/types';
import { t, getBudgetLabel } from '@/lib/i18n';

interface BudgetCardProps {
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

const BUDGETS: BudgetTier[] = ['$', '$$', '$$$'];

/**
 * @deprecated Legacy prompt implementation. Not wired in current `/chat` runtime.
 * Use the unified prompt system (`PromptHeader`/`PromptFooter`/`OptionCardGroup`) for new ask flows.
 */
export function BudgetCard({ onAction, language }: BudgetCardProps) {
  const [budget, setBudget] = useState<BudgetTier>('$$');

  return (
    <div className="chat-card space-y-3">
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          {t('budget.label', language)}
        </label>
        <p className="text-xs text-muted-foreground">
          {t('budget.hint', language)}
        </p>
        <div className="flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <button
              key={b}
              onClick={() => setBudget(b)}
              className={`chip-button flex-1 ${budget === b ? 'chip-button-primary' : ''}`}
            >
              {getBudgetLabel(b, language)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onAction('budget_submit', { budget })}
          className="action-button action-button-primary flex-1"
        >
          {t('budget.btn.show_products', language)}
        </button>
        <button
          onClick={() => onAction('budget_skip')}
          className="action-button action-button-ghost"
        >
          {t('budget.btn.skip', language)}
        </button>
      </div>
    </div>
  );
}
