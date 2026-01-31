import React from 'react';
import { Language, CheckoutResult, Session } from '@/lib/types';
import { t } from '@/lib/i18n';
import { CheckCircle, Package, Bookmark, RotateCcw } from 'lucide-react';

interface SuccessCardProps {
  payload: {
    result: CheckoutResult;
    session: Session;
  };
  onAction: (actionId: string) => void;
  language: Language;
}

export function SuccessCard({ payload, onAction, language }: SuccessCardProps) {
  const { result } = payload;

  return (
    <div className="chat-card-elevated space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl icon-container-success flex items-center justify-center flex-shrink-0">
          <CheckCircle className="w-6 h-6 text-success" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">
            {t('s9.title', language)}
          </h3>
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p>{t('s9.order', language, { order_id: result.order_id || '' })}</p>
            <p>{t('s9.total', language, { 
              total: result.total?.toFixed(2) || '0', 
              currency: result.currency || 'USD' 
            })}</p>
            <p>{t('s9.eta', language, { eta: result.eta || '' })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onAction('track')}
          className="action-button action-button-primary flex flex-col items-center gap-1 py-3"
        >
          <Package className="w-5 h-5" />
          <span className="text-xs">{t('s9.btn.track', language)}</span>
        </button>
        <button
          onClick={() => onAction('save')}
          className="action-button action-button-secondary flex flex-col items-center gap-1 py-3"
        >
          <Bookmark className="w-5 h-5" />
          <span className="text-xs">{t('s9.btn.save', language)}</span>
        </button>
        <button
          onClick={() => onAction('restart')}
          className="action-button action-button-ghost flex flex-col items-center gap-1 py-3"
        >
          <RotateCcw className="w-5 h-5" />
          <span className="text-xs">{t('s9.btn.restart', language)}</span>
        </button>
      </div>
    </div>
  );
}
