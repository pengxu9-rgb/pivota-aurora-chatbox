import React from 'react';
import { Language, AnalysisResult, DiagnosisResult, Session } from '@/lib/types';
import { t, getConfidenceLabel } from '@/lib/i18n';
import { Calculator, CheckCircle2, AlertTriangle, HelpCircle, ChevronRight, Shield } from 'lucide-react';

interface AuroraScoringCardProps {
  payload: {
    analysis: AnalysisResult;
    session: Session;
  };
  onAction: (actionId: string) => void;
  language: Language;
}

function barrierSummary(status: DiagnosisResult['barrierStatus'] | undefined, language: Language) {
  if (status === 'healthy') return language === 'EN' ? 'Healthy barrier' : '屏障稳定';
  if (status === 'impaired') return language === 'EN' ? 'Barrier stressed' : '屏障受损/脆弱';
  if (status === 'unknown') return language === 'EN' ? 'Barrier: not sure' : '屏障：不确定';
  return language === 'EN' ? 'Barrier: not provided' : '屏障：未填写';
}

export function AuroraScoringCard({ payload, onAction, language }: AuroraScoringCardProps) {
  const { analysis, session } = payload;
  const photoCount = Object.values(session.photos).filter(p => p?.preview).length;

  const confidenceIcons = {
    pretty_sure: CheckCircle2,
    somewhat_sure: AlertTriangle,
    not_sure: HelpCircle,
  };

  const confidenceColors = {
    pretty_sure: 'text-success',
    somewhat_sure: 'text-warning',
    not_sure: 'text-muted-foreground',
  };

  return (
    <div className="chat-card-elevated space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/50">
        <div className="w-11 h-11 rounded-xl icon-container flex items-center justify-center">
          <Calculator className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="section-label">
            {language === 'EN' ? 'ASSESSMENT SUMMARY' : '分析总结'}
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            {language === 'EN' ? 'Your Skin Snapshot' : '你的皮肤快照'}
          </h3>
        </div>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-1 gap-2 rounded-xl bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{language === 'EN' ? 'Skin type:' : '肤质：'}</span>
          <span className="font-medium text-foreground">
            {session.diagnosis?.skinType
              ? t(`diagnosis.skin_type.${session.diagnosis.skinType}`, language)
              : language === 'EN'
                ? 'Not provided'
                : '未填写'}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{language === 'EN' ? 'Barrier:' : '屏障：'}</span>
          <span className="font-medium text-foreground">{barrierSummary(session.diagnosis?.barrierStatus, language)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{language === 'EN' ? 'Priorities:' : '目标：'}</span>
          <span className="font-medium text-foreground">
            {session.diagnosis?.concerns?.length
              ? session.diagnosis.concerns
                  .slice(0, 3)
                  .map((c) => t(`diagnosis.concern.${c}`, language))
                  .join(', ')
              : language === 'EN'
                ? 'Not provided'
                : '未填写'}
          </span>
        </div>
      </div>

      {/* Evidence line */}
      <p className="text-xs text-muted-foreground">
        {language === 'EN' 
          ? `Based on your answers${photoCount > 0 ? ` and ${photoCount} photo(s)` : ''}`
          : `根据你的回答${photoCount > 0 ? `和 ${photoCount} 张照片` : ''}`
        }
      </p>

      {/* Features/Observations */}
      <div className="space-y-2">
        {analysis.features.map((feature, idx) => {
          const Icon = confidenceIcons[feature.confidence];
          const colorClass = confidenceColors[feature.confidence];
          
          return (
            <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
              <div className="text-sm">
                <span className="text-foreground">{feature.observation}</span>
                <span className={`ml-2 text-xs ${colorClass}`}>
                  ({getConfidenceLabel(feature.confidence, language)})
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Strategy */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary uppercase tracking-wide">
            {language === 'EN' ? 'Strategy' : '策略'}
          </span>
        </div>
        <p className="text-sm text-foreground">
          {analysis.strategy}
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={() => onAction('analysis_review_products')}
          className="action-button action-button-secondary w-full"
        >
          {language === 'EN' ? '🔎 Review my current products first' : '🔎 先评估我现在用的产品'}
        </button>
        <button
          onClick={() => onAction('analysis_continue')}
          className="action-button action-button-primary w-full flex items-center justify-center gap-2"
        >
          {t('s5.btn.continue', language)}
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onAction('analysis_gentler')}
            className="action-button action-button-secondary flex-1"
          >
            {t('s5.btn.gentler', language)}
          </button>
          <button
            onClick={() => onAction('analysis_simple')}
            className="action-button action-button-ghost flex-1"
          >
            {t('s5.btn.simple', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
