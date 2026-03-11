import React, { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type {
  DiagnosisV2FollowupQuestion,
  DiagnosisV2GoalPreset,
  DiagnosisV2IntroPayload,
  Language,
} from '@/lib/types';
import { t } from '@/lib/i18n';

const GOAL_PRESETS: DiagnosisV2GoalPreset[] = [
  'anti_aging_face',
  'eye_anti_aging',
  'post_procedure_repair',
  'barrier_repair',
  'sun_protection',
  'brightening',
  'neck_care',
  'daily_maintenance',
  'mask_special',
  'custom',
];

interface DiagnosisV2IntroCardProps {
  payload: DiagnosisV2IntroPayload & {
    goal_options?: Array<Record<string, unknown>>;
    sections?: Array<Record<string, unknown>>;
  };
  language: Language;
  onAction: (actionId: string, data?: Record<string, any>) => void;
}

export function DiagnosisV2IntroCard({ payload, language, onAction }: DiagnosisV2IntroCardProps) {
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  const goalSelectionSection = sections.find((section) => String(section?.type || '').trim() === 'goal_selection');
  const followUpSection = sections.find((section) => String(section?.type || '').trim() === 'follow_up_questions');
  const dynamicGoalOptions = Array.isArray(payload?.goal_options)
    ? payload.goal_options
    : Array.isArray(goalSelectionSection?.options)
      ? goalSelectionSection.options
      : [];
  const rawFollowupQuestions = (
    Array.isArray(payload?.followup_questions) && payload.followup_questions.length > 0
      ? payload.followup_questions
      : Array.isArray(followUpSection?.questions)
        ? followUpSection.questions
        : []
  ).slice(0, 3);

  const followupQuestions = rawFollowupQuestions.map((q: any, qi: number) => {
    const rawOpts = Array.isArray(q?.options) ? q.options : [];
    const options = rawOpts.map((opt: any, oi: number) => {
      if (typeof opt === 'string') {
        return { id: `opt_${qi}_${oi}`, label: opt };
      }
      if (opt && typeof opt === 'object') {
        const localizedLabel =
          language === 'CN'
            ? (opt.label_zh || opt.label || opt.label_en)
            : (opt.label_en || opt.label || opt.label_zh);
        return {
          id: opt.id || `opt_${qi}_${oi}`,
          label: (typeof localizedLabel === 'string' && localizedLabel.trim()) ? localizedLabel.trim() : String(opt.id || opt.value || `Option ${oi + 1}`),
        };
      }
      return { id: `opt_${qi}_${oi}`, label: String(opt ?? '') };
    });
    const questionText =
      q?.question
      || (language === 'CN' ? (q?.question_zh || q?.question_en) : (q?.question_en || q?.question_zh))
      || '';
    return {
      id: q?.id || `fq_${qi}`,
      question: typeof questionText === 'string' ? questionText : String(questionText),
      options,
    };
  }) as DiagnosisV2FollowupQuestion[];
  const availableGoals = dynamicGoalOptions.length
    ? dynamicGoalOptions
        .map((option) => String(option?.id || '').trim())
        .filter(Boolean)
    : GOAL_PRESETS;
  const [goals, setGoals] = useState<string[]>(payload?.goal_profile?.selected_goals ?? []);
  const [customInput, setCustomInput] = useState<string>(payload?.goal_profile?.custom_input ?? '');
  const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>({});
  const goalsRef = useRef(goals);
  const customInputRef = useRef(customInput);
  const followupAnswersRef = useRef(followupAnswers);

  const toggleGoal = (goalId: string) => {
    flushSync(() => {
      setGoals((prev) => {
        const next = prev.includes(goalId) ? prev.filter((g) => g !== goalId) : [...prev, goalId];
        goalsRef.current = next;
        return next;
      });
    });
  };

  const setFollowupAnswer = (questionId: string, optionId: string) => {
    setFollowupAnswers((prev) => {
      const next = { ...prev, [questionId]: optionId };
      followupAnswersRef.current = next;
      return next;
    });
  };

  const handleSubmit = () => {
    const selectedGoals = goalsRef.current;
    onAction('diagnosis_v2_submit', {
      goals: selectedGoals,
      customInput: selectedGoals.includes('custom') ? customInputRef.current : undefined,
      followupAnswers: followupAnswersRef.current,
    });
  };

  const handleSkip = () => {
    onAction('diagnosis_v2_skip');
  };

  const getGoalLabel = (goalId: string) => {
    if (dynamicGoalOptions.length > 0) {
      const matched = dynamicGoalOptions.find((option) => String(option?.id || '').trim() === goalId);
      if (matched) {
        const localized =
          language === 'CN'
            ? matched.label_zh || matched.label || matched.label_en
            : matched.label_en || matched.label || matched.label_zh;
        if (typeof localized === 'string' && localized.trim()) return localized.trim();
      }
    }
    const key = `diagnosis_v2.goal.${goalId}` as const;
    return t(key, language);
  };

  return (
    <div className="chat-card animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="space-y-5">
        <h3 className="text-base font-semibold text-foreground">{t('diagnosis_v2.title', language)}</h3>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {availableGoals.map((goalId) => (
              <button
                key={goalId}
                type="button"
                onClick={() => toggleGoal(goalId)}
                aria-pressed={goals.includes(goalId)}
                className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ease-out ${
                  goals.includes(goalId)
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {getGoalLabel(goalId)}
              </button>
            ))}
          </div>

          {goals.includes('custom') && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <input
                type="text"
                value={customInput}
                onChange={(e) => {
                  customInputRef.current = e.target.value;
                  setCustomInput(e.target.value);
                }}
                placeholder={t('diagnosis_v2.custom_placeholder', language)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </div>

        {followupQuestions.length > 0 && (
          <div className="space-y-4 border-t border-border/60 pt-4">
            {followupQuestions.map((q: DiagnosisV2FollowupQuestion) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium text-foreground">{q.question}</p>
                <div className="flex flex-col gap-1.5">
                  {q.options.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={followupAnswers[q.id] === opt.id}
                        onChange={() => setFollowupAnswer(q.id, opt.id)}
                        className="h-4 w-4 border-input text-primary focus:ring-ring"
                      />
                      <span className="text-sm text-foreground">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <button type="button" onClick={handleSubmit} className="action-button action-button-primary w-full">
            {t('diagnosis_v2.btn.start_analysis', language)}
          </button>
          <button type="button" onClick={handleSkip} className="action-button action-button-ghost w-full">
            {t('diagnosis_v2.btn.skip', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
