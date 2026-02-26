import React, { useMemo } from 'react';
import type { SuggestedChip } from '@/lib/pivotaAgentBff';
import type { Language } from '@/lib/types';

type Step = 'skin_feel' | 'goal_primary' | 'sensitivity_flag' | 'opt_in_more' | 'routine_complexity' | 'rx_flag';

type Props = {
  language: Language;
  step: Step;
  disabled?: boolean;
  onChip: (chip: SuggestedChip) => void;
};

const makeChip = (chip_id: string, label: string, questionId: string, answer: string): SuggestedChip => ({
  chip_id,
  label,
  kind: 'quick_reply',
  data: { quick_profile: { question_id: questionId, answer } },
});

export function QuickProfileFlow({ language, step, disabled, onChip }: Props) {
  const isCN = language === 'CN';
  const progress = useMemo(() => {
    switch (step) {
      case 'skin_feel':
        return { current: 1, total: 4 };
      case 'goal_primary':
        return { current: 2, total: 4 };
      case 'sensitivity_flag':
        return { current: 3, total: 4 };
      case 'opt_in_more':
        return { current: 4, total: 4 };
      case 'routine_complexity':
        return { current: 5, total: 6 };
      case 'rx_flag':
      default:
        return { current: 6, total: 6 };
    }
  }, [step]);

  const model = useMemo(() => {
    if (step === 'skin_feel') {
      return {
        title: isCN ? '30 秒快速画像' : '30-sec quick profile',
        question: isCN ? '洗完脸几小时后，皮肤通常感觉？' : 'A few hours after cleansing, your skin usually feels…',
        chips: [
          makeChip('qp.skin_feel.oily', isCN ? '偏油' : 'Oily', 'skin_feel', 'oily'),
          makeChip('qp.skin_feel.dry', isCN ? '偏干' : 'Dry', 'skin_feel', 'dry'),
          makeChip('qp.skin_feel.combination', isCN ? '混合' : 'Combination', 'skin_feel', 'combination'),
          makeChip('qp.skin_feel.unsure', isCN ? '不确定' : 'Not sure', 'skin_feel', 'unsure'),
        ],
      } as const;
    }

    if (step === 'goal_primary') {
      return {
        title: isCN ? '30 秒快速画像' : '30-sec quick profile',
        question: isCN ? '你这次最想优先解决什么？' : "What’s your #1 goal right now?",
        chips: [
          makeChip('qp.goal.breakouts', isCN ? '控痘/闭口' : 'Breakouts', 'goal_primary', 'breakouts'),
          makeChip('qp.goal.brightening', isCN ? '提亮/淡斑' : 'Brightening', 'goal_primary', 'brightening'),
          makeChip('qp.goal.antiaging', isCN ? '抗老' : 'Anti-aging', 'goal_primary', 'antiaging'),
          makeChip('qp.goal.barrier', isCN ? '修护屏障' : 'Barrier repair', 'goal_primary', 'barrier'),
          makeChip('qp.goal.spf', isCN ? '防晒' : 'SPF / sun', 'goal_primary', 'spf'),
          makeChip('qp.goal.other', isCN ? '其他' : 'Other', 'goal_primary', 'other'),
        ],
      } as const;
    }

    if (step === 'sensitivity_flag') {
      return {
        title: isCN ? '30 秒快速画像' : '30-sec quick profile',
        question: isCN ? '你觉得自己属于敏感肌吗？' : 'Do you consider your skin sensitive?',
        chips: [
          makeChip('qp.sens.yes', isCN ? '是' : 'Yes', 'sensitivity_flag', 'yes'),
          makeChip('qp.sens.no', isCN ? '不是' : 'No', 'sensitivity_flag', 'no'),
          makeChip('qp.sens.unsure', isCN ? '不确定' : 'Not sure', 'sensitivity_flag', 'unsure'),
        ],
      } as const;
    }

    if (step === 'opt_in_more') {
      return {
        title: isCN ? '再问两个更准？' : 'Two more for accuracy?',
        question: isCN ? '要不要再问两个问题，更准一点？' : 'Want 2 more questions to make this more accurate?',
        chips: [
          makeChip('qp.more.yes', isCN ? '再问两个更准' : 'Ask 2 more', 'opt_in_more', 'yes'),
          makeChip('qp.more.no', isCN ? '先这样' : 'Finish', 'opt_in_more', 'no'),
        ],
      } as const;
    }

    if (step === 'routine_complexity') {
      return {
        title: isCN ? '再问两个更准' : 'Two more questions',
        question: isCN ? '你日常大概用几步？' : 'How many products/steps do you use regularly?',
        chips: [
          makeChip('qp.routine.0_2', isCN ? '0–2 步' : '0–2', 'routine_complexity', '0-2'),
          makeChip('qp.routine.3_5', isCN ? '3–5 步' : '3–5', 'routine_complexity', '3-5'),
          makeChip('qp.routine.6_plus', isCN ? '6+ 步' : '6+', 'routine_complexity', '6+'),
        ],
      } as const;
    }

    return {
      title: isCN ? '再问两个更准' : 'Two more questions',
      question: isCN ? '你是否在用处方药膏/维A类？（不需要具体名字）' : 'Do you use any prescription skin meds or retinoids?',
      chips: [
        makeChip('qp.rx.yes', isCN ? '是' : 'Yes', 'rx_flag', 'yes'),
        makeChip('qp.rx.no', isCN ? '不是' : 'No', 'rx_flag', 'no'),
        makeChip('qp.rx.unsure', isCN ? '不确定' : 'Not sure', 'rx_flag', 'unsure'),
      ],
    } as const;
  }, [isCN, step]);

  const skipChip = useMemo(
    () => makeChip('qp.skip', isCN ? '稍后再说' : 'Not now', 'skip', 'skip'),
    [isCN],
  );

  return (
    <div className="chat-card-elevated space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {isCN ? `第 ${progress.current}/${progress.total} 问` : `Question ${progress.current} of ${progress.total}`}
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
        <div className="text-sm font-semibold text-foreground">{model.title}</div>
        <div className="text-sm text-muted-foreground">{model.question}</div>
        <div className="text-xs text-muted-foreground">{isCN ? '如不想继续，可稍后再答。' : 'If you prefer, you can answer later.'}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {model.chips.map((chip) => (
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

      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          onClick={() => onChip(skipChip)}
          disabled={disabled}
        >
          {skipChip.label}
        </button>
      </div>
    </div>
  );
}
