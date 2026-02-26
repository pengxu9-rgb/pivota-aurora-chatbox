import React from 'react';

import type { Language } from '@/lib/types';

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

type CandidateRow = {
  ingredient: string;
  reason: string;
  evidence_grade: string;
};

export function IngredientGoalMatchCard({
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
  const goalLabel = asString(root.goal_label) || (isCN ? '目标成分匹配' : 'Ingredient goal match');
  const sensitivityLabel = asString(root.sensitivity_label) || (isCN ? '未知' : 'Unknown');

  const candidates = asArray(root.candidate_ingredients)
    .map((item) => asObject(item))
    .filter(Boolean)
    .map((item) => ({
      ingredient: asString((item as any).ingredient) || 'ingredient',
      reason: asString((item as any).reason),
      evidence_grade: asString((item as any).evidence_grade) || 'unknown',
    })) as CandidateRow[];

  const avoidPairs = asArray(root.avoid_pairs)
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, 6);

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-foreground">
          {isCN ? `按功效匹配：${goalLabel}` : `Goal match: ${goalLabel}`}
        </div>
        <div className="text-xs text-muted-foreground">
          {isCN ? `敏感度：${sensitivityLabel}` : `Sensitivity: ${sensitivityLabel}`}
        </div>
      </div>

      <div className="space-y-2">
        {candidates.length ? (
          candidates.slice(0, 5).map((row) => (
            <div key={`${row.ingredient}_${row.reason}`} className="rounded-xl border border-border/60 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">{row.ingredient}</div>
                <div className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {isCN ? `证据 ${row.evidence_grade}` : `Evidence ${row.evidence_grade}`}
                </div>
              </div>
              {row.reason ? <div className="mt-1 text-xs text-muted-foreground">{row.reason}</div> : null}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
            {isCN ? '暂未识别到可匹配目标，请换一个功效目标。' : 'No matched goal yet. Try another target.'}
          </div>
        )}
      </div>

      {avoidPairs.length ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-3">
          <div className="text-xs font-semibold text-amber-800">{isCN ? '避坑组合' : 'Avoid pairs'}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-900">
            {avoidPairs.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="action-button action-button-primary"
          onClick={() =>
            onAction('chip.start.reco_products', {
              trigger_source: 'ingredient_goal_match',
              reply_text: isCN ? '基于这些成分给我看产品。' : 'Show products based on these ingredients.',
            })
          }
        >
          {isCN ? '去看产品（可选）' : 'See products (optional)'}
        </button>
        <button
          type="button"
          className="action-button action-button-ghost"
          onClick={() =>
            onAction('ingredient.lookup', {
              entry_source: 'ingredient_goal_match',
              reply_text: isCN ? '我还想查一个具体成分。' : 'I want to lookup a specific ingredient next.',
            })
          }
        >
          {isCN ? '再查一个成分' : 'Lookup another ingredient'}
        </button>
      </div>
    </div>
  );
}
