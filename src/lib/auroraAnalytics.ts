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

export const emitIngredientsEntryOpened = (
  ctx: AnalyticsContext,
  props: {
    entry_source: 'chip' | 'deeplink' | 'other';
    action_id?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('ingredients_entry_opened', ctx, props);

export const emitIngredientsModeSelected = (
  ctx: AnalyticsContext,
  props: {
    mode: 'lookup' | 'by_goal';
    entry_source?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('ingredients_mode_selected', ctx, props);

export const emitIngredientsAnswerServed = (
  ctx: AnalyticsContext,
  props: {
    answer_type: 'ingredient_report' | 'ingredient_goal_match' | 'ingredient_hub';
    card_count?: number;
  } & Record<string, unknown>,
) => emitWithContext('ingredients_answer_served', ctx, props);

export const emitIngredientsOptinDiagnosis = (
  ctx: AnalyticsContext,
  props: {
    entry_source?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('ingredients_optin_diagnosis', ctx, props);

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

export const emitRecommendationDetailsSheetOpened = (
  ctx: AnalyticsContext,
  props: {
    track_count: number;
    item_count: number;
    source?: string | null;
    anchor_key?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('recommendation_details_sheet_opened', ctx, props);

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
    title?: string;
  } & Record<string, unknown>,
) => emitWithContext('aurora_photo_modules_product_tap', ctx, props);

export const emitAuroraProductParseMissing = (
  ctx: AnalyticsContext,
  props: {
    request_id?: string | null;
    bff_trace_id?: string | null;
    reason?: string | null;
    reasons?: string[];
  } & Record<string, unknown>,
) => emitWithContext('aurora_product_parse_missing', ctx, props);

export const emitAuroraProductAnalysisDegraded = (
  ctx: AnalyticsContext,
  props: {
    request_id?: string | null;
    bff_trace_id?: string | null;
    reason?: string | null;
    reasons?: string[];
    source_chain?: string[];
    blocked_reason?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('aurora_product_analysis_degraded', ctx, props);

export const emitIngredientProductOpenAttempt = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    product_id?: string | null;
    source_card_type?: string | null;
    url?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('ingredient_product_open_attempt', ctx, props);

export const emitIngredientProductOpenResult = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    product_id?: string | null;
    source_card_type?: string | null;
    url?: string | null;
    result: 'success_new_tab' | 'success_same_tab_fallback' | 'blocked_popup' | 'blocked_invalid_url' | 'failed_unknown';
    blocked_reason?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('ingredient_product_open_result', ctx, props);

export const emitDiscoveryLinkOpenAttempt = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    source_card_type?: string | null;
    url?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('discovery_link_open_attempt', ctx, props);

export const emitDiscoveryLinkOpenResult = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    source_card_type?: string | null;
    url?: string | null;
    result: 'success_new_tab' | 'success_same_tab_fallback' | 'blocked_popup' | 'blocked_invalid_url' | 'failed_unknown';
    blocked_reason?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('discovery_link_open_result', ctx, props);

export const emitOpenedCompatibility = (
  ctx: AnalyticsContext,
  props: {
    source: 'check_with_my_products' | 'how_to_layer' | 'advanced_compatibility_check';
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

export const emitAuroraProductAlternativesFiltered = (
  ctx: AnalyticsContext,
  props: {
    request_id?: string | null;
    bff_trace_id?: string | null;
    competitors_filtered?: number;
    related_filtered?: number;
    dupes_filtered?: number;
  } & Record<string, unknown>,
) => emitWithContext('aurora_product_alternatives_filtered', ctx, props);

export const emitAuroraHowToLayerInlineOpened = (
  ctx: AnalyticsContext,
  props: {
    request_id?: string | null;
    bff_trace_id?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('aurora_how_to_layer_inline_opened', ctx, props);

export const emitIntentDetected = (
  ctx: AnalyticsContext,
  props: {
    intent_id: string;
    confidence: number;
  } & Record<string, unknown>,
) => emitWithContext('intent_detected', ctx, props);

export const emitAuroraToolCalled = (
  ctx: AnalyticsContext,
  props: {
    tool_name: string;
    success?: boolean;
  } & Record<string, unknown>,
) => emitWithContext('aurora_tool_called', ctx, props);

export const emitCardImpression = (
  ctx: AnalyticsContext,
  props: {
    card_type: string;
    card_id?: string | null;
    card_position?: number;
  } & Record<string, unknown>,
) => emitWithContext('card_impression', ctx, props);

export const emitCardActionClick = (
  ctx: AnalyticsContext,
  props: {
    card_type: string;
    card_id?: string | null;
    action_type: string;
    action_label?: string | null;
  } & Record<string, unknown>,
) => emitWithContext('card_action_click', ctx, props);

export const emitTriageStageShown = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    card_position?: number;
    risk_level?: 'none' | 'low' | 'medium' | 'high' | string | null;
    recovery_window_hours?: number | null;
    red_flag_count?: number;
    action_point_count?: number;
  } & Record<string, unknown>,
) => emitWithContext('triage_stage_shown', ctx, props);

export const emitTriageActionTap = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    action_type: string;
    action_label?: string | null;
    risk_level?: 'none' | 'low' | 'medium' | 'high' | string | null;
    recovery_window_hours?: number | null;
  } & Record<string, unknown>,
) => emitWithContext('triage_action_tap', ctx, props);

export const emitNudgeActionTap = (
  ctx: AnalyticsContext,
  props: {
    card_id?: string | null;
    action_type: string;
    action_label?: string | null;
    cadence_days?: number | null;
    hint_count?: number;
  } & Record<string, unknown>,
) => emitWithContext('nudge_action_tap', ctx, props);

export const emitThreadOp = (
  ctx: AnalyticsContext,
  props: {
    op: 'thread_push' | 'thread_pop' | 'thread_update';
    topic_id: string;
  } & Record<string, unknown>,
) => emitWithContext(props.op, ctx, props);

export const emitMemoryWritten = (
  ctx: AnalyticsContext,
  props: {
    profile_written?: number;
    routine_written?: number;
    experiment_written?: number;
  } & Record<string, unknown>,
) => emitWithContext('memory_written', ctx, props);
