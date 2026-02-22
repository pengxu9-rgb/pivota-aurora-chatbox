import React, { useEffect, useMemo, useState } from 'react';
import type { SuggestedChip } from '@/lib/pivotaAgentBff';
import type { Language } from '@/lib/types';
import { t } from '@/lib/i18n';
import { OptionCardGroup, PromptFooter, PromptHeader } from '@/components/prompt';

type Step = 'skin_feel' | 'goal_primary' | 'sensitivity_flag' | 'opt_in_more' | 'routine_complexity' | 'rx_flag';

type Props = {
  language: Language;
  step: Step;
  disabled?: boolean;
  onChip: (chip: SuggestedChip) => void;
  onBack?: () => void;
};

const makeChip = (chip_id: string, label: string, questionId: string, answer: string): SuggestedChip => ({
  chip_id,
  label,
  kind: 'quick_reply',
  data: { quick_profile: { question_id: questionId, answer } },
});

const STEP_ORDER: Step[] = ['skin_feel', 'goal_primary', 'sensitivity_flag', 'opt_in_more', 'routine_complexity', 'rx_flag'];
const STEP_TOTAL = STEP_ORDER.length;
const STEP_INDEX: Record<Step, number> = {
  skin_feel: 1,
  goal_primary: 2,
  sensitivity_flag: 3,
  opt_in_more: 4,
  routine_complexity: 5,
  rx_flag: 6,
};

export function QuickProfileFlow({ language, step, disabled, onChip, onBack }: Props) {
  const model = useMemo(() => {
    if (step === 'skin_feel') {
      return {
        title: t('qp.title.quick_profile', language),
        question: t('qp.question.skin_feel', language),
        chips: [
          makeChip('qp.skin_feel.oily', t('qp.option.skin_feel.oily', language), 'skin_feel', 'oily'),
          makeChip('qp.skin_feel.dry', t('qp.option.skin_feel.dry', language), 'skin_feel', 'dry'),
          makeChip('qp.skin_feel.combination', t('qp.option.skin_feel.combination', language), 'skin_feel', 'combination'),
          makeChip('qp.skin_feel.unsure', t('qp.option.skin_feel.unsure', language), 'skin_feel', 'unsure'),
        ],
      } as const;
    }

    if (step === 'goal_primary') {
      return {
        title: t('qp.title.quick_profile', language),
        question: t('qp.question.goal_primary', language),
        chips: [
          makeChip('qp.goal.breakouts', t('qp.option.goal.breakouts', language), 'goal_primary', 'breakouts'),
          makeChip('qp.goal.brightening', t('qp.option.goal.brightening', language), 'goal_primary', 'brightening'),
          makeChip('qp.goal.antiaging', t('qp.option.goal.antiaging', language), 'goal_primary', 'antiaging'),
          makeChip('qp.goal.barrier', t('qp.option.goal.barrier', language), 'goal_primary', 'barrier'),
          makeChip('qp.goal.spf', t('qp.option.goal.spf', language), 'goal_primary', 'spf'),
          makeChip('qp.goal.other', t('qp.option.goal.other', language), 'goal_primary', 'other'),
        ],
      } as const;
    }

    if (step === 'sensitivity_flag') {
      return {
        title: t('qp.title.quick_profile', language),
        question: t('qp.question.sensitivity_flag', language),
        chips: [
          makeChip('qp.sens.yes', t('qp.option.sens.yes', language), 'sensitivity_flag', 'yes'),
          makeChip('qp.sens.no', t('qp.option.sens.no', language), 'sensitivity_flag', 'no'),
          makeChip('qp.sens.unsure', t('qp.option.sens.unsure', language), 'sensitivity_flag', 'unsure'),
        ],
      } as const;
    }

    if (step === 'opt_in_more') {
      return {
        title: t('qp.title.more_accuracy', language),
        question: t('qp.question.opt_in_more', language),
        chips: [
          makeChip('qp.more.yes', t('qp.option.more.yes', language), 'opt_in_more', 'yes'),
          makeChip('qp.more.no', t('qp.option.more.no', language), 'opt_in_more', 'no'),
        ],
      } as const;
    }

    if (step === 'routine_complexity') {
      return {
        title: t('qp.title.more_questions', language),
        question: t('qp.question.routine_complexity', language),
        chips: [
          makeChip('qp.routine.0_2', t('qp.option.routine.0_2', language), 'routine_complexity', '0-2'),
          makeChip('qp.routine.3_5', t('qp.option.routine.3_5', language), 'routine_complexity', '3-5'),
          makeChip('qp.routine.6_plus', t('qp.option.routine.6_plus', language), 'routine_complexity', '6+'),
        ],
      } as const;
    }

    return {
      title: t('qp.title.more_questions', language),
      question: t('qp.question.rx_flag', language),
      chips: [
        makeChip('qp.rx.yes', t('qp.option.rx.yes', language), 'rx_flag', 'yes'),
        makeChip('qp.rx.no', t('qp.option.rx.no', language), 'rx_flag', 'no'),
        makeChip('qp.rx.unsure', t('qp.option.rx.unsure', language), 'rx_flag', 'unsure'),
      ],
    } as const;
  }, [language, step]);

  const skipChip = useMemo(
    () => makeChip('qp.skip', t('prompt.common.notNow', language), 'skip', 'skip'),
    [language],
  );

  const [selectedChipId, setSelectedChipId] = useState<string>('');
  useEffect(() => {
    setSelectedChipId('');
  }, [step]);

  const selectedChip = useMemo(
    () => model.chips.find((chip) => chip.chip_id === selectedChipId) ?? null,
    [model.chips, selectedChipId],
  );

  const stepNumber = STEP_INDEX[step];

  return (
    <div className="chat-card-elevated space-y-3">
      <PromptHeader
        title={model.title}
        helper={model.question}
        language={language}
        step={{ current: stepNumber, total: STEP_TOTAL }}
        showBack={stepNumber > 1}
        onBack={disabled ? undefined : onBack}
      />

      <OptionCardGroup
        selectionMode="single"
        ariaLabel={model.question}
        options={model.chips.map((chip) => ({
          id: chip.chip_id,
          label: chip.label,
          disabled,
        }))}
        value={selectedChipId || null}
        onChange={(nextValue) => {
          if (disabled) return;
          if (typeof nextValue === 'string') setSelectedChipId(nextValue);
        }}
      />

      <PromptFooter
        language={language}
        primaryLabel={t('prompt.common.continue', language)}
        onPrimary={() => {
          if (disabled || !selectedChip) return;
          onChip(selectedChip);
        }}
        primaryDisabled={Boolean(disabled) || !selectedChip}
        tertiaryLabel={t('prompt.common.notNow', language)}
        onTertiary={() => {
          if (disabled) return;
          onChip(skipChip);
        }}
      />
    </div>
  );
}
