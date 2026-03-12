import React, { useState, useEffect } from 'react';
import { Language } from '@/lib/types';
import { pickLocalizedText } from '@/lib/i18n';
import { Loader2, Check } from 'lucide-react';

export type AuroraLoadingIntent = 'default' | 'environment';

export type ThinkingStep = {
  step: string;
  message: string;
  completed: boolean;
};

interface AuroraLoadingCardProps {
  onSkip?: () => void;
  language: Language;
  intent?: AuroraLoadingIntent;
  thinkingSteps?: ThinkingStep[];
  streamedText?: string;
}

const FALLBACK_MESSAGES: Record<AuroraLoadingIntent, { en: string[]; cn: string[] }> = {
  default: {
    en: [
      'Analyzing Skin Profile...',
      'Searching Ingredient Database...',
      'Checking Safety Protocols...',
      'Matching Product Vectors...',
      'Optimizing Budget...',
    ],
    cn: [
      '分析肤质档案...',
      '搜索成分数据库...',
      '检查安全协议...',
      '匹配产品向量...',
      '优化预算...',
    ],
  },
  environment: {
    en: [
      'Analyzing Environment Stress...',
      'Detecting Weather Scenario...',
      'Generating Protective Tips...',
      'Tailoring Advice to Your Profile...',
      'Preparing Product-type Suggestions...',
    ],
    cn: [
      '评估环境压力...',
      '识别天气场景...',
      '生成防护要点...',
      '结合你的肤况个性化建议...',
      '整理可用的产品类型...',
    ],
  },
};

export function AuroraLoadingCard({
  onSkip,
  language,
  intent = 'default',
  thinkingSteps,
  streamedText,
}: AuroraLoadingCardProps) {
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const fallbackMessages = pickLocalizedText(language, FALLBACK_MESSAGES[intent]);
  const useRealSteps = thinkingSteps && thinkingSteps.length > 0;

  useEffect(() => {
    if (useRealSteps) return;
    setFallbackIndex(0);
    const interval = setInterval(() => {
      setFallbackIndex((prev) => (prev + 1) % fallbackMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [fallbackMessages.length, intent, useRealSteps]);

  if (streamedText) {
    return (
      <div className="chat-card-elevated">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground whitespace-pre-wrap">{streamedText}<span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" /></p>
          </div>
        </div>
      </div>
    );
  }

  if (useRealSteps) {
    const activeIdx = thinkingSteps!.findIndex((s) => !s.completed);
    const progress = activeIdx === -1 ? 1 : activeIdx / thinkingSteps!.length;

    return (
      <div className="chat-card-elevated">
        <div className="h-1 rounded-full bg-muted mb-4 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progress * 100, 10)}%` }}
          />
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
          <p className="section-label">
            {pickLocalizedText(language, { en: 'AURORA THINKING', cn: 'AURORA 思考中' })}
          </p>
        </div>

        <div className="space-y-2 mb-4">
          {thinkingSteps!.map((step) => (
            <div
              key={step.step}
              className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${
                step.completed ? 'opacity-60' : 'opacity-100'
              }`}
            >
              {step.completed ? (
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
              )}
              <span className={step.completed ? 'text-muted-foreground' : 'text-foreground font-medium'}>
                {step.message}
              </span>
            </div>
          ))}
        </div>

        {onSkip && (
          <button onClick={onSkip} className="action-button action-button-ghost text-sm">
            {pickLocalizedText(language, { en: 'Continue without analysis', cn: '不做分析直接继续' })}
          </button>
        )}
      </div>
    );
  }

  const progress = (fallbackIndex + 1) / fallbackMessages.length;

  return (
    <div className="chat-card-elevated">
      <div className="h-1 rounded-full bg-muted mb-4 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.max(progress * 100, 10)}%` }}
        />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
        <p className="section-label">
          {pickLocalizedText(language, { en: 'AURORA THINKING', cn: 'AURORA 思考中' })}
        </p>
      </div>

      <div className="space-y-2 mb-4">
        {fallbackMessages.map((msg, idx) => {
          const isDone = idx < fallbackIndex;
          const isActive = idx === fallbackIndex;
          if (idx > fallbackIndex) return null;
          return (
            <div
              key={idx}
              className={`flex items-center gap-2 text-sm transition-opacity duration-300 ${isDone ? 'opacity-60' : 'opacity-100'}`}
            >
              {isDone ? (
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
              ) : null}
              <span className={isDone ? 'text-muted-foreground' : 'text-foreground font-medium'}>
                {msg}
              </span>
            </div>
          );
        })}
      </div>

      {onSkip && (
        <button onClick={onSkip} className="action-button action-button-ghost text-sm">
          {pickLocalizedText(language, { en: 'Continue without analysis', cn: '不做分析直接继续' })}
        </button>
      )}
    </div>
  );
}
