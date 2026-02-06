import { analytics } from './analytics';
import type { LangPref } from './persistence';

export type TriggerSource = 'chip' | 'action' | 'text_explicit';

export type AnalyticsContext = {
  brief_id: string;
  trace_id: string;
  aurora_uid?: string | null;
  session_id?: string | null;
  lang: LangPref;
  state: string;
};

const emitWithContext = (eventName: string, ctx: AnalyticsContext, props?: Record<string, unknown>) => {
  analytics.emit(eventName, ctx.brief_id, ctx.trace_id, {
    session_id: ctx.session_id ?? null,
    aurora_uid: ctx.aurora_uid ?? null,
    lang: ctx.lang,
    state: ctx.state,
    ...(props ?? {}),
  });
};

export const emitUiSessionStarted = (
  ctx: AnalyticsContext,
  props: {
    referrer?: string;
    device?: string;
    is_returning: boolean;
  }
) => emitWithContext('ui_session_started', ctx, props);

export const emitUiLanguageSwitched = (
  ctx: AnalyticsContext,
  props: {
    from_lang: LangPref;
    to_lang: LangPref;
  }
) => emitWithContext('ui_language_switched', ctx, props);

export const emitUiReturnVisit = (
  ctx: AnalyticsContext,
  props: {
    days_since_last: number;
    has_active_plan: boolean;
    has_checkin_due: boolean;
  }
) => emitWithContext('ui_return_visit', ctx, props);

export const emitUiRecosRequested = (
  ctx: AnalyticsContext,
  props: {
    entry_point: string;
    prior_value_moment?: string | null;
  }
) => emitWithContext('ui_recos_requested', ctx, props);

export const emitUiChipClicked = (
  ctx: AnalyticsContext,
  props: {
    chip_id: string;
    from_state: string;
    to_state: string;
  }
) => emitWithContext('ui_chip_clicked', ctx, props);

export const emitUiOutboundOpened = (
  ctx: AnalyticsContext,
  props: {
    merchant_domain: string;
    card_position: number;
    sku_type: string;
  } & Record<string, unknown>
) => emitWithContext('ui_outbound_opened', ctx, props);

export const emitUiPdpOpened = (
  ctx: AnalyticsContext,
  props: {
    product_id: string;
    merchant_id?: string | null;
    card_position: number;
    sku_type: string;
  } & Record<string, unknown>
) => emitWithContext('ui_pdp_opened', ctx, props);

export const emitUiInternalCheckoutClicked = (
  ctx: AnalyticsContext,
  props: {
    from_card_id: string;
  }
) => emitWithContext('ui_internal_checkout_clicked', ctx, props);

export const emitAgentStateEntered = (
  ctx: AnalyticsContext,
  props: {
    state_name: string;
    from_state: string;
    trigger_source: TriggerSource;
    trigger_id?: string;
  }
) => emitWithContext('agent_state_entered', ctx, props);

export const emitAgentProfileQuestionAnswered = (
  ctx: AnalyticsContext,
  props: {
    question_id: string;
    answer_type: string;
  },
) => emitWithContext('agent_profile_question_answered', ctx, props);
