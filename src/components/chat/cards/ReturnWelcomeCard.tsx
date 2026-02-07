import React, { useMemo } from 'react';
import type { SuggestedChip } from '@/lib/pivotaAgentBff';
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
  const isCN = language === 'CN';

  const map: Record<string, { en: string; cn: string }> = {
    breakouts: { en: 'Breakouts', cn: '控痘/闭口' },
    acne: { en: 'Breakouts', cn: '控痘/闭口' },
    brightening: { en: 'Brightening', cn: '提亮/淡斑' },
    antiaging: { en: 'Anti-aging', cn: '抗老' },
    barrier: { en: 'Barrier repair', cn: '修护屏障' },
    spf: { en: 'SPF / sun', cn: '防晒' },
    other: { en: 'Other', cn: '其他' },
  };

  const hit = map[norm];
  if (hit) return isCN ? hit.cn : hit.en;
  return raw.trim();
};

const joinList = (items: string[] | null | undefined, empty: string) => {
  if (!items || !items.length) return empty;
  return items.join(' · ');
};

export function ReturnWelcomeCard({ language, summary, chips, onChip, disabled }: Props) {
  const text = useMemo(() => {
    const empty = language === 'CN' ? '—' : '—';
    const goal = summary?.goal_primary ? formatGoalPrimary(summary.goal_primary, language) : empty;
    const am = joinList(summary?.plan_am_short, empty);
    const pm = joinList(summary?.plan_pm_short, empty);
    const sens = joinList(summary?.sensitivities, empty);
    const days = typeof summary?.days_since_last === 'number' ? String(summary.days_since_last) : empty;
    return { goal, am, pm, sens, days };
  }, [language, summary]);

  return (
    <div className="chat-card-elevated space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '欢迎回来' : 'Welcome back'}</div>
        <div className="text-sm text-muted-foreground">
          {language === 'CN' ? `上次我们在做：${text.goal}` : `Last time we were working on: ${text.goal}`}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground">
        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {language === 'CN' ? '你的当前方案' : 'Your current plan'}
            </span>
            <div className="mt-1">
              <span className="font-medium">AM</span> {text.am} <span className="mx-1 text-muted-foreground">/</span>{' '}
              <span className="font-medium">PM</span> {text.pm}
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '敏感点' : 'Sensitivities'}</span>
            <div className="mt-1">{text.sens}</div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {language === 'CN' ? '距离上次' : 'Days since last'}
            </span>
            <div className="mt-1">{language === 'CN' ? `${text.days} 天` : `${text.days} days`}</div>
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
