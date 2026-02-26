import React, { useMemo, useState } from 'react';

import type { Language } from '@/lib/types';

type GoalOption = {
  id: string;
  label_en: string;
  label_cn: string;
};

type SensitivityOption = {
  id: 'low' | 'medium' | 'high' | 'unknown';
  label_en: string;
  label_cn: string;
};

const DEFAULT_GOALS: GoalOption[] = [
  { id: 'acne', label_en: 'Acne / texture', label_cn: '祛痘/闭口' },
  { id: 'brightening', label_en: 'Brightening / spots', label_cn: '提亮/淡斑' },
  { id: 'barrier', label_en: 'Barrier repair', label_cn: '修护屏障' },
  { id: 'antiaging', label_en: 'Anti-aging', label_cn: '抗老/细纹' },
  { id: 'hydration', label_en: 'Hydration', label_cn: '保湿补水' },
];

const SENSITIVITY_OPTIONS: SensitivityOption[] = [
  { id: 'unknown', label_en: 'Unknown', label_cn: '不确定' },
  { id: 'low', label_en: 'Low', label_cn: '低敏' },
  { id: 'medium', label_en: 'Medium', label_cn: '中敏' },
  { id: 'high', label_en: 'High', label_cn: '高敏' },
];

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

export function IngredientHubCard({
  payload,
  language,
  onAction,
}: {
  payload: Record<string, unknown>;
  language: Language;
  onAction: (actionId: string, data?: Record<string, any>) => void;
}) {
  const isCN = language === 'CN';
  const root = asObject(payload) || {};
  const title = asString(root.title) || (isCN ? '成分查询入口' : 'Ingredient Hub');
  const subtitle =
    asString(root.subtitle) ||
    (isCN
      ? '先查成分，或按功效找成分；诊断只在你需要时再开启。'
      : 'Start with ingredient lookup or goal-based matching. Diagnosis stays optional.');

  const [lookupQuery, setLookupQuery] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<string>('acne');
  const [selectedSensitivity, setSelectedSensitivity] = useState<SensitivityOption['id']>('unknown');

  const goals = useMemo(() => {
    const source = Array.isArray((root as any).suggested_goals) ? (root as any).suggested_goals : [];
    if (!source.length) return DEFAULT_GOALS;
    const mapped = source
      .map((item: unknown, idx: number) => {
        const text = asString(item);
        if (!text) return null;
        const lower = text.toLowerCase();
        const matched = DEFAULT_GOALS.find(
          (goal) =>
            lower.includes(goal.id) ||
            lower.includes(goal.label_en.toLowerCase()) ||
            lower.includes(goal.label_cn.toLowerCase()),
        );
        if (matched) return matched;
        return {
          id: `goal_${idx + 1}`,
          label_en: text,
          label_cn: text,
        } as GoalOption;
      })
      .filter(Boolean) as GoalOption[];
    return mapped.length ? mapped : DEFAULT_GOALS;
  }, [root]);

  const submitLookup = () => {
    const query = lookupQuery.trim();
    if (!query) return;
    onAction('ingredient.lookup', {
      ingredient_query: query,
      entry_source: 'ingredient_hub',
      reply_text: isCN
        ? `请做成分查询：${query}。给我 1-minute ingredient report（功效、证据等级、注意事项、人群风险）。`
        : `Ingredient lookup: ${query}. Give me a 1-minute ingredient report (benefits, evidence grade, watchouts, risk by profile).`,
    });
  };

  const submitByGoal = () => {
    onAction('ingredient.by_goal', {
      goal: selectedGoal,
      sensitivity: selectedSensitivity,
      entry_source: 'ingredient_hub',
      reply_text: isCN
        ? `按功效找成分：目标=${selectedGoal}，敏感度=${selectedSensitivity}。`
        : `Find ingredients by goal: goal=${selectedGoal}, sensitivity=${selectedSensitivity}.`,
    });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
        <div className="text-xs font-semibold text-muted-foreground">{isCN ? '查具体成分' : 'Lookup ingredient'}</div>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder={isCN ? '例如：niacinamide / 烟酰胺' : 'e.g. niacinamide / azelaic acid'}
            value={lookupQuery}
            onChange={(event) => setLookupQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitLookup();
              }
            }}
          />
          <button
            type="button"
            className="action-button action-button-primary"
            disabled={!lookupQuery.trim()}
            onClick={submitLookup}
          >
            {isCN ? '查询' : 'Lookup'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/60 p-3">
        <div className="text-xs font-semibold text-muted-foreground">{isCN ? '按功效找成分' : 'Find by goal'}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {goals.map((goal) => {
            const active = goal.id === selectedGoal;
            return (
              <button
                key={goal.id}
                type="button"
                className={`chip-button ${active ? 'chip-button-primary' : ''}`}
                onClick={() => setSelectedGoal(goal.id)}
              >
                {isCN ? goal.label_cn : goal.label_en}
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">{isCN ? '敏感度' : 'Sensitivity'}</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {SENSITIVITY_OPTIONS.map((opt) => {
            const active = opt.id === selectedSensitivity;
            return (
              <button
                key={opt.id}
                type="button"
                className={`chip-button ${active ? 'chip-button-primary' : ''}`}
                onClick={() => setSelectedSensitivity(opt.id)}
              >
                {isCN ? opt.label_cn : opt.label_en}
              </button>
            );
          })}
        </div>

        <button type="button" className="action-button action-button-primary mt-3" onClick={submitByGoal}>
          {isCN ? '生成候选成分' : 'Match ingredients'}
        </button>
      </div>

      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        onClick={() =>
          onAction('ingredient.optin_diagnosis', {
            entry_source: 'ingredient_hub',
            reply_text: isCN ? '我想开始诊断来提高成分推荐准确度。' : 'I want to start diagnosis to improve ingredient precision.',
          })
        }
      >
        {isCN ? '提高准确度（可选）' : 'Improve accuracy (optional)'}
      </button>
    </div>
  );
}
