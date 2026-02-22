import React, { useState } from 'react';
import { Language } from '@/lib/types';
import { t, getBudgetLabel } from '@/lib/i18n';
import { Wallet, TrendingDown, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';

interface AuroraBudgetCardProps {
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

type BudgetTier = '$' | '$$' | '$$$';

const BUDGETS: { tier: BudgetTier; icon: React.ReactNode; desc: { EN: string; CN: string } }[] = [
  { 
    tier: '$', 
    icon: <TrendingDown className="w-4 h-4" />,
    desc: { EN: 'Best value picks', CN: '性价比之选' }
  },
  { 
    tier: '$$', 
    icon: <Sparkles className="w-4 h-4" />,
    desc: { EN: 'Balanced quality', CN: '品质均衡' }
  },
  { 
    tier: '$$$', 
    icon: <TrendingUp className="w-4 h-4" />,
    desc: { EN: 'Premium experience', CN: '高端体验' }
  },
];

/**
 * @deprecated Legacy prompt implementation. Not wired in current `/chat` runtime.
 * Use the unified prompt system (`PromptHeader`/`PromptFooter`/`OptionCardGroup`) for new ask flows.
 */
export function AuroraBudgetCard({ onAction, language }: AuroraBudgetCardProps) {
  const [budget, setBudget] = useState<BudgetTier>('$$');

  return (
    <div className="chat-card-elevated space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="section-label">
            {language === 'EN' ? 'HIGH-LOW BUDGET' : 'HIGH-LOW 预算'}
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            {t('budget.intro', language)}
          </h3>
        </div>
      </div>

      {/* Strategy Explanation */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-xs text-foreground">
          {language === 'EN' 
            ? '💡 Strategy: Save on daily basics (cleanser, moisturizer), invest in high-efficacy treatments (serums, actives)'
            : '💡 策略：日常基础品平价，高效功效品升级'
          }
        </p>
      </div>

      {/* Budget Options */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {t('budget.label', language)}
        </label>
        <p className="text-xs text-muted-foreground">
          {t('budget.hint', language)}
        </p>
        <div className="space-y-2">
          {BUDGETS.map((b) => (
            <button
              key={b.tier}
              onClick={() => setBudget(b.tier)}
              className={`w-full p-3 rounded-lg border flex items-center justify-between transition-all ${
                budget === b.tier 
                  ? 'bg-primary/10 border-primary' 
                  : 'bg-muted/30 border-transparent hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  budget === b.tier ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {b.icon}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium ${
                    budget === b.tier ? 'text-primary' : 'text-foreground'
                  }`}>
                    {getBudgetLabel(b.tier, language)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.desc[language]}
                  </p>
                </div>
              </div>
              {budget === b.tier && (
                <div className="w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={() => onAction('budget_submit', { budget })}
          className="action-button action-button-primary w-full flex items-center justify-center gap-2"
        >
          {t('budget.btn.show_products', language)}
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onAction('budget_skip')}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('budget.btn.skip', language)}
        </button>
      </div>
    </div>
  );
}
