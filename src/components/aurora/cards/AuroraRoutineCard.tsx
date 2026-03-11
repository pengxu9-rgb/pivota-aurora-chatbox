import React from 'react';
import { Language } from '@/lib/types';
import { Sun, Moon, AlertTriangle, Check, ExternalLink, GitCompareArrows } from 'lucide-react';

export interface RoutineStep {
  category: string;
  product: {
    name: string;
    brand: string;
  };
  type: 'premium' | 'dupe';
  external?: boolean;
  disabled?: boolean;
  secondaryLabel?: string | null;
  summary?: string | null;
}

interface AuroraRoutineCardProps {
  amSteps: RoutineStep[];
  pmSteps: RoutineStep[];
  conflicts?: string[] | null;
  compatibility?: 'known' | 'unknown';
  compatibilitySummary?: string | null;
  language: Language;
  onAction?: (actionId: string) => void;
  onStepClick?: (step: RoutineStep, index: number, slot: 'am' | 'pm') => void;
  onStepSecondaryAction?: (step: RoutineStep, index: number, slot: 'am' | 'pm') => void;
}

export function AuroraRoutineCard({ 
  amSteps, 
  pmSteps, 
  conflicts,
  compatibility,
  compatibilitySummary,
  language,
  onAction,
  onStepClick,
  onStepSecondaryAction,
}: AuroraRoutineCardProps) {
  const categoryLabels: Record<string, { EN: string; CN: string }> = {
    cleanser: { EN: 'Cleanser', CN: '洁面' },
    treatment: { EN: 'Treatment', CN: '精华' },
    moisturizer: { EN: 'Moisturizer', CN: '保湿' },
    sunscreen: { EN: 'SPF', CN: '防晒' },
    mask: { EN: 'Mask', CN: '面膜' },
    toner: { EN: 'Toner', CN: '化妆水' },
    essence: { EN: 'Essence', CN: '精华水' },
    oil: { EN: 'Face oil', CN: '护肤油' },
  };

  const conflictsList = Array.isArray(conflicts) ? conflicts : null;

  const renderStep = (step: RoutineStep, idx: number, slot: 'am' | 'pm') => {
    const isClickable = Boolean(onStepClick) && step.disabled !== true;
    const hasSecondaryAction = Boolean(onStepSecondaryAction) && Boolean(step.secondaryLabel) && step.disabled !== true;
    return (
      <div
        key={`${slot}_${idx}_${step.product.brand}_${step.product.name}`}
        className={`rounded-lg border border-border/50 bg-muted/30 p-2 transition-colors ${
          isClickable ? 'cursor-pointer hover:bg-muted/50' : ''
        } ${step.disabled ? 'opacity-60' : ''}`}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        aria-disabled={step.disabled === true ? true : undefined}
        onClick={() => {
          if (!isClickable || !onStepClick) return;
          onStepClick(step, idx, slot);
        }}
        onKeyDown={(event) => {
          if (!isClickable || !onStepClick) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onStepClick(step, idx, slot);
        }}
      >
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-medium ${
            step.type === 'premium' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
          }`}>
            {idx + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-xs font-medium text-foreground">
                {step.product.brand}
              </p>
              {step.external ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  External
                </span>
              ) : null}
            </div>
            <p className="truncate text-[10px] text-muted-foreground">
              {step.product.name}
            </p>
            {step.summary ? (
              <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                {step.summary}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`signal-pill text-[10px] ${
              step.type === 'premium' ? 'signal-pill-warning' : 'signal-pill-success'
            }`}>
              {categoryLabels[step.category]?.[language] || step.category}
            </span>
            {hasSecondaryAction ? (
              <button
                type="button"
                className="chip-button inline-flex items-center gap-1 text-[11px]"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!onStepSecondaryAction) return;
                  onStepSecondaryAction(step, idx, slot);
                }}
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
                {step.secondaryLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="chat-card-elevated space-y-3">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <p className="section-label mb-1">
          {language === 'EN' ? 'ROUTINE & COMPATIBILITY' : '搭配与禁忌'}
        </p>
        <h3 className="text-sm font-semibold text-foreground">
          {language === 'EN' ? 'Your Personalized Routine' : '你的个性化护肤流程'}
        </h3>
      </div>

      {/* Conflicts Warning */}
      {compatibility === 'known' && conflictsList && conflictsList.length > 0 && (
        <div className="p-3 rounded-lg bg-risk/10 border border-risk/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-risk" />
            <span className="text-sm font-medium text-risk">
              ⚠️ {language === 'EN' ? 'Conflicts Detected' : '检测到冲突'}
            </span>
          </div>
          {compatibilitySummary ? (
            <div className="mb-2 text-xs text-risk/90">{compatibilitySummary}</div>
          ) : null}
          <ul className="space-y-1">
            {conflictsList.map((conflict, idx) => (
              <li key={idx} className="text-xs text-risk flex items-start gap-1">
                <span>•</span>
                <span>{conflict}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AM Routine */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-warning" />
          <span className="text-sm font-medium text-foreground">
            {language === 'EN' ? 'Morning Routine' : '早间护肤'}
          </span>
          <span className="text-xs text-muted-foreground">
            ({amSteps.length} {language === 'EN' ? 'steps' : '步'})
          </span>
        </div>
        <div className="space-y-1.5">
          {amSteps.map((step, idx) => renderStep(step, idx, 'am'))}
        </div>
      </div>

      {/* PM Routine */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {language === 'EN' ? 'Evening Routine' : '晚间护肤'}
          </span>
          <span className="text-xs text-muted-foreground">
            ({pmSteps.length} {language === 'EN' ? 'steps' : '步'})
          </span>
        </div>
        <div className="space-y-1.5">
          {pmSteps.map((step, idx) => renderStep(step, idx, 'pm'))}
        </div>
      </div>

      {/* Compatibility Check */}
      {compatibility === 'known' && conflictsList && conflictsList.length === 0 ? (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2">
          <Check className="w-4 h-4 text-success" />
          <div className="space-y-1">
            <span className="block text-sm text-success">
              {language === 'EN' 
                ? 'All products are compatible ✓' 
                : '所有产品均兼容 ✓'
              }
            </span>
            {compatibilitySummary ? (
              <span className="block text-xs text-success/90">{compatibilitySummary}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
