import React from 'react';
import { Language, AnalysisResult, Session } from '@/lib/types';
import { t, getConfidenceLabel } from '@/lib/i18n';
import { CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface AnalysisSummaryCardProps {
  payload: {
    analysis: AnalysisResult;
    session: Session;
  };
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

const confidenceIcons = {
  pretty_sure: CheckCircle2,
  somewhat_sure: AlertCircle,
  not_sure: HelpCircle,
};

const confidenceColors = {
  pretty_sure: 'text-success',
  somewhat_sure: 'text-warning',
  not_sure: 'text-muted-foreground',
};

export function AnalysisSummaryCard({ payload, onAction, language }: AnalysisSummaryCardProps) {
  const { analysis, session } = payload;
  const photoCount = Object.values(session.photos).filter(p => p?.preview).length;
  const photosText = photoCount > 0 ? t('s5.photos_suffix', language, { photos_count: photoCount }) : '';

  return (
    <div className="chat-card-elevated space-y-4">
      {/* Evidence line */}
      <p className="text-xs text-muted-foreground">
        {t('s5.evidence', language, { photos_text: photosText })}
      </p>

      {/* Features */}
      <div className="space-y-2">
        {analysis.features.map((feature, idx) => {
          const Icon = confidenceIcons[feature.confidence];
          const colorClass = confidenceColors[feature.confidence];
          
          return (
            <div key={idx} className="flex items-start gap-2">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
              <div className="text-sm">
                <span className="text-foreground">{feature.observation}</span>
                <span className="text-muted-foreground ml-1">
                  ({getConfidenceLabel(feature.confidence, language)})
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Strategy */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
        <p className="text-sm text-foreground">
          <span className="font-medium">{t('s5.strategy_prefix', language)}</span>
          {analysis.strategy}
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => onAction('analysis_review_products')}
          className="action-button action-button-secondary w-full"
        >
          {t('s5.btn.review_products', language)}
        </button>
        <button
          onClick={() => onAction('analysis_continue')}
          className="action-button action-button-primary w-full"
        >
          {t('s5.btn.continue', language)}
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
