import React from 'react';
import { Language } from '@/lib/types';
import { t } from '@/lib/i18n';
import { AlertTriangle } from 'lucide-react';

interface RiskCheckCardProps {
  onAction: (actionId: string) => void;
  language: Language;
}

/**
 * @deprecated Legacy prompt implementation. Not wired in current `/chat` runtime.
 * Use the unified prompt system (`PromptHeader`/`PromptFooter`/`OptionCardGroup`) for new ask flows.
 */
export function RiskCheckCard({ onAction, language }: RiskCheckCardProps) {
  return (
    <div className="chat-card space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl icon-container-warning flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t('s5a.intro', language)}
          </p>
          <p className="text-sm font-medium text-foreground">
            {t('s5a.question', language)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onAction('risk_check_yes')}
          className="action-button action-button-secondary"
        >
          {t('s5a.btn.yes', language)}
        </button>
        <button
          onClick={() => onAction('risk_check_no')}
          className="action-button action-button-secondary"
        >
          {t('s5a.btn.no', language)}
        </button>
        <button
          onClick={() => onAction('risk_check_not_sure')}
          className="action-button action-button-ghost"
        >
          {t('s5a.btn.not_sure', language)}
        </button>
        <button
          onClick={() => onAction('risk_check_skip')}
          className="action-button action-button-ghost"
        >
          {t('s5a.btn.skip', language)}
        </button>
      </div>
    </div>
  );
}
