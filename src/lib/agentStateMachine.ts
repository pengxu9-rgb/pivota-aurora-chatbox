import specRaw from '@/specs/agent_state_machine.json';

export type AgentState =
  | 'IDLE_CHAT'
  | 'SOFT_INTENT_SUGGEST'
  | 'QUICK_PROFILE'
  | 'DIAG_PROFILE'
  | 'DIAG_PHOTO_OPTIN'
  | 'DIAG_ANALYSIS_SUMMARY'
  | 'ROUTINE_INTAKE'
  | 'ROUTINE_REVIEW'
  | 'MINIMAL_PLAN'
  | 'PRODUCT_LINK_EVAL'
  | 'RECO_GATE'
  | 'RECO_CONSTRAINTS'
  | 'RECO_RESULTS'
  | 'SAVE_PROFILE_PROMPT'
  | 'RETURN_WELCOME'
  | 'CHECKIN_PROMPT'
  | 'CHECKIN_FLOW'
  | 'SAFETY_TRIAGE';

export type TriggerSource = 'chip' | 'action' | 'text_explicit';

export type RequestedTransition = {
  trigger_source: TriggerSource;
  trigger_id: string;
  requested_next_state: AgentState;
};

type StateMachineChip = {
  chip_id: string;
  allowed_states: AgentState[];
  next_state: AgentState;
};

type AgentStateMachineSpec = {
  version: string;
  default_state: AgentState;
  states: AgentState[];
  trigger_source: TriggerSource[];
  chips: StateMachineChip[];
};

const SPEC = specRaw as unknown as AgentStateMachineSpec;

export const DEFAULT_AGENT_STATE: AgentState = SPEC.default_state || 'IDLE_CHAT';

const CHIP_ALIASES: Record<string, string> = {
  'chip.start.diagnosis': 'chip_start_diagnosis',
  'chip.start.evaluate': 'chip_eval_single_product',
  'chip.start.reco_products': 'chip_get_recos',
  'chip.start.routine': 'chip_get_recos',
  'chip.action.reco_routine': 'chip_get_recos',
};

export const normalizeAgentState = (raw: unknown): AgentState => {
  const s = String(raw ?? '').trim();
  return (SPEC.states as string[]).includes(s) ? (s as AgentState) : DEFAULT_AGENT_STATE;
};

export const canonicalizeChipId = (chipId: string): string => CHIP_ALIASES[String(chipId || '').trim()] ?? String(chipId || '').trim();

const findChip = (chipId: string): StateMachineChip | null => {
  const id = canonicalizeChipId(chipId);
  const chip = SPEC.chips.find((c) => c && c.chip_id === id);
  return chip ?? null;
};

export type TransitionValidation =
  | { ok: true; next_state: AgentState; canonical_trigger_id: string }
  | { ok: false; reason: string; canonical_trigger_id: string };

export const validateRequestedTransition = (args: {
  from_state: AgentState;
  trigger_source: TriggerSource;
  trigger_id: string;
  requested_next_state: AgentState;
}): TransitionValidation => {
  const fromState = normalizeAgentState(args.from_state);
  const triggerSource = args.trigger_source;
  const requestedNextState = normalizeAgentState(args.requested_next_state);
  const canonicalTriggerId = triggerSource === 'chip' ? canonicalizeChipId(args.trigger_id) : String(args.trigger_id || '').trim();

  if (requestedNextState === fromState) {
    return { ok: true, next_state: fromState, canonical_trigger_id: canonicalTriggerId };
  }

  if (!(SPEC.trigger_source as string[]).includes(triggerSource)) {
    return { ok: false, reason: 'TRIGGER_SOURCE_NOT_ALLOWED', canonical_trigger_id: canonicalTriggerId };
  }

  if (triggerSource === 'chip') {
    const chip = findChip(args.trigger_id);
    if (!chip) return { ok: false, reason: 'UNKNOWN_CHIP', canonical_trigger_id: canonicalTriggerId };
    if (chip.next_state !== requestedNextState) {
      return { ok: false, reason: 'CHIP_NEXT_STATE_MISMATCH', canonical_trigger_id: canonicalTriggerId };
    }
    if (!chip.allowed_states.includes(fromState)) {
      return { ok: false, reason: 'CHIP_NOT_ALLOWED_FROM_STATE', canonical_trigger_id: canonicalTriggerId };
    }
    return { ok: true, next_state: requestedNextState, canonical_trigger_id: canonicalTriggerId };
  }

  // For action/text_explicit, allow only if a spec chip could reach that state from this state.
  const reachable = SPEC.chips.some((c) => c && c.next_state === requestedNextState && c.allowed_states.includes(fromState));
  if (!reachable) {
    return { ok: false, reason: 'NEXT_STATE_NOT_REACHABLE', canonical_trigger_id: canonicalTriggerId };
  }

  return { ok: true, next_state: requestedNextState, canonical_trigger_id: canonicalTriggerId };
};

export const inferTextExplicitTransition = (
  message: string,
  language: 'EN' | 'CN',
): { requested_next_state: AgentState; trigger_id: string } | null => {
  const raw = String(message || '').trim();
  if (!raw) return null;

  const text = raw.toLowerCase();
  const isCN = language === 'CN';

  const matchesAny = (patterns: RegExp[]) => patterns.some((re) => re.test(raw) || re.test(text));

  // Keep diagnosis start explicit (EN-first, CN-second) so we don't accidentally enter diagnosis
  // for unrelated queries (e.g. product questions containing “诊断”).
  const looksLikeExplicitDiagnosisStart = (value: string): boolean => {
    const t = String(value || '').trim();
    if (!t) return false;
    const lower = t.toLowerCase();

    // EN-first: explicit allowlist only.
    const wantsDiagnosisEN =
      /\b(start|begin|run)\b.{0,40}\b(skin\s*)?(diagnos(?:e|is)?|analys(?:e|is)|analyz(?:e)?|assessment|scan|check)\b/.test(lower) ||
      /\b(diagnos(?:e|is)?|analys(?:e|is)|analyz(?:e)?|assessment|scan|check)\b.{0,40}\bmy\s*(skin|face)\b/.test(lower) ||
      /\b(skin|face)\b.{0,40}\b(diagnos(?:e|is)?|analys(?:e|is)|analyz(?:e)?|assessment|scan|check)\b/.test(lower) ||
      /\bskin\s*profile\b/.test(lower);
    if (wantsDiagnosisEN) return true;

    // CN-second: require both a skin subject + an explicit diagnosis/analysis verb.
    const hasSkinCN = /(皮肤|肤质|肤况|面部|脸部|脸)/.test(t);
    const hasDiagnosisCN = /(诊断|分析|检测|评估|测一测|测试)/.test(t);
    return hasSkinCN && hasDiagnosisCN;
  };

  const wantsDiagnosis = looksLikeExplicitDiagnosisStart(raw);

  if (wantsDiagnosis) return { requested_next_state: 'DIAG_PROFILE', trigger_id: raw.slice(0, 120) };

  const wantsRoutineReview = isCN ? matchesAny([/评估我现在用的/]) : matchesAny([/review my routine/i]);
  if (wantsRoutineReview) return { requested_next_state: 'ROUTINE_INTAKE', trigger_id: raw.slice(0, 120) };

  const wantsRecs = isCN
    ? matchesAny([/产品推荐/, /推荐/, /给我方案/])
    : matchesAny([/\brecommend\b/i, /product recommendations?/i, /build me a routine/i]);

  if (wantsRecs) return { requested_next_state: 'RECO_GATE', trigger_id: raw.slice(0, 120) };

  return null;
};
