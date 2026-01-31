import React, { useState, useEffect } from 'react';
import { Language } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface AuroraLoadingCardProps {
  onSkip?: () => void;
  language: Language;
}

const LOADING_MESSAGES = {
  EN: [
    'Analyzing Skin Profile...',
    'Searching Ingredient Database...',
    'Checking Safety Protocols...',
    'Matching Product Vectors...',
    'Optimizing Budget...',
  ],
  CN: [
    '分析肤质档案...',
    '搜索成分数据库...',
    '检查安全协议...',
    '匹配产品向量...',
    '优化预算...',
  ],
};

export function AuroraLoadingCard({ onSkip, language }: AuroraLoadingCardProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = LOADING_MESSAGES[language];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="chat-card-elevated">
      {/* Progress indicator */}
      <div className="flex gap-1 mb-4">
        {messages.map((_, idx) => (
          <div 
            key={idx} 
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              idx <= messageIndex ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      
      {/* Loading animation */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
        <div>
          <p className="section-label mb-1">
            {language === 'EN' ? 'AURORA ENGINE' : 'AURORA 引擎'}
          </p>
          <p className="text-sm font-medium text-foreground animate-pulse-subtle">
            {messages[messageIndex]}
          </p>
        </div>
      </div>
      
      {/* Status pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {messageIndex >= 0 && (
          <span className="signal-pill signal-pill-success">✓ Profile loaded</span>
        )}
        {messageIndex >= 1 && (
          <span className="signal-pill signal-pill-success">✓ 2,847 ingredients</span>
        )}
        {messageIndex >= 2 && (
          <span className="signal-pill signal-pill-primary">Checking VETO rules</span>
        )}
      </div>
      
      {onSkip && (
        <button
          onClick={onSkip}
          className="action-button action-button-ghost text-sm"
        >
          {language === 'EN' ? 'Continue without analysis' : '不做分析直接继续'}
        </button>
      )}
    </div>
  );
}
