import React from 'react';
import { Language, CheckoutResult, Session } from '@/lib/types';
import { t } from '@/lib/i18n';
import { AlertTriangle, RefreshCw, CreditCard, Settings, ArrowRight } from 'lucide-react';

interface FailureCardProps {
  payload: {
    result: CheckoutResult;
    session: Session;
  };
  onAction: (actionId: string) => void;
  language: Language;
}

export function FailureCard({ payload, onAction, language }: FailureCardProps) {
  const { result } = payload;

  return (
    <div className="chat-card-elevated space-y-3">
      <div className="flex items-start gap-3">
        <div className="p-3 rounded-full bg-destructive/10">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">
            {t('s10.title', language)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('s10.reason', language, { reason: result.reason_label || '' })}
          </p>
          <p className="text-sm text-foreground mt-2">
            {t('s10.next', language)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onAction('recovery_switch_offer')}
          className="action-button action-button-secondary flex items-center justify-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          {t('s10.btn.switch_offer', language)}
        </button>
        <button
          onClick={() => onAction('recovery_switch_payment')}
          className="action-button action-button-secondary flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          {t('s10.btn.switch_payment', language)}
        </button>
        <button
          onClick={() => onAction('recovery_try_again')}
          className="action-button action-button-primary flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('s10.btn.try_again', language)}
        </button>
        <button
          onClick={() => onAction('recovery_adjust_routine')}
          className="action-button action-button-ghost flex items-center justify-center gap-2"
        >
          <Settings className="w-4 h-4" />
          {t('s10.btn.adjust', language)}
        </button>
      </div>
    </div>
  );
}
