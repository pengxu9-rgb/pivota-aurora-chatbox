import React, { useMemo, useState } from 'react';
import { Language } from '@/lib/types';
import { t } from '@/lib/i18n';
import { OptionCardGroup, PromptFooter, PromptHeader, type OptionCardGroupOption } from '@/components/prompt';

interface DiagnosisCardProps {
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

type SkinType = 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive';
type SkinConcern = 'acne' | 'dark_spots' | 'wrinkles' | 'dullness' | 'redness' | 'pores' | 'dehydration';
type BarrierStatus = 'healthy' | 'impaired' | 'unknown';
type SensitivityLevel = 'low' | 'medium' | 'high';
type DiagnosisStep = 1 | 2 | 3;

const SKIN_TYPES: SkinType[] = ['oily', 'dry', 'combination', 'normal', 'sensitive'];
const SKIN_CONCERNS: SkinConcern[] = ['acne', 'dark_spots', 'wrinkles', 'dullness', 'redness', 'pores', 'dehydration'];
const BARRIER_STATUSES: BarrierStatus[] = ['healthy', 'impaired', 'unknown'];
const SENSITIVITY_LEVELS: SensitivityLevel[] = ['low', 'medium', 'high'];
const TOTAL_STEPS = 3;

const isSkinType = (value: string): value is SkinType => SKIN_TYPES.includes(value as SkinType);
const isBarrierStatus = (value: string): value is BarrierStatus => BARRIER_STATUSES.includes(value as BarrierStatus);
const isSensitivityLevel = (value: string): value is SensitivityLevel => SENSITIVITY_LEVELS.includes(value as SensitivityLevel);
const isSkinConcern = (value: string): value is SkinConcern => SKIN_CONCERNS.includes(value as SkinConcern);

export function DiagnosisCard({ onAction, language }: DiagnosisCardProps) {
  const [step, setStep] = useState<DiagnosisStep>(1);
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [barrierStatus, setBarrierStatus] = useState<BarrierStatus | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityLevel | null>(null);
  const [concerns, setConcerns] = useState<SkinConcern[]>([]);

  const skinTypeOptions = useMemo<OptionCardGroupOption[]>(
    () =>
      SKIN_TYPES.map((type) => ({
        id: type,
        label: t(`diagnosis.skin_type.${type}`, language),
      })),
    [language],
  );

  const barrierOptions = useMemo<OptionCardGroupOption[]>(
    () =>
      BARRIER_STATUSES.map((status) => ({
        id: status,
        label: t(`diagnosis.barrier.${status}`, language),
      })),
    [language],
  );

  const sensitivityOptions = useMemo<OptionCardGroupOption[]>(
    () =>
      SENSITIVITY_LEVELS.map((level) => ({
        id: level,
        label: t(`diagnosis.sensitivity.${level}`, language),
      })),
    [language],
  );

  const concernOptions = useMemo<OptionCardGroupOption[]>(
    () =>
      SKIN_CONCERNS.map((concern) => ({
        id: concern,
        label: t(`diagnosis.concern.${concern}`, language),
      })),
    [language],
  );

  const handlePrimary = () => {
    if (step < 3) {
      setStep((step + 1) as DiagnosisStep);
    } else {
      onAction('diagnosis_submit', {
        skinType,
        concerns,
        barrierStatus,
        sensitivity,
      });
    }
  };

  const handleBack = () => {
    if (step === 1) return;
    setStep((step - 1) as DiagnosisStep);
  };

  const handleNotNow = () => {
    onAction('diagnosis_skip');
  };

  const canProceed = step === 1 ? skinType !== null : step === 2 ? barrierStatus !== null && sensitivity !== null : concerns.length > 0;

  const headerModel = useMemo(() => {
    if (step === 1) {
      return {
        title: t('diagnosis.skin_type.label', language),
        helper: t('diagnosis.skin_type.hint', language),
      };
    }
    if (step === 2) {
      return {
        title: t('diagnosis.barrier.label', language),
        helper: t('diagnosis.barrier.hint', language),
      };
    }
    return {
      title: t('diagnosis.concerns.label', language),
      helper: t('diagnosis.concerns.hint', language),
    };
  }, [language, step]);

  return (
    <div className="chat-card">
      <PromptHeader
        title={headerModel.title}
        helper={headerModel.helper}
        language={language}
        step={{ current: step, total: TOTAL_STEPS }}
        showBack={step > 1}
        onBack={handleBack}
      />

      <div className="mt-3 space-y-4">
      {step === 1 && (
          <OptionCardGroup
            selectionMode="single"
            ariaLabel={t('diagnosis.skin_type.label', language)}
            options={skinTypeOptions}
            value={skinType}
            onChange={(nextValue) => {
              const next = typeof nextValue === 'string' ? nextValue : '';
              if (isSkinType(next)) setSkinType(next);
            }}
          />
      )}

      {step === 2 && (
        <div className="space-y-3">
          <OptionCardGroup
            selectionMode="single"
            ariaLabel={t('diagnosis.barrier.label', language)}
            options={barrierOptions}
            value={barrierStatus}
            onChange={(nextValue) => {
              const next = typeof nextValue === 'string' ? nextValue : '';
              if (isBarrierStatus(next)) setBarrierStatus(next);
            }}
          />

          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">{t('diagnosis.sensitivity.label', language)}</div>
            <p className="text-xs text-muted-foreground">{t('diagnosis.sensitivity.hint', language)}</p>
            <OptionCardGroup
              selectionMode="single"
              ariaLabel={t('diagnosis.sensitivity.label', language)}
              options={sensitivityOptions}
              value={sensitivity}
              onChange={(nextValue) => {
                const next = typeof nextValue === 'string' ? nextValue : '';
                if (isSensitivityLevel(next)) setSensitivity(next);
              }}
            />
          </div>
        </div>
      )}

      {step === 3 && (
          <OptionCardGroup
            selectionMode="multiple"
            ariaLabel={t('diagnosis.concerns.label', language)}
            options={concernOptions}
            value={concerns}
            maxSelections={3}
            onChange={(nextValue) => {
              const nextConcerns = Array.isArray(nextValue) ? nextValue.filter(isSkinConcern) : [];
              setConcerns(nextConcerns.slice(0, 3));
            }}
          />
      )}
      </div>

      <PromptFooter
        language={language}
        primaryLabel={step === 3 ? t('diagnosis.btn.analyze', language) : t('prompt.common.next', language)}
        onPrimary={handlePrimary}
        primaryDisabled={!canProceed}
        tertiaryLabel={t('prompt.common.notNow', language)}
        onTertiary={handleNotNow}
      />
    </div>
  );
}
