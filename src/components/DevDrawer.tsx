import React, { useState } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { analytics } from '@/lib/analytics';
import { t } from '@/lib/i18n';
import { ChevronUp, ChevronDown, Bug } from 'lucide-react';
import { CheckoutOutcome } from '@/lib/types';

export function DevDrawer() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { session, language, setForcedOutcome } = useChatContext();
  const events = analytics.getRecentEvents(10);

  return (
    <div className={`dev-drawer ${isExpanded ? '' : 'dev-drawer-collapsed'}`}>
      {/* Handle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full h-10 flex items-center justify-center gap-2 text-dev-foreground hover:opacity-80 transition-opacity"
      >
        <Bug className="w-4 h-4" />
        <span className="text-xs font-medium">{t('dev.title', language)}</span>
        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {/* Content */}
      <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
        <div className="space-y-4">
          {/* Session info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">{t('dev.brief_id', language)}:</span>
              <p className="font-mono text-dev-foreground truncate">{session.brief_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('dev.trace_id', language)}:</span>
              <p className="font-mono text-dev-foreground truncate">{session.trace_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('dev.mode', language)}:</span>
              <p className="font-mono text-dev-foreground">{session.mode}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('dev.state', language)}:</span>
              <p className="font-mono text-dev-foreground">{session.state}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('dev.clarifications', language)}:</span>
              <p className="font-mono text-dev-foreground">{session.clarification_count}</p>
            </div>
          </div>

          {/* Force outcome */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">{t('dev.force_outcome', language)}:</span>
            <div className="flex flex-wrap gap-1">
              {(['success', 'failure_payment', 'failure_expired'] as CheckoutOutcome[]).map((outcome) => (
                <button
                  key={outcome}
                  onClick={() => setForcedOutcome(outcome)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    session.forced_outcome === outcome
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/20 text-dev-foreground hover:bg-muted/30'
                  }`}
                >
                  {outcome === 'success' ? t('dev.outcome.success', language) :
                   outcome === 'failure_payment' ? t('dev.outcome.payment', language) :
                   t('dev.outcome.expired', language)}
                </button>
              ))}
            </div>
          </div>

          {/* Selected offers */}
          {Object.keys(session.selected_offers).length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{t('dev.selected_offers', language)}:</span>
              <div className="text-xs font-mono text-dev-foreground space-y-0.5">
                {Object.entries(session.selected_offers).map(([sku, offer]) => (
                  <p key={sku} className="truncate">{sku}: {offer}</p>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('dev.events', language)} (last 10):</span>
            <div className="text-xs font-mono text-dev-foreground space-y-0.5 max-h-32 overflow-y-auto">
              {events.map((event, idx) => (
                <p key={idx} className="truncate opacity-80">
                  {new Date(event.timestamp).toLocaleTimeString()}: {event.event_name}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
