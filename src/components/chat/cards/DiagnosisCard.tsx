import React, { useState } from 'react';
import { Language } from '@/lib/types';
import { t } from '@/lib/i18n';

interface DiagnosisCardProps {
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

type SkinType = 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive';
type SkinConcern = 'acne' | 'dark_spots' | 'wrinkles' | 'dullness' | 'redness' | 'pores' | 'dehydration';
type BarrierStatus = 'healthy' | 'impaired' | 'unknown';
type SensitivityLevel = 'low' | 'medium' | 'high';

const SKIN_TYPES: SkinType[] = ['oily', 'dry', 'combination', 'normal', 'sensitive'];
const SKIN_CONCERNS: SkinConcern[] = ['acne', 'dark_spots', 'wrinkles', 'dullness', 'redness', 'pores', 'dehydration'];
const BARRIER_STATUSES: BarrierStatus[] = ['healthy', 'impaired', 'unknown'];
const SENSITIVITY_LEVELS: SensitivityLevel[] = ['low', 'medium', 'high'];

export function DiagnosisCard({ onAction, language }: DiagnosisCardProps) {
  const TOTAL_STEPS = 3;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [barrierStatus, setBarrierStatus] = useState<BarrierStatus | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityLevel | null>(null);
  const [concerns, setConcerns] = useState<SkinConcern[]>([]);

  const toggleConcern = (concern: SkinConcern) => {
    setConcerns(prev => 
      prev.includes(concern) 
        ? prev.filter(c => c !== concern)
        : prev.length < 3 ? [...prev, concern] : prev
    );
  };

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as 1 | 2 | 3);
    } else {
      onAction('diagnosis_submit', { 
        skinType, 
        concerns, 
        barrierStatus,
        sensitivity,
      });
    }
  };

  const canProceed = step === 1 ? skinType !== null : step === 2 ? barrierStatus !== null && sensitivity !== null : concerns.length > 0;

  return (
    <div className="chat-card space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t('diagnosis.step_indicator', language, { current: step, total: TOTAL_STEPS })}
          </p>
          {step === 3 ? (
            <p className="text-xs text-muted-foreground">
              {t('diagnosis.concerns.count', language, { count: concerns.length })}
            </p>
          ) : null}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Skin Type */}
      {step === 1 && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            {t('diagnosis.skin_type.label', language)}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('diagnosis.skin_type.hint', language)}
          </p>
          <div className="flex flex-wrap gap-2">
            {SKIN_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setSkinType(type)}
                className={`chip-button ${skinType === type ? 'chip-button-primary' : ''}`}
              >
                {t(`diagnosis.skin_type.${type}`, language)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Barrier + Sensitivity */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t('diagnosis.barrier.label', language)}
            </label>
            <p className="text-xs text-muted-foreground">
              {t('diagnosis.barrier.hint', language)}
            </p>
            <div className="flex flex-wrap gap-2">
              {BARRIER_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => setBarrierStatus(status)}
                  className={`chip-button ${barrierStatus === status ? 'chip-button-primary' : ''}`}
                >
                  {t(`diagnosis.barrier.${status}`, language)}
                </button>
              ))}
            </div>
          </div>

          {barrierStatus ? (
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium text-foreground">
                {t('diagnosis.sensitivity.label', language)}
              </label>
              <p className="text-xs text-muted-foreground">
                {t('diagnosis.sensitivity.hint', language)}
              </p>
              <div className="flex flex-wrap gap-2">
                {SENSITIVITY_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSensitivity(lvl)}
                    className={`chip-button ${sensitivity === lvl ? 'chip-button-primary' : ''}`}
                  >
                    {t(`diagnosis.sensitivity.${lvl}`, language)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="pt-1 text-xs text-muted-foreground">{t('diagnosis.sensitivity.pending', language)}</p>
          )}
        </div>
      )}

      {/* Step 3: Concerns */}
      {step === 3 && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            {t('diagnosis.concerns.label', language)}
          </label>
          <p className="text-xs text-muted-foreground">
            {t('diagnosis.concerns.hint', language)}
          </p>
          <div className="flex flex-wrap gap-2">
            {SKIN_CONCERNS.map((concern) => (
              <button
                key={concern}
                onClick={() => toggleConcern(concern)}
                className={`chip-button ${concerns.includes(concern) ? 'chip-button-primary' : ''}`}
              >
                {t(`diagnosis.concern.${concern}`, language)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-2">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              className="action-button action-button-ghost"
            >
              {t('diagnosis.btn.back', language)}
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="action-button action-button-primary w-full disabled:opacity-50"
          >
            {step === 3 ? t('diagnosis.btn.analyze', language) : t('diagnosis.btn.next', language)}
          </button>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => onAction('diagnosis_skip')}
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {t('diagnosis.skip_lite', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
