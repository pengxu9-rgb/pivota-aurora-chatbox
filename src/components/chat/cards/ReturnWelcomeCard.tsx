import React, { useMemo } from 'react';
import type { SuggestedChip } from '@/lib/pivotaAgentBff';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/types';
import type { ReturnWelcomeSummary } from '@/lib/returnWelcomeSummary';

type Props = {
  language: Language;
  summary: ReturnWelcomeSummary | null;
  chips: SuggestedChip[];
  onChip: (chip: SuggestedChip) => void;
  disabled?: boolean;
};

const formatGoalPrimary = (raw: string, language: Language) => {
  const norm = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    breakouts: 'return_welcome.goal.breakouts',
    acne: 'return_welcome.goal.breakouts',
    brightening: 'return_welcome.goal.brightening',
    antiaging: 'return_welcome.goal.antiaging',
    barrier: 'return_welcome.goal.barrier',
    spf: 'return_welcome.goal.spf',
    other: 'return_welcome.goal.other',
  };

  const key = map[norm];
  if (key) return t(key, language);
  return raw.trim();
};

const joinList = (items: string[] | null | undefined, empty: string) => {
  if (!items || !items.length) return empty;
  return items.join(' · ');
};

export function ReturnWelcomeCard({ language, summary, chips, onChip, disabled }: Props) {
  const text = useMemo(() => {
    const empty = '—';
    const goal = summary?.goal_primary ? formatGoalPrimary(summary.goal_primary, language) : empty;
    const am = joinList(summary?.plan_am_short, empty);
    const pm = joinList(summary?.plan_pm_short, empty);
    const sens = joinList(summary?.sensitivities, empty);
    const days = typeof summary?.days_since_last === 'number' ? String(summary.days_since_last) : empty;
    return { goal, am, pm, sens, days };
  }, [language, summary]);

  return (
    <div className="chat-card-elevated space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{t('return_welcome.title', language)}</div>
        <div className="text-sm text-muted-foreground">
          {t('return_welcome.subtitle', language, { goal: text.goal })}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground">
        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t('return_welcome.current_plan', language)}
            </span>
            <div className="mt-1">
              <span className="font-medium">AM</span> {text.am} <span className="mx-1 text-muted-foreground">/</span>{' '}
              <span className="font-medium">PM</span> {text.pm}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">{t('return_welcome.sensitivities', language)}</span>
            <div className="mt-1">{text.sens}</div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {t('return_welcome.days_since_last', language)}
            </span>
            <div className="mt-1">
              {text.days === '—' ? text.days : t('return_welcome.days_value', language, { count: text.days })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.chip_id}
            type="button"
            className="chip-button"
            onClick={() => onChip(chip)}
            disabled={disabled}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
