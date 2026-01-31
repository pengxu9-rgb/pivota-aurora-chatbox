import React from 'react';
import { Language } from '@/lib/types';
import { t } from '@/lib/i18n';

interface LoadingCardProps {
  message?: string;
  onSkip?: () => void;
  language: Language;
}

export function LoadingCard({ message, onSkip, language }: LoadingCardProps) {
  return (
    <div className="chat-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="loading-dots">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
        <p className="text-sm text-muted-foreground">
          {message || t('loading', language)}
        </p>
      </div>
      
      {onSkip && (
        <button
          onClick={onSkip}
          className="action-button action-button-ghost text-sm"
        >
          {t('s4.btn.skip', language)}
        </button>
      )}
    </div>
  );
}
