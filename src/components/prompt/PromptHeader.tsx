import type { HTMLAttributes } from 'react';
import { ChevronLeft } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/types';
import { cn } from '@/lib/utils';

type PromptStep = {
  current: number;
  total: number;
};

interface PromptHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  helper?: string;
  showBack?: boolean;
  onBack?: () => void;
  step?: PromptStep;
  language: Language;
  backLabel?: string;
}

export function PromptHeader({
  title,
  helper,
  showBack = false,
  onBack,
  step,
  language,
  backLabel,
  className,
  ...rest
}: PromptHeaderProps) {
  const stepLabel =
    step && step.total > 0
      ? t('prompt.common.stepOf', language, {
          current: Math.max(1, Math.min(step.current, step.total)),
          total: step.total,
        })
      : null;
  const progressValue = step && step.total > 0 ? Math.min(100, Math.max(0, (step.current / step.total) * 100)) : null;

  return (
    <header className={cn('prompt-header', className)} {...rest}>
      <div className="prompt-header-top">
        {showBack ? (
          <button
            type="button"
            className="prompt-back-button"
            onClick={onBack}
            aria-label={backLabel || t('prompt.common.back', language)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{backLabel || t('prompt.common.back', language)}</span>
          </button>
        ) : (
          <span className="h-8" aria-hidden="true" />
        )}
        {stepLabel ? <span className="prompt-step-label">{stepLabel}</span> : null}
      </div>

      {progressValue !== null ? (
        <Progress
          value={progressValue}
          className="prompt-progress"
          aria-label={stepLabel || t('prompt.common.stepOf', language, { current: 1, total: 1 })}
        />
      ) : null}

      <div className="space-y-1">
        <h2 className="prompt-title prompt-line-2">{title}</h2>
        {helper ? <p className="prompt-helper prompt-line-2">{helper}</p> : null}
      </div>
    </header>
  );
}

