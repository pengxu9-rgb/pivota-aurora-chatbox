import { AnalyticsEvent } from './types';

class AnalyticsStore {
  private events: AnalyticsEvent[] = [];
  private maxEvents = 100;

  emit(eventName: string, briefId: string, traceId: string, data?: Record<string, any>) {
    const event: AnalyticsEvent = {
      event_name: eventName,
      brief_id: briefId,
      trace_id: traceId,
      timestamp: Date.now(),
      data,
    };

    this.events.push(event);
    
    // Keep only last N events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Console log for debugging
    console.log(`[Analytics] ${eventName}`, { briefId, traceId, data });
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  getRecentEvents(count: number = 20): AnalyticsEvent[] {
    return this.events.slice(-count);
  }

  clear() {
    this.events = [];
  }
}

export const analytics = new AnalyticsStore();

// Event emitters
export const emitBriefStarted = (briefId: string, traceId: string) => 
  analytics.emit('brief_started', briefId, traceId);

export const emitBriefResumed = (briefId: string, traceId: string, savedAt?: number) =>
  analytics.emit('brief_resumed', briefId, traceId, savedAt ? { saved_at: savedAt } : undefined);

export const emitIntentSelected = (briefId: string, traceId: string, intentId: string) => 
  analytics.emit('intent_selected', briefId, traceId, { intent_id: intentId });

export const emitContextSubmitted = (briefId: string, traceId: string, market?: string, budget?: string) => 
  analytics.emit('context_submitted', briefId, traceId, { market, budget });

export const emitPhotoPromptShown = (briefId: string, traceId: string) => 
  analytics.emit('photo_prompt_shown', briefId, traceId);

export const emitPhotoUploadStarted = (briefId: string, traceId: string, slot: string) => 
  analytics.emit('photo_upload_started', briefId, traceId, { slot });

export const emitPhotoUploadSucceeded = (briefId: string, traceId: string, slot: string) => 
  analytics.emit('photo_upload_succeeded', briefId, traceId, { slot });

export const emitPhotoUploadFailed = (briefId: string, traceId: string, slot: string, reason: string) => 
  analytics.emit('photo_upload_failed', briefId, traceId, { slot, reason });

export const emitPhotoQcCompleted = (briefId: string, traceId: string, status: string) => 
  analytics.emit('photo_qc_completed', briefId, traceId, { status });

export const emitAnalysisStarted = (briefId: string, traceId: string) => 
  analytics.emit('analysis_started', briefId, traceId);

export const emitAnalysisCompleted = (briefId: string, traceId: string, photoCount: number) => 
  analytics.emit('analysis_completed', briefId, traceId, { photo_count: photoCount });

export const emitRiskQuestionShown = (briefId: string, traceId: string) => 
  analytics.emit('risk_question_shown', briefId, traceId);

export const emitRiskQuestionAnswered = (briefId: string, traceId: string, answer: string) => 
  analytics.emit('risk_question_answered', briefId, traceId, { answer });

export const emitRoutineShown = (briefId: string, traceId: string, productCount: number) => 
  analytics.emit('routine_shown', briefId, traceId, { product_count: productCount });

export const emitPreferenceSelected = (briefId: string, traceId: string, preference: string) => 
  analytics.emit('preference_selected', briefId, traceId, { preference });

export const emitOfferPickerOpened = (briefId: string, traceId: string, skuId: string) => 
  analytics.emit('offer_picker_opened', briefId, traceId, { sku_id: skuId });

export const emitOfferSelected = (briefId: string, traceId: string, skuId: string, offerId: string) => 
  analytics.emit('offer_selected', briefId, traceId, { sku_id: skuId, offer_id: offerId });

export const emitCheckoutStarted = (briefId: string, traceId: string) => 
  analytics.emit('checkout_started', briefId, traceId);

export const emitCheckoutSucceeded = (briefId: string, traceId: string, orderId: string, total: number) => 
  analytics.emit('checkout_succeeded', briefId, traceId, { order_id: orderId, total });

export const emitCheckoutFailed = (briefId: string, traceId: string, reason: string) => 
  analytics.emit('checkout_failed', briefId, traceId, { reason });

export const emitRecoveryActionSelected = (briefId: string, traceId: string, action: string) => 
  analytics.emit('recovery_action_selected', briefId, traceId, { action });

export const emitAffiliateOutcomeReported = (briefId: string, traceId: string, outcome: string) =>
  analytics.emit('affiliate_outcome_reported', briefId, traceId, { outcome });

export const emitBriefEnded = (briefId: string, traceId: string, outcome: string) => 
  analytics.emit('brief_ended', briefId, traceId, { outcome });
