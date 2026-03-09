import React from 'react';
import type { Language } from '@/lib/types';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type Dict = Record<string, unknown>;

const asString = (v: unknown): string => (v == null ? '' : String(v).trim());
const asNumber = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asObject = (v: unknown): Dict | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : null;
const clampScore = (value: number): number => Math.max(0, Math.min(1, value));

type DimensionScore = { score: number; note: string };

const FIT_CONFIG = {
  good_match: { icon: CheckCircle2, colorClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/40' },
  partial_match: { icon: AlertTriangle, colorClass: 'text-amber-600 dark:text-amber-400', bgClass: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40' },
  needs_adjustment: { icon: XCircle, colorClass: 'text-red-600 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40' },
} as const;

const fitLabel = (fit: string, lang: Language) => {
  const labels: Record<string, Record<Language, string>> = {
    good_match: { EN: 'Good match', CN: '匹配良好' },
    partial_match: { EN: 'Partial match', CN: '部分匹配' },
    needs_adjustment: { EN: 'Needs adjustment', CN: '需要调整' },
  };
  return labels[fit]?.[lang] || fit;
};

const DIMENSION_LABELS: Record<string, Record<Language, string>> = {
  ingredient_match: { EN: 'Ingredient match', CN: '成分匹配' },
  routine_completeness: { EN: 'Routine completeness', CN: '流程完整度' },
  conflict_risk: { EN: 'Conflict risk', CN: '冲突风险' },
  sensitivity_safety: { EN: 'Sensitivity safety', CN: '敏感安全性' },
};

function ScoreBar({ score, label, note, language }: { score: number; label: string; note: string; language: Language }) {
  const pct = Math.round(clampScore(score) * 100);
  const barColor =
    pct >= 70 ? 'bg-emerald-500 dark:bg-emerald-400' :
    pct >= 40 ? 'bg-amber-500 dark:bg-amber-400' :
    'bg-red-500 dark:bg-red-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{DIMENSION_LABELS[label]?.[language] || label}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {note ? <div className="text-[11px] text-muted-foreground">{note}</div> : null}
    </div>
  );
}

export function RoutineFitSummaryCard({
  payload,
  language,
  onAction,
}: {
  payload: unknown;
  language: Language;
  onAction?: (actionId: string, data?: Record<string, unknown>) => void;
}) {
  const root = asObject(payload) || {};
  const overallFit = asString(root.overall_fit) || 'partial_match';
  const fitScore = clampScore(asNumber(root.fit_score) ?? 0.5);
  const summary = asString(root.summary);
  const highlights = asArray(root.highlights).map(asString).filter(Boolean).slice(0, 3);
  const concerns = asArray(root.concerns).map(asString).filter(Boolean).slice(0, 3);
  const dims = asObject(root.dimension_scores) || {};
  const nextQuestions = asArray(root.next_questions).map(asString).filter(Boolean).slice(0, 3);

  const config = FIT_CONFIG[overallFit as keyof typeof FIT_CONFIG] || FIT_CONFIG.partial_match;
  const Icon = config.icon;
  const scorePct = Math.round(fitScore * 100);

  const dimensionKeys = ['ingredient_match', 'routine_completeness', 'conflict_risk', 'sensitivity_safety'] as const;
  const dimensions: Array<{ key: string; score: number; note: string }> = dimensionKeys.map((key) => {
    const d = asObject(dims[key]);
    return { key, score: clampScore(asNumber(d?.score) ?? 0.5), note: asString(d?.note) };
  });

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div className={`flex items-center gap-3 rounded-xl border p-3 ${config.bgClass}`}>
        <Icon className={`h-6 w-6 flex-shrink-0 ${config.colorClass}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${config.colorClass}`}>
              {language === 'CN' ? 'Routine 匹配度' : 'Routine fit'}
            </span>
            <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
              {fitLabel(overallFit, language)} · {scorePct}%
            </span>
          </div>
          {summary ? <div className="mt-1 text-sm text-foreground/80">{summary}</div> : null}
        </div>
      </div>

      {dimensions.length ? (
        <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="text-xs font-semibold text-muted-foreground">
            {language === 'CN' ? '维度评分' : 'Dimension scores'}
          </div>
          {dimensions.map((d) => (
            <ScoreBar key={d.key} score={d.score} label={d.key} note={d.note} language={language} />
          ))}
        </div>
      ) : null}

      {highlights.length ? (
        <div>
          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {language === 'CN' ? '做得好的地方' : 'What you\'re doing well'}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
      ) : null}

      {concerns.length ? (
        <div>
          <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {language === 'CN' ? '值得关注' : 'Worth watching'}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {concerns.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      ) : null}

      {nextQuestions.length ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {nextQuestions.map((q) => (
            <button
              key={q}
              type="button"
              className="chip-button text-[11px]"
              onClick={() =>
                onAction?.('chip.aurora.next_action.routine_deep_dive', {
                  reply_text: q,
                  trigger_source: 'routine_fit_summary',
                })
              }
            >
              {q}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
