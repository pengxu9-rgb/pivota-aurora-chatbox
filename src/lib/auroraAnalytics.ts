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
  } & Record<string, unknown>
) => emitWithContext('ui_internal_checkout_clicked', ctx, props);

export const emitPdpClick = (
  ctx: AnalyticsContext,
  props: {
    card_position: number;
    anchor_key?: string;
  } & Record<string, unknown>,
) => emitWithContext('pdp_click', ctx, props);

export const emitPdpOpenPath = (
  ctx: AnalyticsContext,
  props: {
    card_position: number;
    path: 'group' | 'ref' | 'resolve' | 'external';
    anchor_key?: string;
  } & Record<string, unknown>,
) => emitWithContext('pdp_open_path', ctx, props);

export const emitPdpFailReason = (
  ctx: AnalyticsContext,
  props: {
    card_position: number;
    reason: string;
    anchor_key?: string;
  } & Record<string, unknown>,
) => emitWithContext('pdp_fail_reason', ctx, props);

export const emitPdpLatencyMs = (
  ctx: AnalyticsContext,
  props: {
    card_position: number;
    path: 'group' | 'ref' | 'resolve' | 'external';
    pdp_latency_ms: number;
    anchor_key?: string;
  } & Record<string, unknown>,
) => emitWithContext('pdp_latency_ms', ctx, props);

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

export const emitAuroraConflictHeatmapImpression = (
  ctx: AnalyticsContext,
  props: {
    request_id?: string | null;
    bff_trace_id?: string | null;
    schema_version?: string | null;
    heatmap_state?: string | null;
    trigger_source?: string | null;
    num_steps?: number;
    num_cells_nonzero?: number;
    num_unmapped_conflicts?: number;
    max_severity?: number;
    routine_simulation_safe?: boolean | null;
    routine_conflict_count?: number | null;
    normalized_conflict_count?: number;
  } & Record<string, unknown>,
) => emitWithContext('aurora_conflict_heatmap_impression', ctx, props);

export const emitAuroraConflictHeatmapCellTap = (
  ctx: AnalyticsContext,
  props: {
    request_id?: string | null;
    bff_trace_id?: string | null;
    schema_version?: string | null;
    heatmap_state?: string | null;
    trigger_source?: string | null;
    row_index: number;
    col_index: number;
    severity?: number;
    rule_ids?: string[];
    step_a?: string;
    step_b?: string;
    selected_conflict_id?: string | null;
    match_quality?: string | null;
    num_steps?: number;
  } & Record<string, unknown>,
) => emitWithContext('aurora_conflict_heatmap_cell_tap', ctx, props);

export const emitAuroraPhotoModulesSchemaFail = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    error_count?: number;
    errors?: string[];
    sanitizer_drop_count?: number;
  } & Record<string, unknown>,
) => emitWithContext('aurora_photo_modules_schema_fail', ctx, props);

export const emitAuroraPhotoModulesModuleTap = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    module_id: string;
    selected: boolean;
    quality_grade?: string | null;
    sanitizer_drop_count?: number;
  } & Record<string, unknown>,
) => emitWithContext('aurora_photo_modules_module_tap', ctx, props);

export const emitAuroraPhotoModulesIssueTap = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    module_id: string;
    issue_type: string;
    selected: boolean;
    quality_grade?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('aurora_photo_modules_issue_tap', ctx, props);

export const emitAuroraPhotoModulesActionTap = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    module_id: string;
    action_type: string;
    ingredient_id: string;
    issue_types?: string[];
  } & Record<string, unknown>,
) => emitWithContext('aurora_photo_modules_action_tap', ctx, props);

export const emitAuroraPhotoModulesProductTap = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    module_id: string;
    product_id?: string | null;
    merchant_id?: string | null;
    source_block?: string | null;
    price_tier?: string | null;
    price?: number | null;
    currency?: string | null;
    title?: string;
  } & Record<string, unknown>,
) => emitWithContext('aurora_photo_modules_product_tap', ctx, props);

export const emitAuroraIngredientPlanProductTap = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    ingredient_id: string;
    product_id?: string | null;
    source_block?: 'competitor' | 'dupe' | string;
    price_tier?: string | null;
    price?: number | null;
    currency?: string | null;
    title?: string;
  } & Record<string, unknown>,
) => emitWithContext('aurora_ingredient_plan_product_tap', ctx, props);

export const emitOpenedCompatibility = (
  ctx: AnalyticsContext,
  props: {
    source: 'check_with_my_products' | 'how_to_layer';
    base_product_name?: string;
    selected_count?: number;
  } & Record<string, unknown>,
) => emitWithContext('opened_compatibility', ctx, props);

export const emitRanCompatibilityCheck = (
  ctx: AnalyticsContext,
  props: {
    base_product_name?: string;
    selected_count: number;
    sensitivity: 'Low' | 'Medium' | 'High';
    timing: 'AM' | 'PM' | 'Both';
    rating: 'good' | 'caution' | 'avoid_same_routine';
  } & Record<string, unknown>,
) => emitWithContext('ran_compatibility_check', ctx, props);

export const emitViewedCompatibilityResult = (
  ctx: AnalyticsContext,
  props: {
    rating: 'good' | 'caution' | 'avoid_same_routine';
    selected_count: number;
    base_product_name?: string;
  } & Record<string, unknown>,
) => emitWithContext('viewed_compatibility_result', ctx, props);
