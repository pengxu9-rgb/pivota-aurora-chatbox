import React, { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  DiagnosisV2ImprovementTip,
  DiagnosisV2InferredAxis,
  DiagnosisV2ResultPayload,
  DiagnosisV2Strategy,
  Language,
} from '@/lib/types';

type Props = {
  payload: DiagnosisV2ResultPayload;
  language: Language;
  onAction: (actionId: string, data?: Record<string, any>) => void;
};

const AXIS_LABELS: Record<string, Record<Language, string>> = {
  barrier_irritation_risk: { EN: 'Barrier irritation risk', CN: '屏障刺激风险' },
  hydration_level: { EN: 'Hydration level', CN: '保湿水平' },
  sensitivity: { EN: 'Sensitivity', CN: '敏感度' },
  oiliness: { EN: 'Oiliness', CN: '油脂' },
  pigmentation: { EN: 'Pigmentation', CN: '色素沉着' },
  barrier_integrity: { EN: 'Barrier integrity', CN: '屏障完整性' },
  inflammation_risk: { EN: 'Inflammation risk', CN: '炎症风险' },
  dryness: { EN: 'Dryness', CN: '干燥度' },
  redness: { EN: 'Redness', CN: '泛红' },
  acne_risk: { EN: 'Acne risk', CN: '痘痘风险' },
};

const LEVEL_COLORS: Record<string, string> = {
  low: 'bg-emerald-500',
  moderate: 'bg-amber-500',
  high: 'bg-orange-500',
  severe: 'bg-red-500',
};

const LEVEL_BG_COLORS: Record<string, string> = {
  low: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  moderate: 'border-amber-200 bg-amber-100 text-amber-800',
  high: 'border-orange-200 bg-orange-100 text-orange-800',
  severe: 'border-red-200 bg-red-100 text-red-800',
};

const TREND_CONFIG = {
  improved: { icon: ArrowDown, color: 'text-emerald-600', label: { EN: 'Improved', CN: '改善' } },
  stable: { icon: Minus, color: 'text-slate-500', label: { EN: 'Stable', CN: '稳定' } },
  worsened: { icon: ArrowUp, color: 'text-red-600', label: { EN: 'Worsened', CN: '加重' } },
  new: { icon: null, color: '', label: { EN: 'New', CN: '新增' } },
};

const LEVEL_LABELS: Record<string, Record<Language, string>> = {
  low: { EN: 'Low', CN: '低' },
  moderate: { EN: 'Moderate', CN: '中' },
  high: { EN: 'High', CN: '高' },
  severe: { EN: 'Severe', CN: '严重' },
};

function translateAxis(axis: string, language: Language): string {
  const key = axis.toLowerCase().replace(/\s+/g, '_');
  return AXIS_LABELS[key]?.[language] ?? axis.replace(/_/g, ' ');
}

function AxisBar({ axis, language }: { axis: DiagnosisV2InferredAxis; language: Language }) {
  const [expanded, setExpanded] = useState(false);
  const levelOrder = ['low', 'moderate', 'high', 'severe'];
  const levelIndex = levelOrder.indexOf(axis.level);
  const fillPercent = ((levelIndex + 1) / 4) * 100;
  const TrendIcon = axis.trend !== 'new' ? TREND_CONFIG[axis.trend]?.icon : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{translateAxis(axis.axis, language)}</span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs font-medium',
              LEVEL_BG_COLORS[axis.level] ?? 'border-slate-200 bg-slate-100 text-slate-700',
            )}
          >
            {LEVEL_LABELS[axis.level]?.[language] ?? axis.level}
          </span>
          <span className="rounded bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700">
            {Math.round(axis.confidence * 100)}%
          </span>
          {axis.trend !== 'new' && TrendIcon && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn('inline-flex', TREND_CONFIG[axis.trend]?.color)}>
                    <TrendIcon className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {TREND_CONFIG[axis.trend]?.label[language]}{' '}
                    {axis.previous_level && `(${LEVEL_LABELS[axis.previous_level]?.[language] ?? axis.previous_level})`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn('h-full rounded-full transition-all', LEVEL_COLORS[axis.level] ?? 'bg-slate-400')}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      {axis.evidence && axis.evidence.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {language === 'CN' ? '证据' : 'Evidence'}
          </button>
          {expanded && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
              {axis.evidence.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function DiagnosisV2ResultCard({ payload, language, onAction }: Props) {
  const [inferredExpanded, setInferredExpanded] = useState(!payload.is_cold_start);
  const [improvementExpanded, setImprovementExpanded] = useState(true);

  const goals = payload.goal_profile?.selected_goals ?? [];
  const axes = payload.inferred_state?.axes ?? [];
  const strategies = payload.strategies ?? [];
  const blueprint = payload.routine_blueprint ?? { am_steps: [], pm_steps: [], conflict_rules: [] };
  const dataQuality = payload.data_quality ?? { overall: 'high' };
  const improvementPath = payload.improvement_path ?? [];
  const nextActions = payload.next_actions ?? [];

  const showDataQualityBanner = dataQuality.overall !== 'high' && dataQuality.limits_banner;

  return (
    <div className="chat-card space-y-4">
      {goals.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {language === 'CN' ? '目标标签' : 'Goal Profile'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {goals.map((goal) => (
              <span key={goal} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {goal.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <button type="button" onClick={() => setInferredExpanded(!inferredExpanded)} className="flex w-full items-center justify-between text-left">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {language === 'CN' ? '推断状态' : 'Inferred State'}
          </h3>
          {payload.is_cold_start && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              {language === 'CN' ? '初始评估，数据有限' : 'Initial assessment, limited data'}
            </span>
          )}
          {inferredExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </button>
        {inferredExpanded && (
          <div className="mt-3 space-y-2">
            {payload.is_cold_start && (
              <p className="text-xs text-slate-500">
                {language === 'CN'
                  ? '初始评估，数据有限。补充照片或产品信息后可获得更准确的推断。'
                  : 'Initial assessment with limited data. Add photos or product info for more accurate inference.'}
              </p>
            )}
            {axes.map((axis, index) => (
              <AxisBar key={`${axis.axis}_${index}`} axis={axis} language={language} />
            ))}
          </div>
        )}
      </section>

      {strategies.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {language === 'CN' ? '策略建议' : 'Strategies'}
          </h3>
          <div className="space-y-3">
            {strategies.slice(0, 3).map((strategy: DiagnosisV2Strategy, index: number) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="font-semibold text-slate-900">{strategy.title}</h4>
                {strategy.why && <p className="mt-1 text-sm text-slate-600">{strategy.why}</p>}
                {strategy.timeline && <p className="mt-1 text-xs text-slate-500">{strategy.timeline}</p>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {strategy.do_list?.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-emerald-700">{language === 'CN' ? '建议' : 'Do'}</p>
                      <ul className="space-y-1">
                        {strategy.do_list.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex items-start gap-2 text-sm text-slate-700">
                            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {strategy.avoid_list?.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-red-700">{language === 'CN' ? '避免' : 'Avoid'}</p>
                      <ul className="space-y-1">
                        {strategy.avoid_list.map((item, itemIndex) => (
                          <li key={itemIndex} className="flex items-start gap-2 text-sm text-slate-700">
                            <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(blueprint.am_steps?.length > 0 || blueprint.pm_steps?.length > 0) && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {language === 'CN' ? '早晚流程' : 'AM/PM Blueprint'}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {blueprint.am_steps?.length > 0 && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <h4 className="mb-2 text-sm font-semibold text-amber-900">{language === 'CN' ? '晨间' : 'AM'}</h4>
                <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-800">
                  {blueprint.am_steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            {blueprint.pm_steps?.length > 0 && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <h4 className="mb-2 text-sm font-semibold text-indigo-900">{language === 'CN' ? '晚间' : 'PM'}</h4>
                <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-800">
                  {blueprint.pm_steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
          {blueprint.conflict_rules?.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-1 text-xs font-medium text-slate-600">{language === 'CN' ? '注意事项' : 'Conflict rules'}</p>
              <ul className="list-disc space-y-0.5 pl-4 text-sm text-slate-700">
                {blueprint.conflict_rules.map((rule, index) => (
                  <li key={index}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {showDataQualityBanner && (
        <section>
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900">
            {dataQuality.limits_banner}
          </div>
        </section>
      )}

      {improvementPath.length > 0 && (
        <section>
          <button type="button" onClick={() => setImprovementExpanded(!improvementExpanded)} className="flex w-full items-center justify-between text-left">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {language === 'CN' ? '改善路径' : 'Improvement Path'}
            </h3>
            {improvementExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>
          {improvementExpanded && (
            <div className="mt-3 space-y-3">
              {improvementPath.map((tip: DiagnosisV2ImprovementTip, index: number) => (
                <div key={index} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="text-sm text-slate-800">{tip.tip}</p>
                  <button
                    type="button"
                    onClick={() => onAction(tip.action_type, { tip })}
                    className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    {tip.action_label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {nextActions.length > 0 && (
        <section className="pt-2">
          <div className="flex flex-wrap gap-2">
            {nextActions.map((action, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onAction(action.type, action.payload)}
                className={cn(
                  'rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                  index === 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default DiagnosisV2ResultCard;
