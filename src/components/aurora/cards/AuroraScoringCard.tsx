import React from 'react';
import { Language, AnalysisResult, Session } from '@/lib/types';
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

export function AuroraScoringCard({ payload, onAction, language }: AuroraScoringCardProps) {
  const { analysis, session } = payload;
  const photoCount = Object.values(session.photos).filter(p => p?.preview).length;

  // Mock scores for Aurora visualization
  const scores = {
    science: 85,
    social: 72,
    engineering: 90,
    overall: 82,
  };

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
            {language === 'EN' ? 'SCORING & ANALYSIS' : '评分与分析'}
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            {language === 'EN' ? 'Your Skin Profile Analysis' : '你的肤质分析'}
          </h3>
        </div>
      </div>

      {/* Overall Score Ring */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
        <div className="score-ring">
          <span className="score-ring-value">{scores.overall}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground mb-2">
            {language === 'EN' ? 'Match Score' : '匹配分数'}
          </p>
          
          {/* Breakdown bars */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground w-16">Science</span>
              <div className="breakdown-bar flex-1">
                <div 
                  className="breakdown-bar-fill bg-success" 
                  style={{ width: `${scores.science}%` }} 
                />
              </div>
              <span className="text-xs font-mono-nums text-foreground w-8">{scores.science}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-risk" />
              <span className="text-xs text-muted-foreground w-16">Social</span>
              <div className="breakdown-bar flex-1">
                <div 
                  className="breakdown-bar-fill bg-risk" 
                  style={{ width: `${scores.social}%` }} 
                />
              </div>
              <span className="text-xs font-mono-nums text-foreground w-8">{scores.social}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground" />
              <span className="text-xs text-muted-foreground w-16">Eng</span>
              <div className="breakdown-bar flex-1">
                <div 
                  className="breakdown-bar-fill bg-muted-foreground" 
                  style={{ width: `${scores.engineering}%` }} 
                />
              </div>
              <span className="text-xs font-mono-nums text-foreground w-8">{scores.engineering}</span>
            </div>
          </div>
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
