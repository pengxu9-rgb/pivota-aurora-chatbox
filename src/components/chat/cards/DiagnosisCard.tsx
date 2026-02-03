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
    <div className="chat-card space-y-4">
      {/* Progress indicator */}
      <div className="flex gap-1">
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
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
      <div className="flex gap-2 pt-2">
        {step > 1 && (
          <button
            onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            className="action-button action-button-ghost"
          >
            {t('diagnosis.btn.back', language)}
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className="action-button action-button-primary flex-1 disabled:opacity-50"
        >
          {step === 3 ? t('diagnosis.btn.analyze', language) : t('diagnosis.btn.next', language)}
        </button>
        <button
          onClick={() => onAction('diagnosis_skip')}
          className="action-button action-button-ghost"
        >
          {t('diagnosis.btn.skip', language)}
        </button>
      </div>
    </div>
  );
}
