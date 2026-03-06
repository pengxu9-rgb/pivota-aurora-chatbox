import React, { useEffect, useRef } from 'react';
import type { DiagnosisV2ThinkingStep, Language } from '@/lib/types';

interface Props {
  steps: DiagnosisV2ThinkingStep[];
  language: Language;
}

const STAGE_LABELS: Record<string, { CN: string; EN: string }> = {
  goal_understanding: { CN: '理解你的护肤目标', EN: 'Understanding your goals' },
  inference: { CN: '分析皮肤状态', EN: 'Analyzing skin state' },
  strategy: { CN: '制定个性化策略', EN: 'Creating your strategy' },
};

const STAGE_ORDER = ['goal_understanding', 'inference', 'strategy'] as const;

function StatusIcon({ status }: { status: DiagnosisV2ThinkingStep['status'] }) {
  if (status === 'done') {
    return <span className="text-sm text-green-500">&#10003;</span>;
  }
  if (status === 'in_progress') {
    return <span className="inline-block h-3 w-3 rounded-full bg-primary animate-pulse" />;
  }
  return <span className="text-xs text-muted-foreground opacity-50">&#9711;</span>;
}

export function DiagnosisV2ThinkingCard({ steps, language }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  const stepsByStage = STAGE_ORDER.map((stageKey) => ({
    stageKey,
    label: STAGE_LABELS[stageKey]?.[language] || stageKey,
    stageSteps: steps.filter((step) => step.stage === stageKey),
  }));

  const activeStageIndex = stepsByStage.findIndex((section) => section.stageSteps.some((step) => step.status === 'in_progress'));

  const getStageStatus = (stageSteps: DiagnosisV2ThinkingStep[]) => {
    if (stageSteps.some((step) => step.status === 'in_progress')) return 'in_progress';
    if (stageSteps.length > 0 && stageSteps.every((step) => step.status === 'done')) return 'done';
    return 'pending';
  };

  return (
    <div className="chat-card space-y-3 animate-in fade-in duration-300">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {language === 'CN' ? '正在为你深度分析...' : 'Deep analysis in progress...'}
      </p>

      <div ref={scrollRef} className="max-h-64 space-y-3 overflow-y-auto">
        {stepsByStage.map(({ stageKey, label, stageSteps }, idx) => {
          const stageStatus = getStageStatus(stageSteps);
          const isPast = idx < (activeStageIndex >= 0 ? activeStageIndex : stepsByStage.length);

          return (
            <div key={stageKey} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <StatusIcon status={stageStatus} />
                <span
                  className={`text-sm font-medium transition-opacity duration-300 ${
                    stageStatus === 'pending' && !isPast ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  {label}
                </span>
              </div>

              {stageSteps
                .filter((step) => step.status === 'done' || step.status === 'in_progress')
                .map((step, index) => (
                  <div
                    key={`${stageKey}-${index}`}
                    className="ml-5 animate-in border-l-2 border-muted pl-3 fade-in transition-opacity duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <p className="text-xs leading-relaxed text-muted-foreground">{step.text}</p>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
