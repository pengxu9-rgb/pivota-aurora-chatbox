import React, { useState } from 'react';
import { Language } from '@/lib/types';
import { pickLocalizedText, t } from '@/lib/i18n';
import { User, Droplets, Target, ChevronRight } from 'lucide-react';

interface AuroraProfileCardProps {
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

type SkinType = 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive';
type SkinConcern = 'acne' | 'dark_spots' | 'wrinkles' | 'dullness' | 'redness' | 'pores' | 'dehydration';

const SKIN_TYPES: { id: SkinType; icon: string }[] = [
  { id: 'oily', icon: '💧' },
  { id: 'dry', icon: '🏜️' },
  { id: 'combination', icon: '⚖️' },
  { id: 'normal', icon: '✨' },
  { id: 'sensitive', icon: '🌸' },
];

const SKIN_CONCERNS: { id: SkinConcern; icon: string }[] = [
  { id: 'acne', icon: '🔴' },
  { id: 'dark_spots', icon: '🎯' },
  { id: 'wrinkles', icon: '📏' },
  { id: 'dullness', icon: '🌫️' },
  { id: 'redness', icon: '🩹' },
  { id: 'pores', icon: '🔍' },
  { id: 'dehydration', icon: '💦' },
];

export function AuroraProfileCard({ onAction, language }: AuroraProfileCardProps) {
  const L = <T,>(en: T, cn: T) => pickLocalizedText(language, { en, cn });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [concerns, setConcerns] = useState<SkinConcern[]>([]);
  const [barrierStatus, setBarrierStatus] = useState<'healthy' | 'impaired' | 'unknown'>('unknown');

  const toggleConcern = (concern: SkinConcern) => {
    setConcerns(prev => 
      prev.includes(concern) 
        ? prev.filter(c => c !== concern)
        : prev.length < 3 ? [...prev, concern] : prev
    );
  };

  const handleSubmit = () => {
    onAction('diagnosis_submit', { 
      skinType, 
      concerns, 
      currentRoutine: barrierStatus === 'impaired' ? 'basic' : 'full',
      barrierStatus
    });
  };

  const canProceed = step === 1 ? skinType !== null : step === 2 ? concerns.length > 0 : true;

  return (
    <div className="chat-card-elevated space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/50">
        <div className="w-11 h-11 rounded-xl icon-container flex items-center justify-center">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="section-label">{L('PROFILE BUILDER', '画像构建')}</p>
          <h3 className="text-sm font-semibold text-foreground">{L('Tell me about your skin', '告诉我你的肤质')}</h3>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={`h-1.5 flex-1 rounded-full transition-all ${
              s < step ? 'bg-success' : s === step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Skin Type */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-primary" />
            <label className="text-sm font-medium text-foreground">
              {t('diagnosis.skin_type.label', language)}
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('diagnosis.skin_type.hint', language)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SKIN_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSkinType(type.id)}
                className={`p-3 rounded-lg text-left transition-all border ${
                  skinType === type.id 
                    ? 'bg-primary/10 border-primary text-foreground' 
                    : 'bg-muted/50 border-transparent hover:bg-muted text-muted-foreground'
                }`}
              >
                <span className="text-lg mr-2">{type.icon}</span>
                <span className="text-sm font-medium">
                  {t(`diagnosis.skin_type.${type.id}`, language)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Concerns */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <label className="text-sm font-medium text-foreground">
              {t('diagnosis.concerns.label', language)}
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('diagnosis.concerns.hint', language)}
          </p>
          <div className="flex flex-wrap gap-2">
            {SKIN_CONCERNS.map((concern) => (
              <button
                key={concern.id}
                onClick={() => toggleConcern(concern.id)}
                className={`chip-button ${concerns.includes(concern.id) ? 'chip-button-primary' : ''}`}
              >
                <span className="mr-1">{concern.icon}</span>
                {t(`diagnosis.concern.${concern.id}`, language)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Barrier Status */}
      {step === 3 && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">{L('Barrier Health', '屏障状态')}</label>
          <p className="text-xs text-muted-foreground">
            {L('Signs: stinging with products, redness, dryness despite moisturizer', '症状：使用产品刺痛、发红、保湿后仍干燥')}
          </p>
          <div className="space-y-2">
            {[
              {
                id: 'healthy',
                label: { EN: 'Healthy - No issues', CN: '健康 - 无问题' },
                selectedClass: 'bg-success/10 border-success/30',
                dotClass: 'bg-success',
              },
              {
                id: 'impaired',
                label: { EN: 'Impaired - Some sensitivity', CN: '受损 - 有敏感' },
                selectedClass: 'bg-warning/10 border-warning/30',
                dotClass: 'bg-warning',
              },
              {
                id: 'unknown',
                label: { EN: 'Not sure', CN: '不确定' },
                selectedClass: 'bg-muted/50 border-border/50',
                dotClass: 'bg-muted-foreground',
              },
            ].map((status) => (
              <button
                key={status.id}
                onClick={() => setBarrierStatus(status.id as any)}
                className={`w-full p-3 rounded-lg text-left transition-all border flex items-center justify-between ${
                  barrierStatus === status.id 
                    ? status.selectedClass
                    : 'bg-muted/50 border-transparent hover:bg-muted'
                }`}
              >
                <span className="text-sm font-medium text-foreground">
                  {L(status.label.EN, status.label.CN)}
                </span>
                {barrierStatus === status.id && (
                  <div className={`w-2 h-2 rounded-full ${status.dotClass}`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Signal Pills Preview */}
      {(skinType || concerns.length > 0) && (
        <div className="pt-3 border-t border-border">
          <p className="section-label mb-2">{L('KEY SIGNALS', '关键信号')}</p>
          <div className="flex flex-wrap gap-1.5">
            {skinType && (
              <span className="signal-pill signal-pill-primary">
                {t(`diagnosis.skin_type.${skinType}`, language)}
              </span>
            )}
            {concerns.map(c => (
              <span key={c} className="signal-pill">
                {t(`diagnosis.concern.${c}`, language)}
              </span>
            ))}
            {barrierStatus === 'impaired' && step === 3 && (
              <span className="signal-pill signal-pill-warning">{L('Barrier stressed', '屏障受损')}</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {step > 1 && (
          <button
            onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            className="action-button action-button-ghost px-4"
          >
            {t('diagnosis.btn.back', language)}
          </button>
        )}
        <button
          onClick={() => step < 3 ? setStep((step + 1) as 1 | 2 | 3) : handleSubmit()}
          disabled={!canProceed}
          className="action-button action-button-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {step === 3 ? t('diagnosis.btn.analyze', language) : t('diagnosis.btn.next', language)}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      {step === 1 && (
        <button
          onClick={() => onAction('context_skip')}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('diagnosis.btn.skip', language)}
        </button>
      )}
    </div>
  );
}
