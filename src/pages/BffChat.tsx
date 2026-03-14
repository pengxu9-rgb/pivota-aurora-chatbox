import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { BffHeaders, Card, RecoBlockType, RecoEmployeeFeedbackType, SuggestedChip, V1Action, V1Envelope } from '@/lib/pivotaAgentBff';
import { bffJson, bffChatStream, fetchRecoAlternatives, fetchRoutineSimulation, makeDefaultHeaders, PivotaAgentBffError, sendRecoEmployeeFeedback } from '@/lib/pivotaAgentBff';
import type { SSEResultEvent } from '@/lib/pivotaAgentBff';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import { AnalysisSummaryCard } from '@/components/chat/cards/AnalysisSummaryCard';
import { CardRenderBoundary } from '@/components/chat/CardRenderBoundary';
import { ChatRichText } from '@/components/chat/ChatRichText';
import { ChatCardsV1Card } from '@/components/chat/cards/ChatCardsV1Card';
import { DiagnosisCard } from '@/components/chat/cards/DiagnosisCard';
import { DiagnosisV2IntroCard } from '@/components/chat/cards/DiagnosisV2IntroCard';
import { DiagnosisV2PhotoPromptCard } from '@/components/chat/cards/DiagnosisV2PhotoPromptCard';
import { IngredientGoalMatchCard } from '@/components/chat/cards/IngredientGoalMatchCard';
import { IngredientHubCard } from '@/components/chat/cards/IngredientHubCard';
import { PhotoUploadCard } from '@/components/chat/cards/PhotoUploadCard';
import { ProductAnalysisCard } from '@/components/chat/cards/ProductAnalysisCard';
import { QuickProfileFlow } from '@/components/chat/cards/QuickProfileFlow';
import { RoutineCompatibilityFooter } from '@/components/chat/cards/RoutineCompatibilityFooter';
import { ReturnWelcomeCard } from '@/components/chat/cards/ReturnWelcomeCard';
import { ProductPicksCard } from '@/components/chat/cards/ProductPicksCard';
import { AuroraAnchorCard } from '@/components/aurora/cards/AuroraAnchorCard';
import { AuroraLoadingCard, type AuroraLoadingIntent, type ThinkingStep } from '@/components/aurora/cards/AuroraLoadingCard';
import { AuroraReferencesCard } from '@/components/aurora/cards/AuroraReferencesCard';
import { RoutineFitSummaryCard } from '@/components/aurora/cards/RoutineFitSummaryCard';
import { ConflictHeatmapCard } from '@/components/aurora/cards/ConflictHeatmapCard';
import { DupeComparisonCard } from '@/components/aurora/cards/DupeComparisonCard';
import { DupeSuggestCard } from '@/components/aurora/cards/DupeSuggestCard';
import { EnvStressCard } from '@/components/aurora/cards/EnvStressCard';
import { PhotoModulesCard } from '@/components/aurora/cards/PhotoModulesCard';
import { AnalysisStoryCard } from '@/components/aurora/cards/AnalysisStoryCard';
import { IngredientPlanCard } from '@/components/aurora/cards/IngredientPlanCard';
import { CompatibilityInsightsCard } from '@/components/aurora/cards/CompatibilityInsightsCard';
import { AuroraRoutineCard, type RoutineStep } from '@/components/aurora/cards/AuroraRoutineCard';
import { RoutineProductAuditCard } from '@/components/aurora/cards/RoutineProductAuditCard';
import { RoutineAdjustmentPlanCard } from '@/components/aurora/cards/RoutineAdjustmentPlanCard';
import { RoutineRecommendationCard } from '@/components/aurora/cards/RoutineRecommendationCard';
import { SkinIdentityCard } from '@/components/aurora/cards/SkinIdentityCard';
import { IngredientReportCard, type IngredientReportQuestionSelection } from '@/components/aurora/cards/IngredientReportCard';
import { extractExternalVerificationCitations } from '@/lib/auroraExternalVerification';
import { augmentEnvelopeWithIngredientReport } from '@/lib/ingredientReportCard';
import { humanizeKbNote } from '@/lib/auroraKbHumanize';
import { resolveAnalysisSummaryLowConfidence } from '@/lib/analysisSummary';
import { normalizePhotoModulesUiModelV1 } from '@/lib/photoModulesContract';
import { enrichPhotoModulesPayloadWithSessionPreview } from '@/lib/photoModulesFallback';
import { looksLikeProductPicksRawText } from '@/lib/productPicks';
import { extractRoutineProductsFromProfileCurrentRoutine } from '@/lib/routineCompatibility/routineSource';
import type { CompatibilityProductInput } from '@/lib/routineCompatibility/types';
import {
  inferTextExplicitTransition,
  normalizeAgentState,
  validateRequestedTransition,
  type AgentState,
  type RequestedTransition,
} from '@/lib/agentStateMachine';
import {
  emitAgentProfileQuestionAnswered,
  emitAgentStateEntered,
  emitPdpClick,
  emitPdpFailReason,
  emitPdpLatencyMs,
  emitPdpOpenPath,
  emitRecommendationDetailsSheetOpened,
  emitAuroraEmptyRecommendationsContractViolation,
  emitAuroraProductAnalysisDegraded,
  emitAuroraProductAlternativesFiltered,
  emitAuroraHowToLayerInlineOpened,
  emitAuroraProductParseMissing,
  emitUiChipClicked,
  emitUiLanguageSwitched,
  emitUiOutboundOpened,
  emitUiPdpOpened,
  emitAuroraPhotoModulesSchemaFail,
  emitIngredientsAnswerServed,
  emitIngredientsEntryOpened,
  emitIngredientsModeSelected,
  emitIngredientsOptinDiagnosis,
  emitUiRecosRequested,
  emitUiReturnVisit,
  emitUiSessionStarted,
  emitIntentDetected,
  emitAuroraToolCalled,
  emitCardImpression,
  emitCardActionClick,
  emitTriageStageShown,
  emitTriageActionTap,
  emitNudgeActionTap,
  emitThreadOp,
  emitMemoryWritten,
  type AnalyticsContext,
} from '@/lib/auroraAnalytics';
import { buildChatSession } from '@/lib/chatSession';
import { buildReturnWelcomeSummary, type ReturnWelcomeSummary } from '@/lib/returnWelcomeSummary';
import { patchGlowSessionProfile, type QuickProfileProfilePatch } from '@/lib/glowSessionProfile';
import type { DiagnosisResult, FlowState, Language as UiLanguage, Offer, Product, Session, SkinConcern, SkinType } from '@/lib/types';
import { t } from '@/lib/i18n';
import {
  AURORA_AUTH_SESSION_CHANGED_EVENT,
  clearAuroraAuthSession,
  loadAuroraAuthSession,
  saveAuroraAuthSession,
} from '@/lib/auth';
import type { TravelProductLookupQuery } from '@/lib/auroraEnvStress';
import {
  getLangMismatchHintMutedUntil,
  getLangReplyMode,
  setLangMismatchHintMutedUntil,
  setLangReplyMode,
  type LangPref,
  type LangReplyMode,
} from '@/lib/persistence';
import { isPhotoUsableForDiagnosis, normalizePhotoQcStatus } from '@/lib/photoQc';
import { buildGoogleSearchFallbackUrl, normalizeOutboundFallbackUrl } from '@/lib/externalSearchFallback';
import { parseChatResponseV1 } from '@/lib/chatCardsParser';
import type { ChatCardV1, ChatResponseV1, QuickReplyV1 } from '@/lib/chatCardsTypes';
import { adaptChatCardForRichRender } from '@/lib/chatCardsAdapters';
import {
  getComparableDisplayName,
  isComparableProductLike,
  looksLikeSelfRef,
  unwrapProductLike,
} from '@/lib/dupeCompareGuards';
import { toast } from '@/components/ui/use-toast';
import {
  buildPdpUrl,
  extractPdpTargetFromProductGroupId,
  extractStablePdpTargetFromProductsResolveResponse,
} from '@/lib/pivotaShop';
import { filterRecommendationCardsForState } from '@/lib/recoGate';
import { pickProductImageUrl } from '@/lib/productImage';
import { useShop } from '@/contexts/shop';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { AuroraSidebar } from '@/components/mobile/AuroraSidebar';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { loadChatHistory, type ChatHistoryItem } from '@/lib/chatHistory';
import { normalizeProfileFromBootstrap, buildProfileUpdatePatch } from '@/lib/auroraProfile';
import { parseCurrentRoutine } from '@/lib/currentRoutineState';
import { saveAuroraProfileCache } from '@/lib/userProfile';
import {
  Activity,
  ArrowRight,
  Beaker,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Copy,
  ExternalLink,
  FlaskConical,
  Globe,
  HelpCircle,
  AlertTriangle,
  ListChecks,
  Menu,
  RefreshCw,
  Search,
  Sparkles,
  ShoppingCart,
  User,
  Wallet,
  X,
} from 'lucide-react';

type ChatItem =
  | { id: string; role: 'user' | 'assistant'; kind: 'text'; content: string }
  | { id: string; role: 'assistant'; kind: 'cards'; cards: Card[]; meta?: Pick<V1Envelope, 'request_id' | 'trace_id' | 'events'> }
  | { id: string; role: 'assistant'; kind: 'chips'; chips: SuggestedChip[] }
  | { id: string; role: 'assistant'; kind: 'return_welcome'; summary: ReturnWelcomeSummary | null };

type ChatRequestMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const CHAT_CONTEXT_MESSAGE_LIMIT = 10;
const DIAGNOSIS_THREAD_STATE_KEYS = [
  'diagnosis_goals',
  'diagnosis_state',
  'diagnosis_followup_answers',
  'diagnosis_custom_input',
  'active_diagnosis_id',
  'blueprint_id',
] as const;

function buildChatRequestMessages(items: ChatItem[]): ChatRequestMessage[] {
  const messages: ChatRequestMessage[] = [];
  for (const item of items) {
    if (!item || item.kind !== 'text') continue;
    const content = String(item.content || '').trim();
    if (!content) continue;
    messages.push({ role: item.role, content });
  }
  return messages.slice(-CHAT_CONTEXT_MESSAGE_LIMIT);
}

type ProductAlternativeTrackItem = {
  candidate: Record<string, unknown>;
  display?: ProductAlternativeDisplayCandidate | null;
  block: RecoBlockType;
  rank: number;
  intent: 'replace' | 'pair';
};

type ProductAlternativeDisplayCandidate = {
  brand: string | null;
  name: string;
  why: string | null;
  tradeoff: string | null;
  bestUse: string | null;
  raw: Record<string, unknown>;
};

type ProductAlternativeTrack = {
  key: 'replace' | 'pair';
  title: string;
  subtitle: string;
  items: ProductAlternativeTrackItem[];
  filteredCount: number;
};

function buildAlternativeTradeoffSummary(candidate: Record<string, unknown>): string | null {
  const tradeoffs = asObject((candidate as any).tradeoffs) || asObject((candidate as any).tradeoff) || null;
  const priceDeltaUsd = asNumber((tradeoffs as any)?.price_delta_usd ?? (tradeoffs as any)?.priceDeltaUsd);
  const priceDeltaSummary = typeof priceDeltaUsd === 'number'
    ? `Price delta ${priceDeltaUsd >= 0 ? '+' : ''}$${priceDeltaUsd}`
    : null;
  return uniqueStrings([
    ...uniqueStrings((candidate as any).tradeoff_notes || (candidate as any).tradeoffNotes),
    ...uniqueStrings((candidate as any).compare_highlights || (candidate as any).compareHighlights).filter((line) => !isLikelyUrl(line)),
    ...asArray((tradeoffs as any)?.added_benefits).map((x) => asString(x)),
    ...asArray((tradeoffs as any)?.missing_actives).map((x) => {
      const token = asString(x);
      return token ? `Missing ${token}` : '';
    }),
    ...asArray((tradeoffs as any)?.texture_finish_differences ?? (tradeoffs as any)?.textureFinishDifferences).map((x) => asString(x)),
    asString((tradeoffs as any)?.availability_note ?? (tradeoffs as any)?.availabilityNote),
    priceDeltaSummary,
  ])[0] || null;
}

function normalizeAlternativeDisplayCandidate(rawCandidate: Record<string, unknown> | null): ProductAlternativeDisplayCandidate | null {
  const candidate = rawCandidate && typeof rawCandidate === 'object' && !Array.isArray(rawCandidate) ? rawCandidate : null;
  if (!candidate) return null;
  const product = asObject((candidate as any).product) || null;
  const whyCandidate = asObject((candidate as any).why_candidate || (candidate as any).whyCandidate) || null;
  const brand = asString((candidate as any).brand) || asString((product as any)?.brand) || null;
  const name =
    asString((candidate as any).name) ||
    asString((candidate as any).display_name) ||
    asString((candidate as any).displayName) ||
    asString((product as any)?.name) ||
    asString((product as any)?.display_name) ||
    asString((product as any)?.displayName) ||
    null;
  if (!name) return null;
  const why = uniqueStrings([
    asString((whyCandidate as any)?.summary),
    ...asArray((whyCandidate as any)?.reasons_user_visible ?? (whyCandidate as any)?.reasonsUserVisible).map((x) => asString(x)),
    ...asArray((candidate as any).reasons).map((x) => asString(x)),
  ])[0] || null;
  const bestUse =
    asString((candidate as any).best_use) ||
    asString((candidate as any).bestUse) ||
    asString((candidate as any).expected_outcome) ||
    asString((candidate as any).expectedOutcome) ||
    asString((product as any)?.best_use) ||
    asString((product as any)?.bestUse) ||
    null;
  return {
    brand,
    name,
    why,
    tradeoff: buildAlternativeTradeoffSummary(candidate),
    bestUse,
    raw: candidate,
  };
}

export type RoutineDraft = {
  am: { cleanser: string; treatment: string; moisturizer: string; spf: string };
  pm: { cleanser: string; treatment: string; moisturizer: string };
  notes: string;
};

export const makeEmptyRoutineDraft = (): RoutineDraft => ({
  am: { cleanser: '', treatment: '', moisturizer: '', spf: '' },
  pm: { cleanser: '', treatment: '', moisturizer: '' },
  notes: '',
});

export const hasAnyRoutineDraftInput = (draft: RoutineDraft): boolean => {
  const values = [
    draft.am.cleanser,
    draft.am.treatment,
    draft.am.moisturizer,
    draft.am.spf,
    draft.pm.cleanser,
    draft.pm.treatment,
    draft.pm.moisturizer,
    draft.notes,
  ];
  return values.some((v) => Boolean(String(v || '').trim()));
};

const normalizeRoutineDraftStep = (value: unknown): keyof RoutineDraft['am'] | null => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return null;
  if (token.includes('cleanser') || token.includes('wash') || token.includes('clean')) return 'cleanser';
  if (token.includes('spf') || token.includes('sunscreen') || token.includes('sun')) return 'spf';
  if (token.includes('moistur') || token.includes('cream') || token.includes('lotion')) return 'moisturizer';
  if (token.includes('treatment') || token.includes('serum') || token.includes('toner') || token.includes('essence') || token.includes('active')) return 'treatment';
  return null;
};

export const buildRoutineDraftFromProfile = (value: unknown): RoutineDraft | null => {
  const parsed = parseCurrentRoutine(value);
  if (!parsed) return null;

  const draft = makeEmptyRoutineDraft();
  for (const row of parsed.am) {
    const slot = normalizeRoutineDraftStep(row?.step);
    const product = String(row?.product || '').trim();
    if (!slot || !product) continue;
    draft.am[slot] = product;
  }
  for (const row of parsed.pm) {
    const slot = normalizeRoutineDraftStep(row?.step);
    const product = String(row?.product || '').trim();
    if (!slot || !product || slot === 'spf') continue;
    draft.pm[slot] = product;
  }
  draft.notes = String(parsed.notes || '').trim();

  return hasAnyRoutineDraftInput(draft) ? draft : null;
};

const hasAnyRoutineAmInput = (draft: RoutineDraft): boolean => {
  const values = [draft.am.cleanser, draft.am.treatment, draft.am.moisturizer, draft.am.spf];
  return values.some((v) => Boolean(String(v || '').trim()));
};

const copyRoutineAmToPm = (draft: RoutineDraft): RoutineDraft => ({
  ...draft,
  pm: {
    ...draft.pm,
    cleanser: String(draft.am.cleanser || ''),
    treatment: String(draft.am.treatment || ''),
    moisturizer: String(draft.am.moisturizer || ''),
  },
});

const buildCurrentRoutinePayloadFromDraft = (draft: RoutineDraft) => {
  const am: Array<{ step: string; product: string }> = [];
  const pm: Array<{ step: string; product: string }> = [];

  const pushStep = (list: Array<{ step: string; product: string }>, step: string, value: string) => {
    const v = String(value || '').trim();
    if (!v) return;
    list.push({ step, product: v.slice(0, 500) });
  };

  pushStep(am, 'cleanser', draft.am.cleanser);
  pushStep(am, 'treatment', draft.am.treatment);
  pushStep(am, 'moisturizer', draft.am.moisturizer);
  pushStep(am, 'spf', draft.am.spf);

  pushStep(pm, 'cleanser', draft.pm.cleanser);
  pushStep(pm, 'treatment', draft.pm.treatment);
  pushStep(pm, 'moisturizer', draft.pm.moisturizer);

  const notes = String(draft.notes || '').trim();

  return {
    schema_version: 'aurora.routine_intake.v1',
    am,
    pm,
    ...(notes ? { notes: notes.slice(0, 1200) } : {}),
  } as const;
};

const routineDraftToDisplayText = (draft: RoutineDraft, language: UiLanguage) => {
  const lines: string[] = [];

  const add = (label: string, value: string) => {
    const v = String(value || '').trim();
    if (!v) return;
    lines.push(`${label}: ${v}`);
  };

  lines.push('AM');
  add('Cleanser', draft.am.cleanser);
  add('Treatment', draft.am.treatment);
  add('Moisturizer', draft.am.moisturizer);
  add('SPF', draft.am.spf);

  lines.push('');
  lines.push('PM');
  add('Cleanser', draft.pm.cleanser);
  add('Treatment', draft.pm.treatment);
  add('Moisturizer', draft.pm.moisturizer);

  const notes = String(draft.notes || '').trim();
  if (notes) {
    lines.push('');
    lines.push(language === 'CN' ? `备注: ${notes}` : `Notes: ${notes}`);
  }

  return lines.join('\n').trim();
};

const nextId = (() => {
  let n = 0;
  return () => `m_${Date.now()}_${++n}`;
})();

const renderJson = (obj: unknown) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

const toBffErrorMessage = (err: unknown): string => {
  if (err instanceof PivotaAgentBffError) {
    const body = err.responseBody as any;
    const msg = body?.assistant_message?.content;
    const msgV1 = typeof body?.assistant_text === 'string' ? body.assistant_text : '';
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    if (typeof msgV1 === 'string' && msgV1.trim()) return msgV1.trim();
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
};

const parseMaybeUrl = (text: string): string | null => {
  const t = String(text || '').trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {
    // ignore
  }
  return null;
};

type QuickProfileStep = 'skin_feel' | 'goal_primary' | 'sensitivity_flag' | 'opt_in_more' | 'routine_complexity' | 'rx_flag';

const FF_RETURN_WELCOME = (() => {
  const raw = String(import.meta.env.VITE_FF_RETURN_WELCOME ?? 'true')
    .trim()
    .toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
})();

const FF_PHOTO_MODULES_CARD = (() => {
  const raw = String(import.meta.env.VITE_DIAG_PHOTO_MODULES_CARD ?? 'true')
    .trim()
    .toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
})();

const FF_SHOW_PASSIVE_GATES = (() => {
  const raw = String(import.meta.env.VITE_SHOW_PASSIVE_GATES ?? 'false')
    .trim()
    .toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
})();

const toLangPref = (language: UiLanguage): LangPref => (language === 'CN' ? 'cn' : 'en');

const LANGUAGE_MISMATCH_HINT_SNOOZE_MS = 6 * 60 * 60 * 1000;

const parseUiLanguageToken = (raw: unknown): UiLanguage | null => {
  const token = String(raw || '').trim().toUpperCase();
  if (token === 'CN' || token === 'EN') return token;
  return null;
};

const resolveIntroHintForLanguage = (introHint: ChatResponseV1['intro_hint'], language: UiLanguage): string => {
  if (typeof introHint === 'string') return introHint.trim();
  if (!introHint || typeof introHint !== 'object') return '';

  const preferred = language === 'CN' ? asString(introHint.zh) : asString(introHint.en);
  const fallback = language === 'CN' ? asString(introHint.en) : asString(introHint.zh);
  return preferred || fallback;
};

const toUiLanguageName = (lang: UiLanguage, copyLanguage: UiLanguage): string => {
  if (copyLanguage === 'CN') return lang === 'CN' ? '中文' : '英文';
  return lang === 'CN' ? 'Chinese' : 'English';
};

const buildLanguageMismatchStrategyChips = ({
  copyLanguage,
  currentUiLanguage,
  targetUiLanguage,
  telemetryUiLanguage,
  telemetryMatchingLanguage,
}: {
  copyLanguage: UiLanguage;
  currentUiLanguage: UiLanguage;
  targetUiLanguage: UiLanguage;
  telemetryUiLanguage: UiLanguage;
  telemetryMatchingLanguage: UiLanguage;
}): SuggestedChip[] => {
  const keepLabel =
    copyLanguage === 'CN'
      ? `继续${toUiLanguageName(currentUiLanguage, 'CN')}回复`
      : `Keep ${toUiLanguageName(currentUiLanguage, 'EN')} replies`;
  const switchLabel =
    copyLanguage === 'CN'
      ? `切换为${toUiLanguageName(targetUiLanguage, 'CN')}回复`
      : `Switch to ${toUiLanguageName(targetUiLanguage, 'EN')} replies`;
  const autoLabel = copyLanguage === 'CN' ? '自动跟随我的输入语言' : 'Auto-follow my input language';
  const sharedData = {
    trigger_source: 'language_mismatch',
    target_ui_lang: targetUiLanguage,
    ui_language: telemetryUiLanguage,
    matching_language: telemetryMatchingLanguage,
  };
  return [
    { chip_id: 'chip.lang.keep_ui', label: keepLabel, kind: 'quick_reply', data: sharedData },
    { chip_id: 'chip.lang.switch_ui', label: switchLabel, kind: 'quick_reply', data: sharedData },
    { chip_id: 'chip.lang.auto_follow', label: autoLabel, kind: 'quick_reply', data: sharedData },
  ];
};

const buildReturnWelcomeChips = (language: UiLanguage): SuggestedChip[] => {
  const isCN = language === 'CN';
  return [
    {
      chip_id: 'chip_keep_chatting',
      label: isCN ? '继续同一套' : 'Continue as-is',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
    {
      chip_id: 'chip_update_products',
      label: isCN ? '我换/加了产品' : 'I added/changed products',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
    {
      chip_id: 'chip_checkin_now',
      label: isCN ? '两周复盘' : '2-week check-in',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
    {
      chip_id: 'chip_eval_single_product',
      label: isCN ? '评估单品/链接' : 'Check a product/link',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
    {
      chip_id: 'chip_get_recos',
      label: isCN ? '获取产品推荐' : 'Get product recommendations',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
    {
      chip_id: 'chip.start.diagnosis',
      label: isCN ? '开始皮肤诊断' : 'Start skin diagnosis',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
  ];
};

const buildQuickProfileExitChips = (language: UiLanguage): SuggestedChip[] => {
  const isCN = language === 'CN';
  return [
    {
      chip_id: 'chip_eval_routine',
      label: isCN ? '评估现有产品/流程' : 'Review my current routine',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
    {
      chip_id: 'chip_eval_single_product',
      label: isCN ? '评估单品/链接' : 'Check a product/link',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
    {
      chip_id: 'chip.start.diagnosis',
      label: isCN ? '开始皮肤诊断' : 'Start skin diagnosis',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
    {
      chip_id: 'chip_keep_chatting',
      label: isCN ? '继续聊天' : 'Keep chatting',
      kind: 'quick_reply',
      data: { trigger_source: 'chip' },
    },
  ];
};

const buildQuickProfileBindChip = (language: UiLanguage): SuggestedChip => {
  const isCN = language === 'CN';
  return {
    chip_id: 'chip_login_sync_profile',
    label: isCN ? '登录并绑定资料' : 'Sign in to sync profile',
    kind: 'quick_reply',
    data: { trigger_source: 'chip' },
  };
};

const buildQuickProfileAdvice = (language: UiLanguage, profile: QuickProfileProfilePatch): string => {
  const isCN = language === 'CN';
  const goal = profile.goal_primary;
  const sens = profile.sensitivity_flag;
  const routine = profile.routine_complexity;
  const rx = profile.rx_flag;

  const lines: string[] = [];
  lines.push(isCN ? '小建议（基于你刚刚的选择，可能不完整）：' : 'Quick tip (based on what you shared — may be incomplete):');

  if (goal === 'breakouts') {
    lines.push(
      isCN
        ? '• 先做减法 7 天：温和洁面 + 保湿；早上坚持 SPF。'
        : '• Simplify for 7 days: gentle cleanser + moisturizer; always SPF in the morning.',
    );
    lines.push(
      isCN
        ? '• 想加一个控痘单品：从低频开始（每周 2–3 次），一次只加一个。'
        : '• If adding an acne active, start low frequency (2–3x/week) and introduce one at a time.',
    );
  } else if (goal === 'brightening') {
    lines.push(
      isCN
        ? '• 提亮优先：早上维C/烟酰胺择一，晚上主打保湿修护；早上 SPF 是“提亮加速器”。'
        : '• For brightening: pick one (vitamin C or niacinamide) in the AM, keep PM soothing; SPF is non-negotiable.',
    );
  } else if (goal === 'antiaging') {
    lines.push(
      isCN
        ? '• 抗老优先：先把“保湿 + SPF”打稳，再考虑晚间低频引入维A类。'
        : '• For anti-aging: lock in moisturizer + SPF first, then consider a low-frequency retinoid at night.',
    );
  } else if (goal === 'barrier') {
    lines.push(
      isCN
        ? '• 修护屏障：先停/减刺激（酸、去角质、强清洁），用“温和洁面 + 神经酰胺/修护型保湿”。'
        : '• For barrier repair: pause irritants (acids/exfoliation/harsh cleansing) and focus on a gentle cleanser + ceramide moisturizer.',
    );
  } else if (goal === 'spf') {
    lines.push(
      isCN ? '• 防晒优先：每天足量、可复涂的广谱 SPF，比“多叠活性”更有效。' : '• SPF-first: daily broad-spectrum sunscreen beats stacking actives.',
    );
  } else {
    lines.push(
      isCN ? '• 我们可以先从“温和洁面 + 保湿 + SPF”开始，再按你的目标加一件最关键的东西。' : '• We can start with cleanser + moisturizer + SPF, then add one key item based on your goal.',
    );
  }

  if (routine === '6+') {
    lines.push(isCN ? '• 你步骤较多：建议先把步骤压到 3–5 步，更容易判断“到底哪一步有效/刺激”。' : '• If you use 6+ steps: consider trimming to 3–5 to see what actually helps (or irritates).');
  }
  if (sens === 'yes' || sens === 'unsure') {
    lines.push(isCN ? '• 偏敏感：一次只加一个新东西，先做局部测试（patch test）。' : '• If sensitive: add one new thing at a time and patch test first.');
  }
  if (rx === 'yes') {
    lines.push(isCN ? '• 在用处方/维A：避免叠加太多酸类/刺激成分；如有不适以医生建议为准。' : '• If on prescription/retinoids: avoid stacking multiple strong actives; follow your clinician if irritation happens.');
  }

  lines.push(isCN ? '下一步你想先做什么？' : 'What would you like to do next?');
  return lines.join('\n');
};

const nextAgentStateForChip = (chipId: string): AgentState | null => {
  const id = String(chipId || '').trim();
  if (!id) return null;

  switch (id) {
    case 'chip_keep_chatting':
      return 'IDLE_CHAT';
    case 'chip_quick_profile':
      return 'QUICK_PROFILE';
    case 'chip_update_products':
      return 'ROUTINE_INTAKE';
    case 'chip_eval_routine':
      return 'ROUTINE_INTAKE';
    case 'chip_checkin_now':
      return 'CHECKIN_FLOW';
    case 'chip_eval_single_product':
      return 'PRODUCT_LINK_EVAL';
    case 'chip_get_recos':
      return 'RECO_GATE';
    case 'chip_start_diagnosis':
      return 'DIAG_PROFILE';

    // Back-compat chip ids used by the current bff flow
    case 'chip.start.diagnosis':
      return 'DIAG_PROFILE';
    case 'chip.start.evaluate':
      return 'PRODUCT_LINK_EVAL';
    case 'chip.start.routine':
      return 'ROUTINE_INTAKE';
    case 'chip.start.reco_products':
      return 'RECO_GATE';
    case 'chip.action.reco_routine':
      return 'ROUTINE_INTAKE';
    default:
      return null;
  }
};

type IconType = React.ComponentType<{ className?: string }>;

const iconForChip = (chipId: string): IconType => {
  const id = String(chipId || '').toLowerCase();
  if (id.startsWith('profile.')) return User;
  if (id.startsWith('chip.budget.')) return Wallet;
  if (id.includes('diagnosis')) return Activity;
  if (id.includes('reco_products')) return Sparkles;
  if (id.includes('routine')) return Sparkles;
  if (id.includes('evaluate') || id.includes('analyze')) return Search;
  if (id.includes('dupe')) return Copy;
  if (id.includes('ingredient')) return FlaskConical;
  if (id.startsWith('chip.clarify.')) return HelpCircle;
  if (id.startsWith('chip.aurora.next_action.')) return ArrowRight;
  return ArrowRight;
};

type ChipVisualRole = 'primary' | 'skip' | 'default';

const normalizeChipToken = (input: unknown): string => String(input || '').trim().toLowerCase();

const includesAnyToken = (value: string, tokens: readonly string[]): boolean =>
  tokens.some((token) => value.includes(token));

const isSkipLikeChip = (chip: SuggestedChip): boolean => {
  const id = normalizeChipToken(chip.chip_id);
  const label = normalizeChipToken(chip.label);

  const idSkipTokens = [
    'skip',
    'not_now',
    'not-now',
    'later',
    'without_photo',
    'without_photos',
    'continue_without',
    'baseline_only',
  ] as const;
  const labelSkipTokens = [
    'skip',
    'not now',
    'later',
    'continue without',
    'baseline only',
    '跳过',
    '稍后',
    '先不了',
    '不上传',
    '仅基线',
  ] as const;

  return includesAnyToken(id, idSkipTokens) || includesAnyToken(label, labelSkipTokens);
};

const primaryChipScore = (chip: SuggestedChip): number => {
  if (isSkipLikeChip(chip)) return -1;

  const id = normalizeChipToken(chip.chip_id);
  const label = normalizeChipToken(chip.label);
  let score = 0;

  const strongIdTokens = [
    'reco',
    'recommend',
    'analysis_continue',
    'start_diagnosis',
    'start.diagnosis',
    'upload_photos',
    'complete_profile',
    'login_sync_profile',
    'quick_profile',
  ] as const;
  const strongLabelTokens = ['continue', 'start', 'analyze', 'recommend', 'save', 'complete', '继续', '开始', '分析', '推荐', '保存', '完成'] as const;

  if (id.startsWith('chip.start.')) score += 1;
  if (includesAnyToken(id, strongIdTokens)) score += 3;
  if (includesAnyToken(label, strongLabelTokens)) score += 2;

  return score;
};

const getChipVisualRoles = (chips: SuggestedChip[]): ChipVisualRole[] => {
  let primaryIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < chips.length; i += 1) {
    const score = primaryChipScore(chips[i]);
    if (score > bestScore) {
      bestScore = score;
      primaryIndex = i;
    }
  }

  return chips.map((chip, index) => {
    if (isSkipLikeChip(chip)) return 'skip';
    if (index === primaryIndex) return 'primary';
    return 'default';
  });
};

const CHAT_CARDS_V1_TYPES = new Set([
  'product_verdict',
  'compatibility',
  'routine',
  'triage',
  'skin_status',
  'effect_review',
  'travel',
  'nudge',
]);

const iconForCard = (type: string): IconType => {
  const t = String(type || '').toLowerCase();
  if (t === 'product_verdict') return Search;
  if (t === 'compatibility') return ListChecks;
  if (t === 'routine') return Sparkles;
  if (t === 'triage') return AlertTriangle;
  if (t === 'skin_status') return Activity;
  if (t === 'effect_review') return RefreshCw;
  if (t === 'travel') return Globe;
  if (t === 'nudge') return Sparkles;
  if (t === 'diagnosis_gate') return Activity;
  if (t === 'budget_gate') return Wallet;
  if (t === 'ingredient_hub') return FlaskConical;
  if (t === 'ingredient_goal_match') return FlaskConical;
  if (t === 'ingredient_plan') return FlaskConical;
  if (t === 'ingredient_plan_v2') return FlaskConical;
  if (t === 'analysis_story_v2') return ListChecks;
  if (t === 'routine_product_audit_v1') return Search;
  if (t === 'routine_adjustment_plan_v1') return ListChecks;
  if (t === 'routine_recommendation_v1') return Sparkles;
  if (t === 'routine_prompt') return Sparkles;
  if (t === 'confidence_notice') return AlertTriangle;
  if (t === 'recommendations') return Sparkles;
  if (t === 'profile') return User;
  if (t.includes('photo')) return Camera;
  if (t.includes('product')) return Search;
  if (t.includes('dupe')) return Copy;
  if (t.includes('routine')) return Sparkles;
  if (t.includes('offer') || t.includes('checkout')) return Wallet;
  if (t.includes('structured')) return Beaker;
  return Beaker;
};

const titleForCard = (type: string, language: 'EN' | 'CN'): string => {
  const t = String(type || '');
  const key = t.toLowerCase();
  if (key === 'product_verdict') return language === 'CN' ? '产品决策结论' : 'Product verdict';
  if (key === 'compatibility') return language === 'CN' ? '搭配与冲突建议' : 'Compatibility';
  if (key === 'routine') return language === 'CN' ? 'AM/PM 护肤流程' : 'Routine';
  if (key === 'triage') return language === 'CN' ? '应急分诊建议' : 'Triage';
  if (key === 'skin_status') return language === 'CN' ? '当前肤况判断' : 'Skin status';
  if (key === 'effect_review') return language === 'CN' ? '效果复盘' : 'Effect review';
  if (key === 'travel') return language === 'CN' ? '旅行模式' : 'Travel mode';
  if (key === 'nudge') return language === 'CN' ? '可选加分项' : 'Optional nudge';
  if (key === 'diagnosis_gate') return language === 'CN' ? '先做一个极简肤况确认' : 'Quick skin profile first';
  if (key === 'budget_gate') return language === 'CN' ? '预算确认' : 'Budget';
  if (key === 'ingredient_hub') return language === 'CN' ? '成分查询入口' : 'Ingredient hub';
  if (key === 'ingredient_goal_match') return language === 'CN' ? '按功效找成分' : 'Ingredient goal match';
  if (key === 'analysis_summary') return language === 'CN' ? '肤况分析（7 天策略）' : 'Skin assessment (7-day plan)';
  if (key === 'ingredient_plan') return language === 'CN' ? '成分策略' : 'Ingredient plan';
  if (key === 'ingredient_plan_v2') return language === 'CN' ? '成分策略（个性化）' : 'Ingredient plan (personalized)';
  if (key === 'analysis_story_v2') return language === 'CN' ? '分析解读' : 'Analysis story';
  if (key === 'routine_product_audit_v1') return language === 'CN' ? '当前产品拆解' : 'Your current products';
  if (key === 'routine_adjustment_plan_v1') return language === 'CN' ? '先改什么' : 'What to change first';
  if (key === 'routine_recommendation_v1') return language === 'CN' ? '如果要升级，先补这里' : 'If you upgrade, start here';
  if (key === 'routine_prompt') return language === 'CN' ? '补全 Routine' : 'Complete routine';
  if (key === 'confidence_notice') return language === 'CN' ? '置信度提示' : 'Confidence notice';
  if (key === 'recommendations') return language === 'CN' ? '产品推荐' : 'Product Recommendations';
  if (key === 'product_parse') return language === 'CN' ? '产品解析' : 'Product parse';
  if (key === 'product_analysis') return language === 'CN' ? '单品评估（Deep Scan）' : 'Product deep scan';
  if (key === 'dupe_suggest') return language === 'CN' ? '平替与对标' : 'Dupes + comparables';
  if (key === 'dupe_compare') return language === 'CN' ? '平替对比（Tradeoffs）' : 'Dupe compare (tradeoffs)';
  if (key === 'routine_simulation') return language === 'CN' ? '兼容性测试' : 'Compatibility test';
  if (key === 'offers_resolved') return language === 'CN' ? '购买渠道/Offer' : 'Offers';
  if (key === 'profile') return language === 'CN' ? '肤况资料' : 'Profile';
  if (key === 'photo_presign') return language === 'CN' ? '照片上传' : 'Photo upload';
  if (key === 'photo_confirm') return language === 'CN' ? '照片质检' : 'Photo QC';
  if (key === 'aurora_structured') return language === 'CN' ? '结构化结果' : 'Structured result';
  if (key === 'gate_notice') return language === 'CN' ? '门控提示' : 'Gate notice';
  if (key === 'error') return language === 'CN' ? '错误' : 'Error';
  return t || (language === 'CN' ? '卡片' : 'Card');
};

const collapsePhotoConfirmWhenAnalysisPresent = (cards: Card[]): Card[] => {
  if (!Array.isArray(cards) || cards.length < 2) return cards;
  const hasAnalysisSummary = cards.some((card) => String(card?.type || '').trim().toLowerCase() === 'analysis_summary');
  if (!hasAnalysisSummary) return cards;
  return cards.filter((card) => String(card?.type || '').trim().toLowerCase() !== 'photo_confirm');
};

const collapseAnalysisSummaryCards = (cards: Card[]): Card[] => {
  if (!Array.isArray(cards) || cards.length < 2) return cards;
  let keptAnalysisSummary = false;
  const out: Card[] = [];
  for (let i = cards.length - 1; i >= 0; i -= 1) {
    const card = cards[i];
    const type = String(card?.type || '').trim().toLowerCase();
    if (type === 'analysis_summary') {
      if (keptAnalysisSummary) continue;
      keptAnalysisSummary = true;
    }
    out.push(card);
  }
  out.reverse();
  return out;
};

const removePhotoConfirmCardsFromHistory = (items: ChatItem[]): ChatItem[] => {
  if (!Array.isArray(items) || items.length === 0) return items;
  const out: ChatItem[] = [];
  for (const item of items) {
    if (item.kind !== 'cards') {
      out.push(item);
      continue;
    }
    const filteredCards = item.cards.filter((card) => String(card?.type || '').trim().toLowerCase() !== 'photo_confirm');
    if (!filteredCards.length) continue;
    if (filteredCards.length === item.cards.length) {
      out.push(item);
      continue;
    }
    out.push({ ...item, cards: filteredCards });
  }
  return out;
};

const removeAnalysisSummaryCardsFromHistory = (items: ChatItem[]): ChatItem[] => {
  if (!Array.isArray(items) || items.length === 0) return items;
  const out: ChatItem[] = [];
  for (const item of items) {
    if (item.kind !== 'cards') {
      out.push(item);
      continue;
    }
    const filteredCards = item.cards.filter((card) => String(card?.type || '').trim().toLowerCase() !== 'analysis_summary');
    if (!filteredCards.length) continue;
    if (filteredCards.length === item.cards.length) {
      out.push(item);
      continue;
    }
    out.push({ ...item, cards: filteredCards });
  }
  return out;
};

type RecoItem = Record<string, unknown> & { slot?: string };

const isEnvStressCard = (card: Card): boolean => {
  const norm = (input: string) =>
    String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const type = norm(String(card?.type || ''));
  if (!type) return false;
  if (type === 'env_stress' || type === 'environment_stress') return true;
  if (type.includes('env_stress') || type.includes('environment_stress')) return true;

  const payload = card?.payload;
  const schema =
    payload && typeof payload === 'object' && !Array.isArray(payload) && typeof (payload as any).schema_version === 'string'
      ? norm(String((payload as any).schema_version || ''))
      : '';
  return Boolean(schema && (schema.includes('env_stress') || schema.includes('environment_stress')));
};

const isConflictHeatmapCard = (card: Card): boolean => {
  const norm = (input: string) =>
    String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const type = norm(String(card?.type || ''));
  if (type === 'conflict_heatmap' || type === 'heatmap') return true;
  if (type.includes('conflict_heatmap')) return true;

  const payload = card?.payload;
  const schema =
    payload && typeof payload === 'object' && !Array.isArray(payload) && typeof (payload as any).schema_version === 'string'
      ? norm(String((payload as any).schema_version || ''))
      : '';
  return Boolean(schema && schema.includes('conflict_heatmap'));
};

const isRoutineSimulationCard = (card: Card): boolean => {
  const norm = (input: string) =>
    String(input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  return norm(String(card?.type || '')) === 'routine_simulation';
};

const asArray = (v: unknown) => (Array.isArray(v) ? v : []);
const asObject = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const asString = (v: unknown) => (typeof v === 'string' ? v : v == null ? null : String(v));
const isTruthyFlag = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  const token = String(v ?? '')
    .trim()
    .toLowerCase();
  return token === '1' || token === 'true' || token === 'yes' || token === 'on';
};
const PASSIVE_PROFILE_CHIP_PREFIXES = ['chip.profile.pregnancy.', 'chip.profile.age_band.', 'chip.profile.lactation.'];
const isPassiveProfileChipId = (chipId: string): boolean => {
  const token = String(chipId || '').trim().toLowerCase();
  if (!token) return false;
  return PASSIVE_PROFILE_CHIP_PREFIXES.some((prefix) => token.startsWith(prefix));
};
const isPassiveAdvisoryNoticeCard = (card: Card): boolean => {
  if (String(card?.type || '').trim().toLowerCase() !== 'confidence_notice') return false;
  const payload = asObject(card?.payload) ?? {};
  const reason = String((payload as any).reason || '').trim().toLowerCase();
  if (!reason) return false;
  if (reason === 'pregnancy_optional_profile') return true;
  const nonBlocking = isTruthyFlag((payload as any).non_blocking);
  if (!nonBlocking) return false;
  return reason === 'safety_optional_profile_missing' || reason === 'gate_advisory';
};
const filterPassiveAdvisoryCards = (cards: Card[], showPassive: boolean): Card[] => {
  if (showPassive) return cards;
  return cards.filter((card) => !isPassiveAdvisoryNoticeCard(card));
};
const filterPassiveAdvisoryChips = (chips: SuggestedChip[], showPassive: boolean): SuggestedChip[] => {
  if (showPassive) return chips;
  return chips.filter((chip) => {
    const chipId = String((chip && (chip as any).chip_id) || '').trim();
    return !isPassiveProfileChipId(chipId);
  });
};
const normalizeChipDedupToken = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const buildChipDedupKey = (chip: SuggestedChip): string => {
  const data = asObject((chip as any)?.data) ?? {};
  const actionId = normalizeChipDedupToken((data as any).action_id);
  if (actionId) return `action:${actionId}`;
  const followUpOptionId = normalizeChipDedupToken((data as any).follow_up_option_id);
  if (followUpOptionId) return `followup_option:${followUpOptionId}`;
  const chipId = normalizeChipDedupToken((chip as any)?.chip_id);
  if (chipId) return `chip:${chipId}`;
  const label = normalizeChipDedupToken((chip as any)?.label);
  const replyText = normalizeChipDedupToken((data as any).reply_text);
  return `text:${label}::${replyText}`;
};
const dedupeSuggestedChips = (chips: SuggestedChip[], max = 12): SuggestedChip[] => {
  const out: SuggestedChip[] = [];
  const seen = new Set<string>();
  const rows = Array.isArray(chips) ? chips : [];
  for (const chip of rows) {
    if (!chip || typeof chip !== 'object') continue;
    const key = buildChipDedupKey(chip);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
    if (out.length >= max) break;
  }
  return out;
};
const asNumber = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const isRecoBlockType = (v: unknown): v is RecoBlockType =>
  v === 'competitors' || v === 'dupes' || v === 'related_products';

const normalizeRecoLabel = (v: unknown): RecoEmployeeFeedbackType | null => {
  const token = String(v || '').trim().toLowerCase();
  if (token === 'relevant' || token === 'not_relevant' || token === 'wrong_block') return token;
  return null;
};

const formatRecoLabel = (label: RecoEmployeeFeedbackType, language: UiLanguage) => {
  if (language === 'CN') {
    if (label === 'relevant') return '相关';
    if (label === 'not_relevant') return '不相关';
    return '分块错了';
  }
  if (label === 'relevant') return 'Relevant';
  if (label === 'not_relevant') return 'Not relevant';
  return 'Wrong block';
};

const isInternalKbCitationId = (raw: string): boolean => {
  const v = String(raw || '').trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower.startsWith('kb:')) return true;
  if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)) return true;
  return false;
};

const FRAGRANCE_FREE_RE = /\b(no fragrance|fragrance[\s-]*free|without fragrance|fragrance not listed|no parfum)\b/i;

function filterContradictoryFragranceFlags(flags: string[]): string[] {
  const hasDescriptiveFragranceFree = flags.some(
    (f) => f.length > 12 && FRAGRANCE_FREE_RE.test(f),
  );
  if (!hasDescriptiveFragranceFree) return flags;
  return flags.filter((f) => f.toLowerCase() !== 'fragrance');
}

const ACK_PREFIX_WITH_PUNCT_RE =
  /^(?:got it|okay|ok|sure|great|understood|received|收到|好的|明白了|已收到)\s*(?:✅|☑️|✔️)?\s*(?:[—–-]|[,，:：]|[.!?。！？])\s*/i;
const ACK_PREFIX_WITH_ICON_RE = /^(?:got it|okay|ok|sure|great|understood|received|收到|好的|明白了|已收到)\s*(?:✅|☑️|✔️)\s*/i;
const ACK_FILLER_ONLY_RE = /^i[’']ll keep (?:it|this) clear and practical\.?$/i;

const stripAcknowledgementLead = (rawLine: string): string => {
  const trimmed = rawLine.replace(/^[ \t]+|[ \t]+$/g, '');
  if (!trimmed) return '';

  let next = trimmed.replace(ACK_PREFIX_WITH_PUNCT_RE, '');
  next = next.replace(ACK_PREFIX_WITH_ICON_RE, '');
  next = next.replace(/^[ \t]+|[ \t]+$/g, '');

  if (ACK_FILLER_ONLY_RE.test(next)) return '';
  return next;
};

const stripInternalKbRefsFromText = (raw: string): string => {
  const input = String(raw || '');
  if (!input.trim()) return input;

  const withoutKb = input.replace(/\bkb:[a-z0-9_-]+\b/gi, '');
  const cleaned = withoutKb
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((line) => stripAcknowledgementLead(line))
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^(evidence|citation|citations|source|sources)[:：]?\s*$/i.test(t)) return false;
      if (/^(证据|引用|来源)[:：]?\s*$/.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
};

const isLikelyUrl = (raw: string): boolean => /^https?:\/\//i.test(String(raw || '').trim());

const looksLikeWeatherOrEnvironmentQuestion = (text: string): boolean => {
  const t = String(text || '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  if (/\b(snow|rain|weather|humidity|uv|climate|wind|dry air|cold|heat|sun exposure|travel|itinerary|destination|flight|ski)\b/i.test(lower))
    return true;

  if (
    /(下雪|雪天|下雨|雨天|天气|气温|温度|湿度|紫外线|UV|风大|大风|寒冷|冷空气|高温|热浪|干燥(空气|天气)?|雾霾|污染|花粉|旅行|出差|飞行|飞机|高原|海边|滑雪|户外)/.test(
      t,
    )
  )
    return true;

  return false;
};

type ThinkingStepSetter = React.Dispatch<React.SetStateAction<ThinkingStep[]>>;
const startSimulatedThinking = (
  steps: string[],
  setter: ThinkingStepSetter,
  intervalMs = 1200,
): (() => void) => {
  let idx = 0;
  const timer = setInterval(() => {
    idx += 1;
    if (idx < steps.length) {
      setter((prev) => {
        const updated = prev.map((s) => ({ ...s, completed: true }));
        return [...updated, { step: `sim_${idx}`, message: steps[idx], completed: false }];
      });
    }
  }, intervalMs);
  return () => clearInterval(timer);
};

const ANALYSIS_SIM_STEPS: Record<string, string[]> = {
  EN: ['Scanning skin features...', 'Cross-referencing conditions...', 'Building skin blueprint...', 'Preparing results...'],
  CN: ['正在扫描皮肤特征...', '交叉检查肤况...', '构建肤质蓝图...', '正在准备结果...'],
};

const inferAuroraLoadingIntent = (message?: string, action?: V1Action): AuroraLoadingIntent => {
  const msg = String(message || '').trim();
  if (looksLikeWeatherOrEnvironmentQuestion(msg)) return 'environment';

  const replyText =
    action && typeof action === 'object' && typeof (action as any).data === 'object' && (action as any).data
      ? String((action as any).data.reply_text || (action as any).data.replyText || '').trim()
      : '';
  if (looksLikeWeatherOrEnvironmentQuestion(replyText)) return 'environment';

  const actionId =
    action && typeof action === 'object' && typeof (action as any).action_id === 'string'
      ? String((action as any).action_id).trim()
      : '';
  if (/env[_-]?stress|environment[_-]?stress|weather|itinerary/i.test(actionId)) return 'environment';

  return 'default';
};

const asNumberRecord = (v: unknown): Record<string, number> | undefined => {
  const o = asObject(v);
  if (!o) return undefined;
  const out: Record<string, number> = {};
  for (const [k, raw] of Object.entries(o)) {
    const key = String(k || '').trim();
    if (!key) continue;
    const n = asNumber(raw);
    if (n == null) continue;
    out[key] = n;
  }
  return Object.keys(out).length ? out : undefined;
};

const uniqueStrings = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const v = String(raw ?? '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
};

type IngredientRenderMode = 'show_products' | 'empty_match' | 'pending_match';

const deriveIngredientRenderMode = (payload: Record<string, unknown> | null | undefined): IngredientRenderMode => {
  if (!payload || typeof payload !== 'object') return 'show_products';
  const emptyReason = String((payload as any)?.products_empty_reason ?? '').trim();
  const matched = (payload as any)?.constraint_match_summary?.matched;
  const confidence = (payload as any)?.recommendation_confidence_score;
  const taskMode = String((payload as any)?.recommendation_meta?.task_mode ?? (payload as any)?.task_mode ?? '').trim();
  const matcherPending = (payload as any)?.metadata?.matcher_check_result?.pending;

  if (
    emptyReason === 'ingredient_constraint_no_match' ||
    emptyReason === 'ingredient_no_verified_candidates' ||
    taskMode === 'ingredient_lookup_no_candidates' ||
    (matched === 0 && typeof matched === 'number') ||
    (confidence === 0 && typeof confidence === 'number' && taskMode.startsWith('ingredient_'))
  ) {
    return 'empty_match';
  }
  if (matcherPending === true && taskMode.startsWith('ingredient_')) return 'pending_match';
  return 'show_products';
};

const INTERNAL_MISSING_INFO_PATTERNS: RegExp[] = [
  /^reco_dag_/i,
  /^url_/i,
  /^upstream_/i,
  /^internal_/i,
  /^skin_fit\.profile\./i,
  /^raw\./i,
  /^anchor_filtered_/i,
  /^competitor_recall_/i,
  /^catalog_ann_/i,
  /^catalog_source_/i,
  /^resolver_/i,
];

const USER_VISIBLE_MISSING_INFO_CODES = new Set([
  'url_fetch_forbidden_403',
  'url_fetch_recovered_with_fallback',
  'on_page_fetch_blocked',
  'regulatory_source_used',
  'incidecoder_source_used',
  'incidecoder_no_match',
  'incidecoder_fetch_failed',
  'incidecoder_unverified_not_persisted',
  'version_verification_needed',
  'llm_verification_used',
  'retail_source_no_match',
  'retail_source_used',
  'ingredient_concentration_unknown',
]);

const isInternalMissingInfoCode = (code: string): boolean => {
  const token = String(code || '').trim();
  if (!token) return false;
  if (USER_VISIBLE_MISSING_INFO_CODES.has(token.toLowerCase())) return false;
  return INTERNAL_MISSING_INFO_PATTERNS.some((pattern) => pattern.test(token));
};

const normalizeSocialChannelName = (raw: unknown): string | null => {
  const token = String(raw || '').trim().toLowerCase();
  if (!token) return null;
  if (token === 'reddit' || token === 'red') return 'Reddit';
  if (token === 'xiaohongshu' || token === 'xhs') return 'Xiaohongshu';
  if (token === 'tiktok') return 'TikTok';
  if (token === 'youtube' || token === 'yt') return 'YouTube';
  if (token === 'instagram' || token === 'ig') return 'Instagram';
  return null;
};

const asSkinType = (v: unknown): SkinType | null => {
  const s = asString(v);
  if (!s) return null;
  const norm = s.trim().toLowerCase();
  if (norm === 'oily' || norm === 'dry' || norm === 'combination' || norm === 'normal' || norm === 'sensitive') return norm as SkinType;
  return null;
};

const GOAL_TO_CONCERN: Record<string, SkinConcern> = {
  acne: 'acne',
  'dark spots': 'dark_spots',
  dark_spots: 'dark_spots',
  hyperpigmentation: 'dark_spots',
  dullness: 'dullness',
  wrinkles: 'wrinkles',
  aging: 'wrinkles',
  redness: 'redness',
  pores: 'pores',
  dehydration: 'dehydration',
  repair: 'dehydration',
  barrier: 'dehydration',
};

const asConcern = (v: unknown): SkinConcern | null => {
  const s = asString(v);
  if (!s) return null;
  const norm = s.trim().toLowerCase();
  return GOAL_TO_CONCERN[norm] ?? null;
};

const pickPreferredId = (
  values: Array<string | null | undefined>,
  isOpaque: (value: unknown) => boolean,
): string | null => {
  const candidates = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (!candidates.length) return null;
  const nonOpaque = candidates.find((value) => !isOpaque(value));
  return nonOpaque || candidates[0] || null;
};

function toDiagnosisResult(profile: Record<string, unknown> | null): DiagnosisResult {
  const skinType = asSkinType(profile?.skinType);
  const goals = asArray(profile?.goals);
  const concerns = goals.map((g) => asConcern(g)).filter(Boolean) as SkinConcern[];

  const barrierRaw = asString(profile?.barrierStatus);
  const barrier = barrierRaw ? barrierRaw.trim().toLowerCase() : '';
  const barrierStatus: DiagnosisResult['barrierStatus'] =
    barrier === 'healthy' || barrier === 'impaired' || barrier === 'unknown' ? (barrier as DiagnosisResult['barrierStatus']) : 'unknown';

  return {
    ...(skinType ? { skinType } : {}),
    concerns,
    currentRoutine: 'basic',
    ...(barrierStatus ? { barrierStatus } : {}),
  };
}

const VIEW_DETAILS_REQUEST_TIMEOUT_MS = 3500;
const VIEW_DETAILS_RESOLVE_TIMEOUT_MS = 3500;
const TRAVEL_PRODUCT_LOOKUP_TIMEOUT_MS = 10000;
const PROFILE_UPDATE_TIMEOUT_MS = 4000;
const CHAT_TIMEOUT_MS = 30000;
const ROUTINE_CHAT_TIMEOUT_MS = 28000;
const ANALYSIS_REQUEST_TIMEOUT_MS = 45000;
const RECO_ALTERNATIVES_LAZY_TIMEOUT_MS = 8000;
const RECO_COMPATIBILITY_LAZY_TIMEOUT_MS = 6000;
const MIN_ACTIONABLE_NOTICE_LEN = 18;
const PDP_EXTERNAL_FALLBACK_REASON_CODES = new Set(['NO_CANDIDATES', 'DB_ERROR', 'UPSTREAM_TIMEOUT']);
const PDP_EXTERNAL_DIRECT_OPEN_REASON_CODES = new Set(['NO_CANDIDATES']);
const PDP_EXTERNAL_RETRY_INTERNAL_REASON_CODES = new Set(['DB_ERROR', 'UPSTREAM_TIMEOUT']);
const RECO_PDP_NO_CANDIDATES_RETRY_ENABLED = (() => {
  const raw = String(import.meta.env.VITE_AURORA_RECO_PDP_NO_CANDIDATES_RETRY ?? 'true')
    .trim()
    .toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
})();

const isRoutineChatAction = (action?: V1Action): boolean => {
  if (!action || typeof action !== 'object') return false;
  const actionId = String((action as any).action_id || '').trim().toLowerCase();
  if (!actionId) return false;
  return actionId.includes('routine');
};

function toUiProduct(raw: Record<string, unknown>, language: UiLanguage): Product {
  const isUnknownToken = (value: unknown) => /^(unknown|n\/a|na|null|undefined|-|—)$/i.test(String(value ?? '').trim());
  const inferCategoryFromName = (nameText: string) => {
    const n = nameText.toLowerCase();
    if (/\bserum|ampoule\b/.test(n)) return language === 'CN' ? '精华' : 'Serum';
    if (/\bcleanser|wash|foam\b/.test(n)) return language === 'CN' ? '洁面' : 'Cleanser';
    if (/\bmoisturi[sz]er|cream|lotion|gel\b/.test(n)) return language === 'CN' ? '面霜' : 'Moisturizer';
    if (/\btoner|essence\b/.test(n)) return language === 'CN' ? '化妆水' : 'Toner';
    if (/\bspf|sunscreen|sun screen\b/.test(n)) return language === 'CN' ? '防晒' : 'Sunscreen';
    if (/\bmask\b/.test(n)) return language === 'CN' ? '面膜' : 'Mask';
    return language === 'CN' ? '护肤' : 'Skincare';
  };

  const skuId =
    asString(raw.sku_id ?? raw.skuId ?? raw.product_id ?? raw.productId) ||
    `unknown_${Math.random().toString(16).slice(2)}`.slice(0, 24);
  const brand = asString(raw.brand) || '';
  const name = asString(raw.name) || asString(raw.title) || asString(raw.display_name ?? raw.displayName) || '';
  const categoryRaw = asString(raw.category) || asString((raw as any).category_name ?? (raw as any).categoryName) || '';
  const category = (!categoryRaw || isUnknownToken(categoryRaw)) ? inferCategoryFromName(name) : categoryRaw;
  const description = asString(raw.description) || '';
  const image_url = pickProductImageUrl(raw);
  const size = asString(raw.size) || '';

  const product: Product = {
    sku_id: skuId,
    brand: brand || (language === 'CN' ? '未知品牌' : 'Unknown brand'),
    name: name || (language === 'CN' ? '未知产品' : 'Unknown product'),
    category: category || (language === 'CN' ? '未知品类' : 'Unknown'),
    description,
    image_url,
    size,
    product_id: asString(raw.product_id ?? raw.productId) || null,
    merchant_id: asString((raw as any).merchant_id ?? (raw as any).merchantId) || null,
    in_stock:
      typeof (raw as any).in_stock === 'boolean'
        ? Boolean((raw as any).in_stock)
        : (raw as any).in_stock === null
          ? null
          : typeof (raw as any).available === 'boolean'
            ? Boolean((raw as any).available)
            : null,
    inventory_quantity: asNumber((raw as any).inventory_quantity ?? (raw as any).inventoryQuantity) ?? null,
    availability_state: asString((raw as any).availability_state ?? (raw as any).availabilityState) || null,
    canonical_url: asString((raw as any).canonical_url ?? (raw as any).canonicalUrl) || null,
    destination_url: asString((raw as any).destination_url ?? (raw as any).destinationUrl) || null,
    external_url: asString((raw as any).external_url ?? (raw as any).externalUrl) || null,
    external_redirect_url: asString((raw as any).external_redirect_url ?? (raw as any).externalRedirectUrl) || null,
  };

  const mechanism = asNumberRecord(raw.mechanism) || asNumberRecord((raw as any).mechanism_vector);
  if (mechanism) product.mechanism = mechanism;

  const socialStats = asObject((raw as any).social_stats) || asObject((raw as any).socialStats);
  if (socialStats) product.social_stats = socialStats as any;

  const evidencePack = asObject((raw as any).evidence_pack) || asObject((raw as any).evidencePack);
  if (evidencePack) product.evidence_pack = evidencePack as any;

  const ingredients = asObject((raw as any).ingredients);
  if (ingredients) product.ingredients = ingredients as any;

  const keyActives = uniqueStrings((raw as any).key_actives);
  if (keyActives.length) product.key_actives = keyActives;

  return product;
}

function extractProductsFromSearchResponse(input: unknown): Array<Record<string, unknown>> {
  const root = asObject(input) || {};
  const rows = (
    [
      (root as any).products,
      (root as any).items,
      (root as any).results,
      (root as any).data?.products,
      (root as any).data?.items,
      (root as any).data?.results,
      (root as any).result?.products,
      (root as any).result?.items,
      (root as any).result?.results,
    ].find((value) => Array.isArray(value)) || []
  ) as unknown[];

  return rows.map((row) => asObject(row)).filter(Boolean) as Array<Record<string, unknown>>;
}

function extractProductSearchReply(input: unknown): string | null {
  const root = asObject(input) || {};
  const candidates = [
    (root as any).reply,
    (root as any).message,
    (root as any).data?.reply,
    (root as any).data?.message,
    (root as any).result?.reply,
    (root as any).result?.message,
  ];
  for (const value of candidates) {
    const text = asString(value);
    if (text && text.trim()) return text.trim();
  }
  return null;
}

type ProductSearchClarification = {
  question: string;
  options: string[];
  slot: string | null;
  reasonCode: string | null;
  dedupKey: string | null;
};

type ProductSearchSlotState = {
  asked_slots: string[];
  resolved_slots: Record<string, string>;
};

function normalizeProductSearchSlotState(input: unknown): ProductSearchSlotState {
  const root = asObject(input) || {};
  return {
    asked_slots: Array.from(
      new Set(
        asArray((root as any).asked_slots)
          .map((value) => asString(value)?.trim().toLowerCase())
          .filter((value): value is string => Boolean(value)),
      ),
    ),
    resolved_slots: Object.fromEntries(
      Object.entries(asObject((root as any).resolved_slots) || {})
        .map(([key, value]) => [String(key || '').trim().toLowerCase(), asString(value)?.trim() || ''])
        .filter(([key, value]) => Boolean(key && value)),
    ),
  };
}

function mergeProductSearchSlotState(
  base: ProductSearchSlotState | null | undefined,
  patch: ProductSearchSlotState | null | undefined,
): ProductSearchSlotState {
  const normalizedBase = normalizeProductSearchSlotState(base);
  const normalizedPatch = normalizeProductSearchSlotState(patch);
  return {
    asked_slots: Array.from(new Set([...normalizedBase.asked_slots, ...normalizedPatch.asked_slots])),
    resolved_slots: {
      ...normalizedBase.resolved_slots,
      ...normalizedPatch.resolved_slots,
    },
  };
}

function extractProductSearchClarification(input: unknown): ProductSearchClarification | null {
  const root = asObject(input) || {};
  const clarification =
    asObject((root as any).clarification) ||
    asObject((root as any).data?.clarification) ||
    asObject((root as any).result?.clarification);
  if (!clarification) return null;
  const question = asString((clarification as any).question) || asString((clarification as any).prompt);
  const options = asArray((clarification as any).options)
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value && value.trim()))
    .slice(0, 4);
  if (!question?.trim() && options.length === 0) return null;
  return {
    question: question?.trim() || '',
    options,
    slot: asString((clarification as any).slot) || null,
    reasonCode: asString((clarification as any).reason_code ?? (clarification as any).reasonCode) || null,
    dedupKey: asString((clarification as any).dedup_key ?? (clarification as any).dedupKey) || null,
  };
}

function extractProductSearchSlotState(input: unknown): ProductSearchSlotState | null {
  const root = asObject(input) || {};
  const metadata =
    asObject((root as any).metadata) ||
    asObject((root as any).data?.metadata) ||
    asObject((root as any).result?.metadata);
  const slotState =
    asObject((metadata as any)?.slot_state) ||
    asObject((metadata as any)?.search_decision?.slot_state) ||
    asObject((metadata as any)?.search_trace?.slot_state);
  if (!slotState) return null;
  return normalizeProductSearchSlotState(slotState);
}

function resolveTravelLookupAvailabilityState(product: Product): 'in_stock' | 'unknown' | 'out_of_stock' {
  const explicitState = String(product.availability_state || '').trim().toLowerCase();
  if (explicitState === 'in_stock' || explicitState === 'out_of_stock' || explicitState === 'unknown') {
    return explicitState;
  }
  if (typeof product.in_stock === 'boolean') {
    return product.in_stock ? 'in_stock' : 'out_of_stock';
  }
  if (typeof product.inventory_quantity === 'number' && Number.isFinite(product.inventory_quantity)) {
    return product.inventory_quantity > 0 ? 'in_stock' : 'out_of_stock';
  }
  return 'unknown';
}

type TravelLookupResultItem = {
  product: Product;
  raw: Record<string, unknown>;
};

function sortTravelLookupProducts(products: TravelLookupResultItem[]): TravelLookupResultItem[] {
  const rank: Record<'in_stock' | 'unknown' | 'out_of_stock', number> = {
    in_stock: 0,
    unknown: 1,
    out_of_stock: 2,
  };
  return products
    .map((entry, index) => ({
      entry,
      index,
      state: resolveTravelLookupAvailabilityState(entry.product),
    }))
    .sort((left, right) => {
      const rankDiff = rank[left.state] - rank[right.state];
      if (rankDiff !== 0) return rankDiff;
      return left.index - right.index;
    })
    .map((item) => item.entry);
}

function cleanTravelLookupText(value: unknown): string | null {
  const text = asString(value)?.trim() || '';
  if (!text) return null;
  if (/^(unknown(?:\s+brand|\s+product)?|未知(?:品牌|产品)?|n\/a|null|undefined)$/i.test(text)) return null;
  return text;
}

function readTravelLookupRefTarget(raw: unknown): { product_id: string; merchant_id?: string | null } | null {
  const ref = asObject(raw);
  if (!ref) return null;
  const productId = asString((ref as any).product_id ?? (ref as any).productId)?.trim() || '';
  const merchantId = asString((ref as any).merchant_id ?? (ref as any).merchantId)?.trim() || null;
  if (!productId) return null;
  return merchantId ? { product_id: productId, merchant_id: merchantId } : { product_id: productId };
}

function isInternalTravelLookupPdpUrl(rawUrl: string | null): boolean {
  const url = String(rawUrl || '').trim();
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const isPdpPath = segments.length === 2 && segments[0] === 'products' && Boolean(segments[1]);
    const isBrowseRoute = String(parsed.searchParams.get('open') || '').trim().toLowerCase() === 'browse';
    return isPdpPath && !isBrowseRoute;
  } catch {
    return false;
  }
}

function buildTravelLookupOpenTarget(row: Record<string, unknown>, product: Product) {
  const source = asObject((row as any).product) || row;
  const pdpOpen =
    asObject((source as any).pdp_open) ||
    asObject((source as any).pdpOpen) ||
    asObject((row as any).pdp_open) ||
    asObject((row as any).pdpOpen) ||
    null;
  const pdpOpenExternal = asObject((pdpOpen as any)?.external) || null;
  const subject = asObject((pdpOpen as any)?.subject) || null;

  const directUrlCandidates = [
    asString((source as any).pdp_url),
    asString((source as any).url),
    asString((source as any).product_url),
    asString((source as any).productUrl),
    asString((source as any).purchase_path),
    asString((source as any).purchasePath),
    asString((pdpOpenExternal as any)?.url),
  ]
    .map((value) => normalizeOutboundFallbackUrl(String(value || '').trim()))
    .filter((value): value is string => Boolean(value));

  const directInternalUrl = directUrlCandidates.find((value) => isInternalTravelLookupPdpUrl(value)) || null;
  const directExternalUrl = directUrlCandidates.find((value) => !isInternalTravelLookupPdpUrl(value)) || null;

  const directRef =
    readTravelLookupRefTarget((pdpOpen as any)?.product_ref) ||
    readTravelLookupRefTarget((source as any).product_ref) ||
    readTravelLookupRefTarget((source as any).canonical_product_ref) ||
    null;
  const rawProductId = asString((source as any).product_id ?? (source as any).productId)?.trim() || null;
  const rawMerchantId = asString((source as any).merchant_id ?? (source as any).merchantId)?.trim() || null;
  const fallbackRef = rawProductId ? { product_id: rawProductId, ...(rawMerchantId ? { merchant_id: rawMerchantId } : {}) } : null;
  const canonicalProductRef =
    readTravelLookupRefTarget((source as any).canonical_product_ref) ||
    readTravelLookupRefTarget((pdpOpen as any)?.canonical_product_ref) ||
    directRef ||
    fallbackRef ||
    null;

  const subjectProductGroupId =
    asString((subject as any)?.id) ||
    asString((subject as any)?.product_group_id) ||
    asString((subject as any)?.productGroupId) ||
    asString((source as any).subject_product_group_id) ||
    asString((source as any).subjectProductGroupId) ||
    asString((source as any).product_group_id) ||
    asString((source as any).productGroupId) ||
    null;

  const groupTarget = extractPdpTargetFromProductGroupId(subjectProductGroupId || null);
  const derivedInternalUrl =
    directInternalUrl ||
    (canonicalProductRef?.product_id ? buildPdpUrl(canonicalProductRef) : '') ||
    (groupTarget?.product_id ? buildPdpUrl(groupTarget) : '') ||
    null;

  const brand = cleanTravelLookupText((source as any).brand) || cleanTravelLookupText(product.brand);
  const name =
    cleanTravelLookupText((source as any).name) ||
    cleanTravelLookupText((source as any).title) ||
    cleanTravelLookupText((source as any).display_name ?? (source as any).displayName) ||
    cleanTravelLookupText(product.name);
  const skuId = asString((source as any).sku_id ?? (source as any).skuId)?.trim() || null;

  const itemResolveReasonCode =
    asString((source as any)?.metadata?.resolve_reason_code) ||
    asString((source as any)?.metadata?.resolveReasonCode) ||
    asString((source as any)?.metadata?.pdp_open_fail_reason) ||
    asString((source as any)?.metadata?.resolve_fail_reason) ||
    null;

  const externalQuery =
    asString((pdpOpenExternal as any)?.query) ||
    [brand, name].filter(Boolean).join(' ').trim() ||
    null;
  const explicitExternalPath =
    String((pdpOpen as any)?.path || (source as any)?.metadata?.pdp_open_path || '')
      .trim()
      .toLowerCase() === 'external';
  const anchorKey =
    subjectProductGroupId ||
    canonicalProductRef?.product_id ||
    rawProductId ||
    skuId ||
    (externalQuery ? `q:${externalQuery}` : null) ||
    (directExternalUrl ? `ext:${directExternalUrl.slice(0, 180)}` : null);

  return {
    brand,
    name,
    internalUrl: derivedInternalUrl,
    externalUrl: directExternalUrl,
    externalQuery,
    preferExternalSearch: explicitExternalPath && !derivedInternalUrl,
    anchorKey,
    subjectProductGroupId,
    canonicalProductRef,
    resolveQuery: externalQuery,
    hints: {
      ...(canonicalProductRef ? { product_ref: canonicalProductRef } : {}),
      ...(rawProductId ? { product_id: rawProductId } : {}),
      ...(skuId ? { sku_id: skuId } : {}),
      ...(brand ? { brand } : {}),
      ...(name ? { title: name } : {}),
      ...(externalQuery ? { aliases: [externalQuery, name, brand].filter(Boolean) } : {}),
    },
    pdpOpenHint:
      pdpOpen || explicitExternalPath || directExternalUrl || externalQuery
        ? {
            path: asString((pdpOpen as any)?.path) || (explicitExternalPath || directExternalUrl ? 'external' : null),
            resolve_reason_code: asString((pdpOpen as any)?.resolve_reason_code) || itemResolveReasonCode || null,
            external:
              directExternalUrl || externalQuery
                ? {
                    query: externalQuery,
                    url: directExternalUrl,
                  }
                : pdpOpenExternal
                  ? {
                      query: asString((pdpOpenExternal as any)?.query) || null,
                      url: normalizeOutboundFallbackUrl(asString((pdpOpenExternal as any)?.url) || '') || null,
                    }
                  : null,
          }
        : null,
  };
}

function toAnchorOffers(raw: Record<string, unknown>, language: UiLanguage): Offer[] {
  const explicitOffers = asArray((raw as any).offers)
    .map((v) => asObject(v))
    .filter(Boolean)
    .map((v) => toUiOffer(v as Record<string, unknown>))
    .filter((o) => Number.isFinite(o.price));
  if (explicitOffers.length) return explicitOffers;

  const priceObj = asObject((raw as any).price);
  if (priceObj && (priceObj as any).unknown === true) return [];

  let price: number | null = null;
  let currency = asString((raw as any).currency) || 'USD';
  if (priceObj) {
    const usd = asNumber((priceObj as any).usd ?? (priceObj as any).USD);
    const cny = asNumber((priceObj as any).cny ?? (priceObj as any).CNY);
    if (usd != null) {
      price = usd;
      currency = 'USD';
    } else if (cny != null) {
      price = cny;
      currency = 'CNY';
    } else {
      price = asNumber((priceObj as any).amount ?? (priceObj as any).value ?? (priceObj as any).price) ?? null;
      currency = asString((priceObj as any).currency) || currency;
    }
  }
  if (price == null) price = asNumber((raw as any).price) ?? null;
  if (price == null || !Number.isFinite(price)) return [];

  const originalPrice = asNumber((raw as any).original_price ?? (raw as any).originalPrice);
  const seller = asString((raw as any).seller) || asString((raw as any).brand) || (language === 'CN' ? '官方渠道' : 'Official');
  return [
    {
      offer_id: `offer_anchor_${asString((raw as any).sku_id ?? (raw as any).product_id ?? (raw as any).name) || Math.random().toString(16).slice(2)}`.slice(0, 40),
      seller,
      price,
      currency: currency || 'USD',
      ...(originalPrice != null && originalPrice > price ? { original_price: originalPrice } : {}),
      shipping_days: 0,
      returns_policy: '',
      reliability_score: 0,
      badges: [],
      in_stock: true,
      purchase_route: 'internal_checkout',
    },
  ];
}

function toUiOffer(raw: Record<string, unknown>): Offer {
  const offer_id = asString(raw.offer_id ?? (raw as any).offerId) || `offer_${Math.random().toString(16).slice(2)}`.slice(0, 24);
  const seller = asString(raw.seller) || '';
  const currency = asString(raw.currency) || 'USD';

  const price = asNumber(raw.price);
  const originalPrice = asNumber(raw.original_price ?? (raw as any).originalPrice);
  const shippingDays = asNumber(raw.shipping_days ?? (raw as any).shippingDays);
  const reliability = asNumber(raw.reliability_score ?? (raw as any).reliabilityScore);

  const badges = uniqueStrings(raw.badges)
    .filter((b) => ['best_price', 'best_returns', 'fastest_shipping', 'high_reliability'].includes(b))
    .slice(0, 6) as any;

  const purchaseRouteRaw = asString(raw.purchase_route ?? (raw as any).purchaseRoute);
  const affiliate_url = asString(raw.affiliate_url ?? (raw as any).affiliateUrl) || undefined;
  const purchase_route = (purchaseRouteRaw === 'internal_checkout' || purchaseRouteRaw === 'affiliate_outbound'
    ? purchaseRouteRaw
    : affiliate_url
      ? 'affiliate_outbound'
      : 'internal_checkout') as Offer['purchase_route'];

  return {
    offer_id,
    seller,
    price: price == null ? Number.NaN : price,
    currency,
    ...(originalPrice != null ? { original_price: originalPrice } : {}),
    shipping_days: shippingDays == null ? 0 : shippingDays,
    returns_policy: asString(raw.returns_policy ?? (raw as any).returnsPolicy) || '',
    reliability_score: reliability == null ? 0 : reliability,
    badges,
    in_stock: raw.in_stock === false ? false : true,
    purchase_route,
    ...(affiliate_url ? { affiliate_url } : {}),
  };
}

function toDupeProduct(raw: Record<string, unknown> | null, language: UiLanguage) {
  const r = raw ?? {};
  const brand = asString(r.brand) || (language === 'CN' ? '未知品牌' : 'Unknown brand');
  const name = asString(r.name) || asString(r.display_name ?? r.displayName) || (language === 'CN' ? '未知产品' : 'Unknown product');
  const imageUrl = pickProductImageUrl(r) || undefined;

  let price: number | undefined;
  let currency: string | undefined;
  const offers = asArray((r as any).offers).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
  if (offers.length) {
    price = asNumber(offers[0].price) ?? undefined;
    currency = asString(offers[0].currency) ?? undefined;
  }

  const priceObj = asObject((r as any).price);
  if (price == null && priceObj) {
    const amount = asNumber((priceObj as any).amount ?? (priceObj as any).value ?? (priceObj as any).price);
    const usd = asNumber(priceObj.usd ?? priceObj.USD);
    const cny = asNumber(priceObj.cny ?? priceObj.CNY);
    if (amount != null) {
      price = amount;
      currency = asString((priceObj as any).currency) || currency;
    } else if (usd != null) {
      price = usd;
      currency = 'USD';
    } else if (cny != null) {
      price = cny;
      currency = 'CNY';
    }
  }

  if (price == null) price = asNumber((r as any).price) ?? undefined;
  if (!currency) currency = asString((r as any).currency) ?? undefined;

  return {
    imageUrl,
    brand,
    name,
    ...(typeof price === 'number' && Number.isFinite(price) ? { price } : {}),
    ...(currency ? { currency } : {}),
    ...(asNumberRecord((r as any).mechanism) ? { mechanism: asNumberRecord((r as any).mechanism) } : {}),
    ...((asObject((r as any).experience) ? { experience: (r as any).experience } : {}) as any),
    ...(uniqueStrings((r as any).risk_flags).length ? { risk_flags: uniqueStrings((r as any).risk_flags) } : {}),
    ...((asObject((r as any).social_stats) ? { social_stats: (r as any).social_stats } : {}) as any),
    ...(uniqueStrings((r as any).key_actives).length ? { key_actives: uniqueStrings((r as any).key_actives) } : {}),
    ...((asObject((r as any).evidence_pack) ? { evidence_pack: (r as any).evidence_pack } : {}) as any),
    ...((asObject((r as any).ingredients) ? { ingredients: (r as any).ingredients } : {}) as any),
  };
}

type BootstrapInfo = {
  profile: Record<string, unknown> | null;
  recent_logs: Array<Record<string, unknown>>;
  checkin_due: boolean | null;
  is_returning: boolean | null;
  db_ready: boolean | null;
};

type AnalysisPhotoRef = { slot_id: string; photo_id: string; qc_status: string };

type BootstrapInfoPatch = {
  profile?: Record<string, unknown> | null;
  recent_logs?: Array<Record<string, unknown>>;
  checkin_due?: boolean | null;
  is_returning?: boolean | null;
  db_ready?: boolean | null;
};

const mapQuickProfileToAuroraProfilePatch = (patch: QuickProfileProfilePatch): Record<string, unknown> | null => {
  if (!patch) return null;
  const out: Record<string, unknown> = {};

  const skinFeel = patch.skin_feel;
  if (skinFeel) {
    out.skinType = skinFeel === 'unsure' ? 'unknown' : skinFeel;
  }

  const goalPrimary = patch.goal_primary;
  if (goalPrimary) {
    if (goalPrimary === 'breakouts') out.goals = ['acne'];
    else if (goalPrimary === 'brightening') out.goals = ['brightening'];
    else if (goalPrimary === 'antiaging') out.goals = ['wrinkles'];
    else if (goalPrimary === 'barrier') out.goals = ['barrier'];
    else if (goalPrimary === 'spf') out.goals = ['uv_protection'];
    else out.goals = ['other'];
  }

  const sensitivityFlag = patch.sensitivity_flag;
  if (sensitivityFlag) {
    if (sensitivityFlag === 'yes') out.sensitivity = 'high';
    else if (sensitivityFlag === 'no') out.sensitivity = 'low';
    else out.sensitivity = 'unknown';
  }

  return Object.keys(out).length ? out : null;
};

const profileRecoCompleteness = (profile: Record<string, unknown> | null | undefined) => {
  const p = profile ?? {};
  const goals = (p as any).goals;
  const dims = {
    skinType: Boolean(asString((p as any).skinType)),
    barrierStatus: Boolean(asString((p as any).barrierStatus)),
    sensitivity: Boolean(asString((p as any).sensitivity)),
    goals: Array.isArray(goals) ? goals.length > 0 : Boolean(asString(goals)),
  };
  const score = Object.values(dims).filter(Boolean).length;
  const missing = Object.entries(dims)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);
  return { score, missing };
};

const RECO_GOAL_CLARIFY_OPTIONS = Object.freeze([
  { key: 'breakouts', labelEN: 'Breakouts', labelCN: '控痘/闭口', goal: 'acne', replyEN: 'Recommend products for breakouts / clogged pores.', replyCN: '给我控痘/闭口方向的产品推荐。' },
  { key: 'brightening', labelEN: 'Brightening', labelCN: '提亮/淡斑', goal: 'dark_spots', replyEN: 'Recommend products for brightening / dark spots.', replyCN: '给我提亮/淡斑方向的产品推荐。' },
  { key: 'antiaging', labelEN: 'Anti-aging', labelCN: '抗老', goal: 'wrinkles', replyEN: 'Recommend products for anti-aging / fine lines.', replyCN: '给我抗老方向的产品推荐。' },
  { key: 'barrier', labelEN: 'Barrier repair', labelCN: '修护屏障', goal: 'barrier_repair', replyEN: 'Recommend products for barrier repair.', replyCN: '给我修护屏障方向的产品推荐。' },
  { key: 'spf', labelEN: 'SPF / sun', labelCN: '防晒', goal: 'sunscreen', replyEN: 'Recommend sunscreen / daily SPF products.', replyCN: '给我日常防晒方向的产品推荐。' },
]);

const normalizeRecoGoalToken = (raw: unknown): string => {
  const token = String(raw || '').trim().toLowerCase();
  if (!token) return '';
  if (token === 'breakout' || token === 'breakouts' || token === 'blemish' || token === 'blemishes') return 'acne';
  if (token === 'brightening' || token === 'tone') return 'dark_spots';
  if (token === 'antiaging' || token === 'anti-aging' || token === 'anti_aging' || token === 'fine_lines') return 'wrinkles';
  if (token === 'barrier' || token === 'barrier repair' || token === 'barrier_repair') return 'barrier_repair';
  if (token === 'spf' || token === 'sun' || token === 'sunscreen' || token === 'uv_protection') return 'sunscreen';
  return token;
};

const extractResolvedRecoGoals = (value: unknown): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of normalizeProfileGoals(value)) {
    const normalized = normalizeRecoGoalToken(raw);
    if (!normalized || normalized === 'unknown' || normalized === 'other') continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
};

const getPrimaryResolvedRecoGoal = (profile: Record<string, unknown> | null | undefined): string => {
  return extractResolvedRecoGoals((profile as any)?.goals)[0] || '';
};

const humanizeRecoGoal = (goal: string, language: UiLanguage): string => {
  const normalized = normalizeRecoGoalToken(goal);
  const hit = RECO_GOAL_CLARIFY_OPTIONS.find((item) => item.goal === normalized);
  if (hit) return language === 'CN' ? hit.labelCN : hit.labelEN;
  if (normalized === 'pores') return language === 'CN' ? '毛孔' : 'Pores';
  return normalized.replace(/[_-]+/g, ' ').trim() || (language === 'CN' ? '产品推荐' : 'product recommendations');
};

const buildGoalSpecificRecoReplyText = (language: UiLanguage, goal: string): string => {
  const normalized = normalizeRecoGoalToken(goal);
  const hit = RECO_GOAL_CLARIFY_OPTIONS.find((item) => item.goal === normalized);
  if (hit) return language === 'CN' ? hit.replyCN : hit.replyEN;
  const label = humanizeRecoGoal(normalized, language);
  return language === 'CN' ? `给我${label}方向的产品推荐。` : `Recommend products for ${label}.`;
};

const buildGoalfulRecoActionData = ({
  language,
  baseData,
  goal,
  triggerSource,
}: {
  language: UiLanguage;
  baseData: Record<string, unknown>;
  goal: string;
  triggerSource: string;
}): Record<string, unknown> => {
  const existingProfilePatch = asObject((baseData as any).profile_patch) || asObject((baseData as any).profilePatch) || {};
  return {
    ...baseData,
    reply_text: buildGoalSpecificRecoReplyText(language, goal),
    profile_patch: {
      ...existingProfilePatch,
      goals: [normalizeRecoGoalToken(goal)],
    },
    trigger_source: asString((baseData as any).trigger_source) || triggerSource,
    include_alternatives: (baseData as any).include_alternatives === undefined ? true : (baseData as any).include_alternatives,
  };
};

const hasResolvedRecoGoalInChipData = (data: Record<string, unknown>): boolean => {
  const profilePatch = asObject((data as any).profile_patch) || asObject((data as any).profilePatch);
  if (extractResolvedRecoGoals(profilePatch?.goals).length > 0) return true;
  if (extractResolvedRecoGoals((data as any).goals).length > 0) return true;
  if (extractResolvedRecoGoals((data as any).goal).length > 0) return true;
  if (asString((data as any).ingredient_goal) || asString((data as any).ingredientGoal)) return true;
  if (asString((data as any).ingredient_query) || asString((data as any).ingredientQuery) || asString((data as any).ingredient_name)) return true;
  if (Array.isArray((data as any).ingredient_candidates) && (data as any).ingredient_candidates.length > 0) return true;
  if (Array.isArray((data as any).ingredientCandidates) && (data as any).ingredientCandidates.length > 0) return true;
  if (Array.isArray((data as any).product_candidates) && (data as any).product_candidates.length > 0) return true;
  if (Array.isArray((data as any).productCandidates) && (data as any).productCandidates.length > 0) return true;
  if (asString((data as any).category) || asString((data as any).product_type) || asString((data as any).productType)) return true;
  if (String((data as any).trigger_source || '').trim().toLowerCase() === 'travel_handoff') return true;
  return false;
};

const buildRecoGoalClarificationText = (language: UiLanguage): string => {
  return language === 'CN'
    ? '你这次想优先解决什么，或者想先看哪类产品？我先按这个方向给你收紧推荐。'
    : 'What do you want to prioritize first, or which product type do you want first? I will narrow recommendations from there.';
};

const buildRecoGoalOtherPrompt = (language: UiLanguage): string => {
  return language === 'CN'
    ? '告诉我你这次最想解决的目标或想看的品类，比如提亮精华、防晒，或修护面霜。'
    : 'Tell me your top goal or product type, for example brightening serum, sunscreen, or barrier moisturizer.';
};

const buildRecoGoalClarificationChips = (language: UiLanguage): SuggestedChip[] => {
  const isCN = language === 'CN';
  const goalChips = RECO_GOAL_CLARIFY_OPTIONS.map((item) => ({
    chip_id: `chip.reco_goal.${item.key}`,
    label: isCN ? item.labelCN : item.labelEN,
    kind: 'quick_reply' as const,
    data: {
      action_id: 'chip.start.reco_products',
      reply_text: isCN ? item.replyCN : item.replyEN,
      profile_patch: { goals: [item.goal] },
      trigger_source: 'reco_goal_clarify',
      include_alternatives: true,
    },
  }));

  goalChips.push({
    chip_id: 'chip.reco_goal.other',
    label: isCN ? '其他' : 'Other',
    kind: 'quick_reply',
    data: {
      action_id: 'chip.start.reco_products',
      reply_text: buildRecoGoalOtherPrompt(language),
      trigger_source: 'reco_goal_clarify',
      reco_goal: 'other',
      v2_freeform_fallback: true,
    },
  });

  return goalChips;
};

const getIngredientFitProfileStatus = (profile: Record<string, unknown> | null | undefined) => {
  const p = profile ?? {};
  const goals = (p as any).goals;
  const hasGoals = Array.isArray(goals) ? goals.length > 0 : Boolean(asString(goals));
  const hasSensitivity = Boolean(asString((p as any).sensitivity));
  return {
    hasGoals,
    hasSensitivity,
    isComplete: hasGoals && hasSensitivity,
  };
};

function normalizeSelectionKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[’‘`´]/g, "'")
    .replace(/[_-]/g, ' ');
}

function mapIngredientGoalChipToProfileGoal(chip: string): string | null {
  const key = normalizeSelectionKey(chip);
  if (!key) return null;
  if (key.includes('fine line') || key.includes('firmness') || key.includes('细纹') || key.includes('紧致')) return 'wrinkles';
  if (key.includes('sensitive') || key.includes('repair') || key.includes('敏感') || key.includes('修护')) return 'barrier';
  if (key.includes('acne') || key.includes('痘')) return 'acne';
  if (key.includes('bright') || key.includes('提亮')) return 'brightening';
  return null;
}

function mapIngredientSensitivityChipToProfileSensitivity(chip: string): string | null {
  const key = normalizeSelectionKey(chip);
  if (!key) return null;
  if (key.includes('sensitive') || key.includes('敏感')) return 'high';
  if (key.includes('normal') || key.includes('一般')) return 'medium';
  if (key.includes('resilient') || key.includes('耐受')) return 'low';
  return null;
}

function normalizeProfileGoals(value: unknown): string[] {
  const asList = Array.isArray(value) ? value : value == null ? [] : [value];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of asList) {
    const text = asString(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

const readBootstrapInfoFromSessionBootstrapCard = (env: V1Envelope): BootstrapInfoPatch | null => {
  const cards = Array.isArray(env.cards) ? env.cards : [];
  const bootstrapCard = cards.find((c) => String((c as any)?.type || '').trim() === 'session_bootstrap');
  const payload = bootstrapCard?.payload;
  const p = asObject(payload);
  if (!p) return null;

  const patch: BootstrapInfoPatch = {};
  if (Object.prototype.hasOwnProperty.call(p, 'profile')) {
    const rawProfile = (p as any).profile;
    const profileObj = asObject(rawProfile);
    const normalized = normalizeProfileFromBootstrap(profileObj);
    patch.profile = profileObj ? { ...profileObj, ...(normalized || {}), ...(normalized?.region ? { region: normalized.region } : {}) } : null;
  }
  if (Object.prototype.hasOwnProperty.call(p, 'recent_logs')) {
    patch.recent_logs = asArray((p as any).recent_logs).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
  }
  if (Object.prototype.hasOwnProperty.call(p, 'checkin_due')) {
    patch.checkin_due = typeof (p as any).checkin_due === 'boolean' ? (p as any).checkin_due : null;
  }
  if (Object.prototype.hasOwnProperty.call(p, 'is_returning')) {
    patch.is_returning = typeof (p as any).is_returning === 'boolean' ? (p as any).is_returning : null;
  }
  if (Object.prototype.hasOwnProperty.call(p, 'db_ready')) {
    patch.db_ready = typeof (p as any).db_ready === 'boolean' ? (p as any).db_ready : null;
  }

  return patch;
};

const readBootstrapInfoFromSessionPatch = (env: V1Envelope): BootstrapInfoPatch | null => {
  const patch = env.session_patch && typeof env.session_patch === 'object' ? (env.session_patch as Record<string, unknown>) : null;
  if (!patch) return null;

  const out: BootstrapInfoPatch = {};
  if (Object.prototype.hasOwnProperty.call(patch, 'profile')) {
    const profileObj = asObject(patch.profile);
    const normalized = normalizeProfileFromBootstrap(profileObj);
    out.profile = profileObj ? { ...profileObj, ...(normalized || {}), ...(normalized?.region ? { region: normalized.region } : {}) } : null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'recent_logs'))
    out.recent_logs = asArray(patch.recent_logs).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
  if (Object.prototype.hasOwnProperty.call(patch, 'checkin_due')) out.checkin_due = typeof patch.checkin_due === 'boolean' ? patch.checkin_due : null;
  if (Object.prototype.hasOwnProperty.call(patch, 'is_returning')) out.is_returning = typeof patch.is_returning === 'boolean' ? patch.is_returning : null;
  if (Object.prototype.hasOwnProperty.call(patch, 'db_ready')) out.db_ready = typeof patch.db_ready === 'boolean' ? patch.db_ready : null;

  return out;
};

const readBootstrapInfo = (env: V1Envelope): BootstrapInfo | null => {
  const cardPatch = readBootstrapInfoFromSessionBootstrapCard(env);
  const sessionPatch = readBootstrapInfoFromSessionPatch(env);

  if (!cardPatch && !sessionPatch) return null;

  const merged: BootstrapInfo = { profile: null, recent_logs: [], checkin_due: null, is_returning: null, db_ready: null };
  const patches = [cardPatch, sessionPatch].filter(Boolean) as BootstrapInfoPatch[];
  for (const patch of patches) {
    if ('profile' in patch) merged.profile = patch.profile ?? null;
    if ('recent_logs' in patch) merged.recent_logs = patch.recent_logs ?? [];
    if ('checkin_due' in patch) merged.checkin_due = typeof patch.checkin_due === 'boolean' ? patch.checkin_due : null;
    if ('is_returning' in patch) merged.is_returning = typeof patch.is_returning === 'boolean' ? patch.is_returning : null;
    if ('db_ready' in patch) merged.db_ready = typeof patch.db_ready === 'boolean' ? patch.db_ready : null;
  }

  return merged;
};

const mergeAnalysisPhotoRefs = (left: AnalysisPhotoRef[], right: AnalysisPhotoRef[]): AnalysisPhotoRef[] => {
  const merged = [...left, ...right].filter((p) => p.slot_id && p.photo_id);
  const dedup = new Map<string, AnalysisPhotoRef>();
  for (const entry of merged) dedup.set(entry.slot_id, entry);
  return Array.from(dedup.values()).slice(0, 4);
};

function Sheet({
  open,
  title,
  onClose,
  onOpenMenu,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onOpenMenu?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <button
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[var(--aurora-shell-max)] overflow-hidden rounded-t-3xl border border-border/50 bg-card/90 shadow-elevated backdrop-blur-xl">
        <div className="flex max-h-[85vh] max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between px-[var(--aurora-page-x)] pb-3 pt-4">
            <div className="flex items-center gap-2">
              {onOpenMenu ? (
                <button
                  type="button"
                  className="aurora-home-role-icon inline-flex h-9 w-9 items-center justify-center rounded-full border"
                  onClick={() => {
                    onOpenMenu();
                  }}
                  aria-label={t('common.open_menu')}
                >
                  <Menu className="h-4 w-4" />
                </button>
              ) : null}
              <div className="text-sm font-semibold text-foreground">{title}</div>
            </div>
            <button
              className="aurora-home-role-icon inline-flex h-9 w-9 items-center justify-center rounded-full border"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-[var(--aurora-page-x)] pb-[calc(env(safe-area-inset-bottom)+16px)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function formatProfileLine(profile: Record<string, unknown> | null, language: 'EN' | 'CN') {
  if (!profile) return language === 'CN' ? '未填写肤况资料' : 'No profile yet';
  const skinType = asString(profile.skinType) || '—';
  const sensitivity = asString(profile.sensitivity) || '—';
  const barrier = asString(profile.barrierStatus) || '—';
  const goals = asArray(profile.goals).map((g) => asString(g)).filter(Boolean) as string[];
  const goalsText = goals.length ? goals.slice(0, 3).join(', ') : '—';
  return language === 'CN'
    ? `肤质：${skinType} · 敏感：${sensitivity} · 屏障：${barrier} · 目标：${goalsText}`
    : `Skin: ${skinType} · Sensitivity: ${sensitivity} · Barrier: ${barrier} · Goals: ${goalsText}`;
}

function labelMissing(code: string, language: 'EN' | 'CN') {
  const c = String(code || '').trim();
  if (!c) return '';
  const map: Record<string, { CN: string; EN: string }> = {
    budget_unknown: { CN: '预算信息缺失', EN: 'Budget missing' },
    routine_missing: { CN: '方案缺失', EN: 'Routine missing' },
    over_budget: { CN: '可能超出预算', EN: 'May be over budget' },
    price_unknown: { CN: '价格暂不可得', EN: 'Price unavailable' },
    price_temporarily_unavailable: { CN: '价格暂不可得', EN: 'Price unavailable' },
    availability_unknown: { CN: '可购买渠道/地区未知', EN: 'Availability unknown' },
    recent_logs_missing: { CN: '缺少最近 7 天肤况记录', EN: 'No recent 7-day skin logs' },
    itinerary_unknown: { CN: '缺少行程/环境信息', EN: 'No itinerary / upcoming plan context' },
    evidence_missing: { CN: '证据不足', EN: 'Evidence missing' },
    upstream_missing_or_unstructured: { CN: '上游返回缺失/不规范', EN: 'Upstream missing/unstructured' },
    upstream_missing_or_empty: { CN: '上游返回为空', EN: 'Upstream empty' },
    catalog_fallback_disabled: { CN: 'catalog 回退未启用', EN: 'Catalog fallback is disabled' },
    catalog_no_match: { CN: 'catalog 未匹配到该产品', EN: 'No catalog match found' },
    catalog_backend_not_configured: { CN: 'catalog 后端未配置', EN: 'Catalog backend is not configured' },
    pivota_backend_not_configured: { CN: 'catalog 后端未配置', EN: 'Catalog backend is not configured' },
    anchor_missing_deepscan_degraded: {
      CN: '无锚点降级分析后仍证据不足',
      EN: 'No-anchor degraded deep-scan still lacked evidence',
    },
    heuristic_url_parse: { CN: '已通过 URL 启发式补全产品信息', EN: 'Product info was recovered from URL heuristics' },
    alternatives_partial: { CN: '部分步骤缺少平替/相似选项', EN: 'Alternatives missing for some steps' },
    social_data_limited: { CN: '跨平台讨论较少', EN: 'Cross-platform discussion is limited' },
    competitors_low_coverage: { CN: '同类对比样本较少', EN: 'Limited comparable products' },
    concentration_unknown: { CN: '成分浓度未披露', EN: 'Concentration is not disclosed' },
    analysis_in_progress: { CN: '分析进行中，结果会继续补全', EN: 'Analysis is in progress and will continue to improve' },
    upstream_analysis_missing: { CN: '分析进行中，结果会继续补全', EN: 'Analysis is in progress and will continue to improve' },
    url_ingredient_analysis_used: { CN: '已从商品页补抓成分信息', EN: 'Ingredient details were retrieved from the product page' },
    url_realtime_product_intel_used: { CN: '已启用实时分析补全结果', EN: 'Real-time analysis was used to fill missing data' },
    url_fetch_forbidden_403: { CN: '官网页面被站点策略拦截（403）', EN: 'Official page fetch was blocked by site policy (403)' },
    url_fetch_recovered_with_fallback: { CN: '页面抓取已通过回退策略恢复', EN: 'Page fetch recovered with fallback strategy' },
    on_page_fetch_blocked: { CN: '页面抓取受限，已走无页面降级链路', EN: 'On-page fetch was blocked; degraded no-page path was used' },
    anchor_soft_blocked_ambiguous: { CN: '锚点候选信息不足，已软拦截', EN: 'Anchor candidate was ambiguous and soft-blocked' },
    anchor_soft_blocked_url_mismatch: { CN: '锚点与输入 URL 不一致，已软拦截', EN: 'Anchor mismatched the input URL and was soft-blocked' },
    anchor_soft_blocked_non_skincare: { CN: '疑似非护肤品类，已软拦截', EN: 'Likely non-skincare category and soft-blocked' },
    anchor_id_not_used_due_to_low_trust: { CN: '锚点可信度不足，未使用 anchor id', EN: 'Anchor id was not used due to low trust' },
    competitors_non_skincare_filtered: { CN: '已过滤非护肤竞品候选', EN: 'Non-skincare competitor candidates were filtered out' },
    related_products_non_skincare_filtered: { CN: '已过滤非护肤 related 候选', EN: 'Non-skincare related-product candidates were filtered out' },
    dupes_non_skincare_filtered: { CN: '已过滤非护肤平替候选', EN: 'Non-skincare dupe candidates were filtered out' },
    followup_anchor_missing: { CN: 'follow-up 缺少锚点，需补充 URL/产品名/产品图', EN: 'Follow-up is missing an anchor; add URL/name/product photo' },
    followup_goal_not_resolved: { CN: 'follow-up 目标未明确，已按通用替代路径处理', EN: 'Follow-up goal was unclear; handled with default alternatives path' },
    related_semantics_reclassified: { CN: '部分 related 候选已重分类为搭配建议', EN: 'Some related candidates were reclassified as pairing ideas' },
    competitor_category_unknown_blocked: { CN: '类目信号不足的候选已拦截', EN: 'Category-unknown alternatives were blocked' },
    kb_entry_quarantined: { CN: '命中历史缓存异常，已隔离并实时重算', EN: 'A stale KB hit was quarantined and recalculated in real time' },
    regulatory_source_used: { CN: '已启用监管源补充证据', EN: 'Regulatory source was used as evidence backup' },
    ingredient_source_conflict: { CN: '不同来源成分存在冲突，已降低置信度', EN: 'Ingredient sources conflict; confidence was lowered' },
    incidecoder_source_used: { CN: '已启用 INCIDecoder 补充证据', EN: 'INCIDecoder was used as a supplemental source' },
    incidecoder_no_match: { CN: 'INCIDecoder 未匹配到对应产品', EN: 'INCIDecoder did not find a matching product' },
    incidecoder_fetch_failed: { CN: 'INCIDecoder 抓取失败', EN: 'INCIDecoder fetch failed' },
    incidecoder_unverified_not_persisted: {
      CN: 'INCIDecoder 结果未通过交叉验证，已阻断 KB 回写',
      EN: 'INCIDecoder result was not cross-validated and was blocked from KB persistence',
    },
    version_verification_needed: { CN: '需核对地区/批次版本差异', EN: 'Version/region verification is still needed' },
    retail_source_no_match: { CN: '零售平台未匹配到对应产品', EN: 'Retail cross-check did not find a matching product' },
    retail_source_used: { CN: '已使用零售平台补充成分证据', EN: 'Retail source was used for ingredient evidence' },
    ingredient_concentration_unknown: { CN: '成分浓度未披露', EN: 'Ingredient concentrations are not disclosed' },
    llm_verification_used: { CN: '已使用 AI 知识库交叉验证成分', EN: 'AI knowledge was used to cross-verify ingredients' },
    'skin_fit.profile.skinType': { CN: '未提供肤质信息', EN: 'Skin type was not provided' },
    'skin_fit.profile.sensitivity': { CN: '未提供敏感度信息', EN: 'Sensitivity was not provided' },
    'skin_fit.profile.barrierStatus': { CN: '未提供屏障状态', EN: 'Barrier status was not provided' },
  };
  if (map[c]?.[language]) return map[c][language];
  if (isInternalMissingInfoCode(c)) return '';
  return c
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const NON_SKINCARE_ALTERNATIVE_RE = /\b(brush|applicator|blender|tool|comb|razor|shaver|makeup\s*brush)\b/i;

function isLikelyNonSkincareAlternativeCandidate(candidate: Record<string, unknown> | null) {
  const row = candidate || {};
  const signal = [
    asString((row as any).name),
    asString((row as any).display_name),
    asString((row as any).displayName),
    asString((row as any).category),
    asString((row as any).category_name),
    asString((row as any).categoryName),
    asString((row as any).product_type),
    asString((row as any).productType),
    asString((row as any).type),
  ].join(' ').toLowerCase();
  if (!signal) return false;
  return NON_SKINCARE_ALTERNATIVE_RE.test(signal);
}

export function RecommendationsCard({
  card,
  language,
  debug,
  resolveOffers,
  resolveProductRef,
  resolveProductsSearch,
  onDeepScanProduct,
  onOpenPdp,
  analyticsCtx,
  onOpenAlternativesSheet,
  loadAlternativesForItem,
  loadRecommendationCompatibility,
}: {
  card: Card;
  language: 'EN' | 'CN';
  debug: boolean;
  resolveOffers?: (args: { sku_id?: string | null; product_id?: string | null; merchant_id?: string | null }) => Promise<any>;
  resolveProductRef?: (args: {
    query: string;
    lang: 'en' | 'cn';
    hints?: {
      product_ref?: { product_id?: string | null; merchant_id?: string | null } | null;
      product_id?: string | null;
      sku_id?: string | null;
      aliases?: Array<string | null | undefined>;
      brand?: string | null;
      title?: string | null;
    };
    signal?: AbortSignal;
  }) => Promise<any>;
  resolveProductsSearch?: (args: {
    query: string;
    limit?: number;
    preferBrand?: string | null;
    uiSurface?: string | null;
    clarificationSlot?: string | null;
    clarificationAnswer?: string | null;
    slotState?: ProductSearchSlotState | null;
  }) => Promise<any>;
  onDeepScanProduct?: (inputText: string) => void;
  onOpenPdp?: (args: { url: string; title?: string }) => void;
  analyticsCtx?: AnalyticsContext;
  onOpenAlternativesSheet?: (tracks: ProductAlternativeTrack[]) => void;
  loadAlternativesForItem?: (args: {
    anchorProductId?: string | null;
    productInput?: string | null;
    product?: Record<string, unknown> | null;
  }) => Promise<{ alternatives: Array<Record<string, unknown>>; llmTrace?: Record<string, unknown> | null } | null>;
  loadRecommendationCompatibility?: (routine: {
    am: Array<Record<string, unknown>>;
    pm: Array<Record<string, unknown>>;
  }) => Promise<{ analysisReady: boolean; safe: boolean; summary: string | null; conflicts: string[] } | null>;
}) {
  type PdpOpenState = 'idle' | 'resolving' | 'opening_internal' | 'opening_external' | 'done' | 'error';
  type PdpOpenPath = 'group' | 'ref' | 'resolve' | 'external';
  type ProductResolverHints = {
    product_ref?: { product_id?: string | null; merchant_id?: string | null } | null;
    product_id?: string | null;
    sku_id?: string | null;
    aliases?: Array<string | null | undefined>;
    brand?: string | null;
    title?: string | null;
  };
  type ProductPdpCardInput = {
    anchor_key: string;
    position: number;
    brand: string | null;
    name: string | null;
    match_state?: string | null;
    subject_product_group_id?: string | null;
    canonical_product_ref?: { product_id?: string | null; merchant_id?: string | null } | null;
    resolve_query?: string | null;
    hints?: ProductResolverHints;
    pdp_open?: {
      path?: string | null;
      resolve_reason_code?: string | null;
      external?: { query?: string | null; url?: string | null } | null;
    } | null;
  };
  type RecoRoutineStep = RoutineStep & {
    slot: 'am' | 'pm';
    position: number;
    rawItem: RecoItem;
    anchor_key: string | null;
    subject_product_group_id?: string | null;
    canonical_product_ref?: { product_id?: string | null; merchant_id?: string | null } | null;
    resolve_query?: string | null;
    hints?: ProductResolverHints;
    pdp_open?: ProductPdpCardInput['pdp_open'];
    anchor_product_id?: string | null;
    product_input?: string | null;
    details_tracks: ProductAlternativeTrack[];
    can_load_alternatives: boolean;
  };
  type RecoCompatibilityState = {
    compatibility: 'known';
    conflicts: string[];
    summary: string | null;
  } | null;
  const [detailsFlow, setDetailsFlow] = useState<{ key: string | null; state: PdpOpenState }>({ key: null, state: 'idle' });
  const [lazyAlternativesBusyKey, setLazyAlternativesBusyKey] = useState<string | null>(null);
  const [compatibilityState, setCompatibilityState] = useState<RecoCompatibilityState>(null);
  const inflightByKeyRef = useRef<Map<string, { controller: AbortController; promise: Promise<void> }>>(new Map());
  const clickLockByKeyRef = useRef<Set<string>>(new Set());

  const payload = asObject(card.payload) || {};
  const items = (() => {
    const fromPayload = asArray(payload.recommendations) as RecoItem[];
    if (fromPayload.length > 0) return fromPayload;
    const sections = asArray((payload as any).sections);
    for (const section of sections) {
      const sec = section && typeof section === 'object' ? section as Record<string, unknown> : null;
      if (!sec) continue;
      const products = asArray(sec.products) as RecoItem[];
      if (products.length > 0) return products;
    }
    return [] as RecoItem[];
  })();
  const hasAnyAlternatives = items.some((it) => asArray((it as any).alternatives).length > 0);
  const hasMissingAlternatives =
    hasAnyAlternatives && items.some((it) => asArray((it as any).alternatives).length === 0);
  const [detailsOpen, setDetailsOpen] = useState(() => hasAnyAlternatives);

  const looksLikeOpaqueId = useCallback((value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const s = value.trim();
    if (!s) return false;
    if (/^kb:/i.test(s)) return true;
    if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)) return true;
    const compactUuid = s.replace(/[\s_-]/g, '').replace(/-/g, '');
    if (/^[0-9a-f]{32}$/i.test(compactUuid)) return true;
    if (/^[0-9a-f]{24,}$/i.test(s) && /[a-f]/i.test(s)) return true;
    return false;
  }, []);

  useEffect(
    () => () => {
      for (const entry of inflightByKeyRef.current.values()) {
        entry.controller.abort('component_unmount');
      }
      inflightByKeyRef.current.clear();
      clickLockByKeyRef.current.clear();
    },
    [],
  );

  const classifyResolveFailure = useCallback((resp: unknown): { reason: string; allowExternalFallback: boolean } => {
    const root = asObject(resp);
    if (!root) return { reason: 'resolve_invalid_schema', allowExternalFallback: false };
    if (typeof (root as any).resolved !== 'boolean') {
      return { reason: 'resolve_invalid_schema', allowExternalFallback: false };
    }
    if ((root as any).resolved === true) {
      return { reason: 'resolve_missing_stable_key', allowExternalFallback: false };
    }

    const reasonCodeRaw =
      asString((root as any).reason_code) ||
      asString((root as any).reasonCode) ||
      asString((root as any).data?.reason_code) ||
      asString((root as any).data?.reasonCode) ||
      asString((root as any).error?.reason_code) ||
      asString((root as any).error?.reasonCode) ||
      null;
    const reasonCode = reasonCodeRaw ? reasonCodeRaw.toUpperCase() : null;
    if (!reasonCode) {
      return { reason: 'resolve_missing_reason_code', allowExternalFallback: false };
    }
    return {
      reason: `resolve_${reasonCode.toLowerCase()}`,
      allowExternalFallback: PDP_EXTERNAL_FALLBACK_REASON_CODES.has(reasonCode),
    };
  }, []);

  const openExternalGoogle = useCallback(
    (query: string): { opened: boolean; url: string | null } => {
      const googleUrl = buildGoogleSearchFallbackUrl(query, language);
      if (!googleUrl) return { opened: false, url: null };
      try {
        return {
          opened: Boolean(window.open(googleUrl, '_blank', 'noopener,noreferrer')),
          url: googleUrl,
        };
      } catch {
        return { opened: false, url: googleUrl };
      }
    },
    [language],
  );

  const openPdpFromCard = useCallback(
    async (card: ProductPdpCardInput) => {
      const anchorKey = String(card.anchor_key || '').trim();
      if (!anchorKey) return;

      const existing = inflightByKeyRef.current.get(anchorKey);
      if (existing) {
        const allowReplayAfterSettle = detailsFlow.key === anchorKey && detailsFlow.state === 'done';
        await existing.promise;
        if (!allowReplayAfterSettle) return;
      }
      if (clickLockByKeyRef.current.has(anchorKey)) return;
      clickLockByKeyRef.current.add(anchorKey);

      for (const [key, entry] of inflightByKeyRef.current.entries()) {
        if (key !== anchorKey) {
          entry.controller.abort('superseded');
        }
      }

      const controller = new AbortController();
      const startedAt = Date.now();
      let openPath: PdpOpenPath | null = null;
      let failReason: string | null = null;

      const position = Math.max(0, Number(card.position) || 0);
      const safeBrand = String(card.brand || '').trim();
      const safeName = String(card.name || '').trim();
      const matchState = String(card.match_state || '').trim().toLowerCase();
      const title = [safeBrand, safeName].filter(Boolean).join(' ').trim();
      const skuType = card.hints?.sku_id
        ? 'sku_id'
        : card.hints?.product_id
          ? 'product_id'
          : 'name_query';

      const openInternalPdp = (target: { product_id: string; merchant_id?: string | null }, path: Exclude<PdpOpenPath, 'external'>) => {
        openPath = path;
        setDetailsFlow({ key: anchorKey, state: 'opening_internal' });

        const pdpUrl = buildPdpUrl({
          product_id: target.product_id,
          merchant_id: target.merchant_id ?? null,
        });

        if (analyticsCtx) {
          emitPdpOpenPath(analyticsCtx, {
            card_position: position,
            path,
            anchor_key: anchorKey,
          });
          emitUiPdpOpened(analyticsCtx, {
            product_id: target.product_id,
            merchant_id: target.merchant_id ?? null,
            card_position: position,
            sku_type: skuType,
          });
        }

        if (onOpenPdp) {
          onOpenPdp({ url: pdpUrl, ...(title ? { title } : {}) });
        } else {
          window.location.assign(pdpUrl);
        }
      };

      const promise = (async () => {
        try {
          if (analyticsCtx) {
            emitPdpClick(analyticsCtx, {
              card_position: position,
              anchor_key: anchorKey,
            });
          }
          setDetailsFlow({ key: anchorKey, state: 'resolving' });

          const preferredPdpPath = String(card.pdp_open?.path || '').trim().toLowerCase();
          const hintedReasonCode = String(card.pdp_open?.resolve_reason_code || '').trim().toUpperCase();
          const hintedExternalQuery =
            String(card.pdp_open?.external?.query || '').trim() ||
            String(card.resolve_query || '').trim() ||
            [safeBrand, safeName]
              .map((v) => String(v || '').trim())
              .filter(Boolean)
              .join(' ')
              .trim();
          const resolveQuery = String(card.resolve_query || '').trim();
          const hintedExternalUrl = normalizeOutboundFallbackUrl(String(card.pdp_open?.external?.url || '').trim());
          const hasStrongNoCandidatesHint = (() => {
            const normalizeHintToken = (value: unknown) =>
              String(value || '')
                .trim()
                .replace(/\s+/g, ' ')
                .toLowerCase();
            const isMeaningfulHintToken = (value: unknown) => {
              const token = normalizeHintToken(value);
              if (!token) return false;
              if (token === 'unknown' || token === 'n/a' || token === 'na' || token === 'null' || token === 'undefined') return false;
              const compact = token.replace(/[^a-z0-9\u4e00-\u9fff]/gi, '');
              return compact.length >= 3;
            };
            const isStrongHumanQuery = (value: unknown) => {
              const query = String(value || '')
                .trim()
                .replace(/\s+/g, ' ');
              if (!query) return false;
              if (looksLikeOpaqueId(query)) return false;
              const words = query.split(/\s+/).filter(Boolean);
              if (words.filter((w) => isMeaningfulHintToken(w)).length >= 2 && query.length >= 8) return true;
              if (/[\u4e00-\u9fff]/.test(query) && query.length >= 4) return true;
              return false;
            };
            const hintedProductId =
              String(card.hints?.product_ref?.product_id || '').trim() ||
              String(card.hints?.product_id || '').trim() ||
              '';
            const hasResolvableProductIdHint = Boolean(hintedProductId && !looksLikeOpaqueId(hintedProductId));
            const hasBrandTitleHint = isMeaningfulHintToken(card.hints?.brand) && isMeaningfulHintToken(card.hints?.title);
            const hasAliasHint = (card.hints?.aliases || []).some((alias) => isStrongHumanQuery(alias));
            return (
              hasResolvableProductIdHint ||
              hasBrandTitleHint ||
              hasAliasHint ||
              isStrongHumanQuery(hintedExternalQuery) ||
              isStrongHumanQuery(resolveQuery)
            );
          })();
          const shouldRetryNoCandidatesBeforeExternal =
            RECO_PDP_NO_CANDIDATES_RETRY_ENABLED &&
            preferredPdpPath === 'external' &&
            hintedReasonCode === 'NO_CANDIDATES' &&
            hasStrongNoCandidatesHint;
          const shouldDirectExternalFromMatchState =
            preferredPdpPath === 'external' &&
            matchState === 'llm_seed' &&
            !shouldRetryNoCandidatesBeforeExternal;
          const shouldDirectExternalFromHint =
            preferredPdpPath === 'external' &&
            PDP_EXTERNAL_DIRECT_OPEN_REASON_CODES.has(hintedReasonCode) &&
            !shouldRetryNoCandidatesBeforeExternal;
          const shouldSuppressExternalPopupToast = shouldDirectExternalFromMatchState;

          const groupTarget = extractPdpTargetFromProductGroupId(card.subject_product_group_id || null);
          if (card.subject_product_group_id && !groupTarget) {
            failReason = failReason || 'invalid_product_group_id';
          }
          if (groupTarget?.product_id) {
            openInternalPdp(groupTarget, 'group');
            setDetailsFlow({ key: anchorKey, state: 'done' });
            return;
          }

          const canonicalRef = card.canonical_product_ref;
          const canonicalProductId = String(canonicalRef?.product_id || '').trim();
          const canonicalMerchantId = String(canonicalRef?.merchant_id || '').trim() || null;
          if (canonicalRef && (!canonicalProductId || looksLikeOpaqueId(canonicalProductId))) {
            failReason = failReason || 'invalid_canonical_ref';
          }
          if (canonicalProductId && !looksLikeOpaqueId(canonicalProductId)) {
            openInternalPdp(
              {
                product_id: canonicalProductId,
                ...(canonicalMerchantId ? { merchant_id: canonicalMerchantId } : {}),
              },
              'ref',
            );
            setDetailsFlow({ key: anchorKey, state: 'done' });
            return;
          }

          if (shouldDirectExternalFromHint || shouldDirectExternalFromMatchState) {
            openPath = 'external';
            setDetailsFlow({ key: anchorKey, state: 'opening_external' });
            const external =
              hintedExternalUrl
                ? {
                    opened: Boolean(window.open(hintedExternalUrl, '_blank', 'noopener,noreferrer')),
                    url: hintedExternalUrl,
                  }
                : openExternalGoogle(hintedExternalQuery);
            if (analyticsCtx) {
              emitPdpOpenPath(analyticsCtx, {
                card_position: position,
                path: 'external',
                anchor_key: anchorKey,
                url: external.url,
              });
            }
            if (external.opened) {
              setDetailsFlow({ key: anchorKey, state: 'done' });
              return;
            }
            failReason = failReason || (!external.url ? 'google_query_empty' : 'popup_blocked');
            setDetailsFlow({ key: anchorKey, state: 'error' });
            if (shouldSuppressExternalPopupToast) {
              return;
            }
            toast({
              title: language === 'CN' ? '无法打开外部页面' : 'Unable to open external page',
              description:
                language === 'CN'
                  ? '浏览器可能拦截了新标签页弹窗，请允许后重试。'
                  : 'Your browser may have blocked the popup. Please allow popups and retry.',
            });
            return;
          }

          let resolvedTarget: { product_id: string; merchant_id?: string | null } | null = null;
          let allowExternalFallback =
            preferredPdpPath === 'external' && !PDP_EXTERNAL_RETRY_INTERNAL_REASON_CODES.has(hintedReasonCode);

          if (!resolveProductRef) {
            failReason = failReason || 'resolve_unavailable';
          } else if (!resolveQuery) {
            failReason = failReason || 'missing_resolve_query';
          } else {
            openPath = 'resolve';
            const timeoutId = window.setTimeout(() => {
              if (!controller.signal.aborted) controller.abort('resolve_timeout');
            }, VIEW_DETAILS_RESOLVE_TIMEOUT_MS);

            try {
              const resp = await resolveProductRef({
                query: resolveQuery,
                lang: language === 'CN' ? 'cn' : 'en',
                ...(card.hints ? { hints: card.hints } : {}),
                signal: controller.signal,
              });
              const strictTarget = extractStablePdpTargetFromProductsResolveResponse(resp);
              if (strictTarget?.product_id) {
                resolvedTarget = strictTarget;
              } else {
                const failure = classifyResolveFailure(resp);
                failReason = failReason || failure.reason;
                if (failure.allowExternalFallback) allowExternalFallback = true;
              }
              if (debug) {
                console.info('[RecoViewDetails] strict resolve result', {
                  query: resolveQuery,
                  resolved: Boolean(strictTarget?.product_id),
                });
              }
            } catch {
              if (controller.signal.aborted && controller.signal.reason === 'superseded') {
                return;
              }
              failReason =
                controller.signal.aborted && controller.signal.reason === 'resolve_timeout'
                  ? 'resolve_timeout'
                  : 'resolve_request_error';
              allowExternalFallback = true;
            } finally {
              window.clearTimeout(timeoutId);
            }
          }

          if (resolvedTarget?.product_id) {
            openInternalPdp(
              {
                product_id: resolvedTarget.product_id,
                merchant_id: resolvedTarget.merchant_id ?? null,
              },
              'resolve',
            );
            setDetailsFlow({ key: anchorKey, state: 'done' });
            return;
          }

          if (!allowExternalFallback) {
            setDetailsFlow({ key: anchorKey, state: 'error' });
            toast({
              title: language === 'CN' ? '无法打开商品详情' : 'Unable to open product details',
              description:
                language === 'CN'
                  ? '未找到稳定商品标识，请稍后重试。'
                  : 'A stable product key was not available. Please retry shortly.',
            });
            return;
          }

          openPath = 'external';
          setDetailsFlow({ key: anchorKey, state: 'opening_external' });
          const externalQuery =
            hintedExternalQuery ||
            resolveQuery ||
            [safeBrand, safeName]
              .map((v) => String(v || '').trim())
              .filter(Boolean)
              .join(' ')
              .trim();
          const external =
            hintedExternalUrl
              ? {
                  opened: Boolean(window.open(hintedExternalUrl, '_blank', 'noopener,noreferrer')),
                  url: hintedExternalUrl,
                }
              : openExternalGoogle(externalQuery);
          if (analyticsCtx) {
            emitPdpOpenPath(analyticsCtx, {
              card_position: position,
              path: 'external',
              anchor_key: anchorKey,
              url: external.url,
            });
          }

          if (!external.url) {
            failReason = failReason || 'google_query_empty';
          } else if (!external.opened) {
            failReason = failReason || 'popup_blocked';
          }

          if (external.opened) {
            setDetailsFlow({ key: anchorKey, state: 'done' });
            return;
          }

          setDetailsFlow({ key: anchorKey, state: 'error' });
          toast({
            title: language === 'CN' ? '无法打开外部页面' : 'Unable to open external page',
            description:
              language === 'CN'
                ? '浏览器可能拦截了新标签页弹窗，请允许后重试。'
                : 'Your browser may have blocked the popup. Please allow popups and retry.',
          });
        } finally {
          inflightByKeyRef.current.delete(anchorKey);
          clickLockByKeyRef.current.delete(anchorKey);
          const superseded = controller.signal.aborted && controller.signal.reason === 'superseded';
          if (!superseded && analyticsCtx) {
            if (failReason) {
              emitPdpFailReason(analyticsCtx, {
                card_position: position,
                anchor_key: anchorKey,
                reason: failReason,
              });
            }
            emitPdpLatencyMs(analyticsCtx, {
              card_position: position,
              anchor_key: anchorKey,
              path: openPath || 'resolve',
              pdp_latency_ms: Math.max(0, Date.now() - startedAt),
            });
          }
        }
      })();

      inflightByKeyRef.current.set(anchorKey, { controller, promise });
      await promise;
    },
    [
      analyticsCtx,
      classifyResolveFailure,
      debug,
      detailsFlow,
      language,
      onOpenPdp,
      openExternalGoogle,
      looksLikeOpaqueId,
      resolveProductRef,
    ],
  );

  const groups = items.reduce(
    (acc, item) => {
      const slot = String(item.slot || '').toLowerCase();
      if (slot === 'am') acc.am.push(item);
      else if (slot === 'pm') acc.pm.push(item);
      else acc.other.push(item);
      return acc;
    },
    { am: [] as RecoItem[], pm: [] as RecoItem[], other: [] as RecoItem[] },
  );

  const sectionTitle = (slot: 'am' | 'pm' | 'other') => {
    if (slot === 'am') return language === 'CN' ? '早上 AM' : 'AM';
    if (slot === 'pm') return language === 'CN' ? '晚上 PM' : 'PM';
    return language === 'CN' ? '其他' : 'Other';
  };

  const extractRecoDisplayData = useCallback(
    (item: RecoItem) => {
      const sku = asObject(item.sku) || asObject(item.product) || null;
      const modules = asArray((item as any).modules).map((entry) => asObject(entry)).filter(Boolean) as Array<Record<string, unknown>>;
      const moduleData = modules.map((entry) => asObject((entry as any).data)).find(Boolean) || null;
      const pdpPayload = asObject((moduleData as any)?.pdp_payload) || asObject((moduleData as any)?.pdpPayload) || null;
      const pdpProduct = asObject((pdpPayload as any)?.product) || asObject((moduleData as any)?.product) || null;
      return {
        sku,
        brand:
          asString(sku?.brand) ||
          asString((sku as any)?.Brand) ||
          asString((item as any).brand) ||
          asString((pdpProduct as any)?.brand?.name) ||
          asString((pdpProduct as any)?.brand) ||
          null,
        name:
          asString(sku?.name) ||
          asString(sku?.display_name) ||
          asString((sku as any)?.displayName) ||
          asString((item as any).name) ||
          asString((item as any).display_name) ||
          asString((item as any).displayName) ||
          asString((item as any).title) ||
          asString((pdpProduct as any)?.title) ||
          asString((pdpProduct as any)?.name) ||
          null,
        category:
          asString(item.category) ||
          asString((item as any).step) ||
          asString((pdpProduct as any)?.category) ||
          asString(asArray((pdpProduct as any)?.category_path).slice(-1)[0]) ||
          null,
        canonicalProductRef:
          asObject((item as any).canonical_product_ref) ||
          asObject((item as any).canonicalProductRef) ||
          asObject((item as any)?.subject?.canonical_product_ref) ||
          asObject((item as any)?.subject?.canonicalProductRef) ||
          asObject((moduleData as any)?.canonical_product_ref) ||
          asObject((moduleData as any)?.canonicalProductRef) ||
          null,
        rawProductId:
          asString((item as any)?.product_id) ||
          asString((item as any)?.productId) ||
          asString((pdpProduct as any)?.product_id) ||
          asString((pdpProduct as any)?.productId) ||
          asString((item as any)?.subject?.id) ||
          null,
      };
    },
    [],
  );

  const buildStepAlternativesSheetTracks = useCallback(
    (
      alternativesSource: Array<Record<string, unknown>>,
      pairingSource: string[],
      comparisonSource: string[],
    ): ProductAlternativeTrack[] => {
      const replaceItemsWithIndex = alternativesSource
        .map((alt, rank) => {
          const display = normalizeAlternativeDisplayCandidate(alt);
          if (!display) return null;
          const kind = String(asString((alt as any).kind) || '').toLowerCase();
          const block: RecoBlockType =
            kind === 'dupe' ? 'dupes' : kind === 'premium' ? 'related_products' : 'competitors';
          return {
            candidate: alt,
            display,
            block,
            rank: rank + 1,
            intent: 'replace',
          };
        })
        .filter(Boolean) as ProductAlternativeTrackItem[];
      const replaceItems = replaceItemsWithIndex.slice(0, 8);

      const pairNotes = uniqueStrings([...pairingSource, ...comparisonSource]).slice(0, 8);
      const pairItems: ProductAlternativeTrackItem[] = pairNotes
        .map((text, rank) => {
          const candidate = {
            name: text,
            display_name: text,
            why_candidate: { summary: text },
            tradeoff_notes: [text],
          };
          const display = normalizeAlternativeDisplayCandidate(candidate);
          if (!display) return null;
          return {
            candidate,
            display,
            block: 'related_products',
            rank: rank + 1,
            intent: 'pair',
          };
        })
        .filter(Boolean) as ProductAlternativeTrackItem[];

      const tracks: ProductAlternativeTrack[] = [];
      if (replaceItems.length) {
        tracks.push({
          key: 'replace',
          title: language === 'CN' ? '更多对比候选' : 'More comparison candidates',
          subtitle: language === 'CN' ? '用于替换当前产品' : 'Direct alternatives to replace current product',
          items: replaceItems,
          filteredCount: Math.max(0, alternativesSource.length - replaceItemsWithIndex.length),
        });
      }
      if (pairItems.length) {
        tracks.push({
          key: 'pair',
          title: language === 'CN' ? '搭配与组合建议' : 'Pairing suggestions',
          subtitle: language === 'CN' ? '可叠加或互补使用的建议' : 'Items/steps that pair or complement this choice',
          items: pairItems,
          filteredCount: 0,
        });
      }
      return tracks;
    },
    [language],
  );

  const getRecommendationAlternativeRequest = useCallback(
    ({
      item,
      brand,
      name,
      isExternalItem,
      anchorId,
      resolveQuery,
      fallbackQuery,
    }: {
      item: RecoItem;
      brand: string | null;
      name: string | null;
      isExternalItem: boolean;
      anchorId: string | null;
      resolveQuery: string | null;
      fallbackQuery: string | null;
    }) => {
      const llmSuggestion = asObject((item as any).llm_suggestion || (item as any).llmSuggestion) || null;
      const searchAliases = uniqueStrings(
        asArray((llmSuggestion as any)?.search_aliases ?? (llmSuggestion as any)?.searchAliases)
          .map((value) => asString(value))
          .filter(Boolean),
      );
      const preferredExternalQuery = searchAliases[0] || resolveQuery || fallbackQuery || null;
      const hasNamedIdentity = Boolean(String(brand || '').trim() && String(name || '').trim());
      const canLoadAlternatives = Boolean(loadAlternativesForItem) && (
        isExternalItem
          ? Boolean(hasNamedIdentity || preferredExternalQuery)
          : Boolean(anchorId || resolveQuery || fallbackQuery)
      );
      return {
        productInput: isExternalItem ? preferredExternalQuery : (resolveQuery || fallbackQuery || null),
        canLoadAlternatives,
      };
    },
    [loadAlternativesForItem],
  );

  const openRecommendationAlternativesForStep = useCallback(
    async (step: RecoRoutineStep) => {
      if (!onOpenAlternativesSheet) return;

      if (step.details_tracks.length > 0) {
        onOpenAlternativesSheet(step.details_tracks);
        return;
      }

      if (!loadAlternativesForItem || !step.can_load_alternatives) return;

      const busyKey = step.anchor_key || `q:${String(step.product_input || '').slice(0, 180)}`;
      if (!busyKey) return;

      setLazyAlternativesBusyKey(busyKey);
      try {
        const resp = await loadAlternativesForItem({
          anchorProductId: step.anchor_product_id,
          productInput: step.product_input || null,
          product: asObject(step.rawItem),
        });
        const remoteAlternatives = asArray(resp && resp.alternatives)
          .map((row) => asObject(row))
          .filter(Boolean) as Array<Record<string, unknown>>;
        if (!remoteAlternatives.length) {
          toast({
            title: language === 'CN' ? '暂无更多对比候选' : 'No extra comparison candidates yet',
            description:
              language === 'CN'
                ? '当前这条推荐还没有可用的对比候选，稍后可重试。'
                : 'No usable comparison candidates were found for this recommendation yet. Retry later.',
          });
          return;
        }
        const evidencePack = asObject((step.rawItem as any).evidence_pack) || asObject((step.rawItem as any).evidencePack) || null;
        const pairingRules = asArray(evidencePack?.pairingRules ?? evidencePack?.pairing_rules)
          .map((v) => asString(v))
          .filter(Boolean) as string[];
        const comparisonNotes = asArray(evidencePack?.comparisonNotes ?? evidencePack?.comparison_notes)
          .map((v) => asString(v))
          .filter(Boolean) as string[];
        const tracks = buildStepAlternativesSheetTracks(remoteAlternatives, pairingRules, comparisonNotes);
        if (tracks.length) {
          onOpenAlternativesSheet(tracks);
        } else {
          toast({
            title: language === 'CN' ? '暂无更多对比候选' : 'No extra comparison candidates yet',
            description:
              language === 'CN'
                ? '已保留当前推荐结果，稍后可重试查看更多对比和搭配建议。'
                : 'Current recommendations are kept. Retry later for more alternatives and pairing ideas.',
          });
        }
      } catch {
        toast({
          title: language === 'CN' ? '加载更多对比失败' : 'Failed to load more alternatives',
          description:
            language === 'CN'
              ? '请稍后重试，当前推荐卡已可继续使用。'
              : 'Please retry shortly. Current recommendation cards are still usable.',
        });
      } finally {
        setLazyAlternativesBusyKey((prev) => (prev === busyKey ? null : prev));
      }
    },
    [buildStepAlternativesSheetTracks, language, loadAlternativesForItem, onOpenAlternativesSheet],
  );

  const openRecommendationPdpForStep = useCallback(
    async (step: RecoRoutineStep) => {
      if (!step.anchor_key) return;
      await openPdpFromCard({
        anchor_key: step.anchor_key,
        position: step.position,
        brand: step.product.brand,
        name: step.product.name,
        match_state:
          asString((step.rawItem as any)?.metadata?.match_state) ||
          asString((step.rawItem as any)?.metadata?.matchState) ||
          null,
        subject_product_group_id: step.subject_product_group_id,
        canonical_product_ref: step.canonical_product_ref,
        resolve_query: step.resolve_query || null,
        hints: step.hints,
        pdp_open: step.pdp_open,
      });
    },
    [openPdpFromCard],
  );

  const toCompatibilityStepInput = useCallback(
    (item: RecoItem) => {
      const display = extractRecoDisplayData(item);
      const brand = String(display.brand || '').trim();
      const name = String(display.name || '').trim();
      const step = asString((item as any).step) || display.category || '';
      const evidencePack = asObject((item as any).evidence_pack) || asObject((item as any).evidencePack) || null;
      const ingredients = asObject((item as any).ingredients) || null;
      const keyActives = uniqueStrings([
        ...asArray((item as any).key_actives).map((value) => asString(value)),
        ...asArray((item as any).keyActives).map((value) => asString(value)),
        ...asArray(evidencePack?.keyActives ?? evidencePack?.key_actives).map((value) => asString(value)),
      ]).slice(0, 8);
      return {
        ...(brand ? { brand } : {}),
        ...(name ? { name, title: name } : {}),
        ...(step ? { step, category: step } : {}),
        ...(brand || name ? { product: [brand, name].filter(Boolean).join(' ').trim() } : {}),
        ...(keyActives.length ? { key_actives: keyActives } : {}),
        ...(evidencePack ? { evidence_pack: evidencePack } : {}),
        ...(ingredients ? { ingredients } : {}),
      };
    },
    [extractRecoDisplayData],
  );

  const renderStep = (item: RecoItem, idx: number) => {
    const display = extractRecoDisplayData(item);
    const sku = display.sku;
    const itemRef = asObject((item as any).product_ref) || asObject((item as any).productRef) || null;
    const skuRef = asObject((sku as any)?.product_ref) || asObject((sku as any)?.productRef) || null;
    const itemCanonicalTop = display.canonicalProductRef;
    const skuCanonicalTop =
      asObject((sku as any)?.canonical_product_ref) ||
      asObject((sku as any)?.canonicalProductRef) ||
      null;
    const itemCanonicalRef =
      itemCanonicalTop ||
      asObject((itemRef as any)?.canonical_product_ref) ||
      asObject((itemRef as any)?.canonicalProductRef) ||
      skuCanonicalTop ||
      asObject((skuRef as any)?.canonical_product_ref) ||
      asObject((skuRef as any)?.canonicalProductRef) ||
      null;
    const subjectProductGroupId =
      asString((item as any)?.subject?.product_group_id) ||
      asString((item as any)?.subject?.productGroupId) ||
      asString((sku as any)?.subject?.product_group_id) ||
      asString((sku as any)?.subject?.productGroupId) ||
      asString((item as any)?.product_group_id) ||
      asString((item as any)?.productGroupId) ||
      asString((sku as any)?.product_group_id) ||
      asString((sku as any)?.productGroupId) ||
      null;
    const brand = display.brand;
    const nameFromName = display.name || asString((sku as any)?.Name) || null;
    const nameFromDisplay = asString(sku?.display_name) || asString((sku as any)?.displayName) || display.name || null;
    const name =
      (nameFromName && !looksLikeOpaqueId(nameFromName) ? nameFromName : null) ||
      nameFromDisplay ||
      nameFromName ||
      null;
    const skuId = asString((sku as any)?.sku_id) || asString((sku as any)?.skuId) || null;
    const canonicalProductId =
      asString((itemCanonicalRef as any)?.product_id) ||
      asString((itemCanonicalRef as any)?.productId) ||
      null;
    const refProductId =
      asString((itemRef as any)?.product_id) ||
      asString((itemRef as any)?.productId) ||
      asString((skuRef as any)?.product_id) ||
      asString((skuRef as any)?.productId) ||
      null;
    const rawProductId = display.rawProductId || asString((sku as any)?.product_id) || asString((sku as any)?.productId) || null;
    const productId = pickPreferredId([canonicalProductId, refProductId, rawProductId], looksLikeOpaqueId);
    const canonicalMerchantId =
      asString((itemCanonicalRef as any)?.merchant_id) ||
      asString((itemCanonicalRef as any)?.merchantId) ||
      null;
    const refMerchantId =
      asString((itemRef as any)?.merchant_id) ||
      asString((itemRef as any)?.merchantId) ||
      asString((skuRef as any)?.merchant_id) ||
      asString((skuRef as any)?.merchantId) ||
      null;
    const rawMerchantId =
      asString((item as any)?.merchant_id) ||
      asString((item as any)?.merchantId) ||
      asString((sku as any)?.merchant_id) ||
      asString((sku as any)?.merchantId) ||
      asString((sku as any)?.merchant?.id) ||
      asString((sku as any)?.merchant?.merchant_id) ||
      asString((sku as any)?.merchant?.merchantId) ||
      null;
    const merchantId = pickPreferredId([canonicalMerchantId, refMerchantId, rawMerchantId], looksLikeOpaqueId);
    const q = [brand, name].map((v) => String(v || '').trim()).filter(Boolean).join(' ').trim();
    const canonicalRefTarget = canonicalProductId
      && !looksLikeOpaqueId(canonicalProductId)
      ? {
          product_id: canonicalProductId,
          ...(canonicalMerchantId ? { merchant_id: canonicalMerchantId } : {}),
        }
      : null;
    const pdpOpen = asObject((item as any).pdp_open) || asObject((item as any).pdpOpen) || null;
    const pdpOpenExternal = asObject((pdpOpen as any)?.external) || null;
    const itemResolveReasonCode =
      asString((item as any)?.metadata?.resolve_reason_code) ||
      asString((item as any)?.metadata?.resolveReasonCode) ||
      asString((item as any)?.metadata?.pdp_open_fail_reason) ||
      asString((item as any)?.metadata?.resolve_fail_reason) ||
      null;
    const pdpOpenHint = pdpOpen
      ? {
          path: asString((pdpOpen as any)?.path) || null,
          resolve_reason_code: asString((pdpOpen as any)?.resolve_reason_code) || itemResolveReasonCode || null,
          external: pdpOpenExternal
            ? {
                query: asString((pdpOpenExternal as any)?.query) || null,
                url: asString((pdpOpenExternal as any)?.url) || null,
              }
            : null,
        }
      : null;
    const isExternalItem =
      String((pdpOpenHint as any)?.path || '').trim().toLowerCase() === 'external' ||
      String((item as any)?.metadata?.pdp_open_path || '').trim().toLowerCase() === 'external';
    const resolveQuery =
      [brand, name]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .filter((v) => !looksLikeOpaqueId(v))
        .join(' ')
        .trim() ||
      (!looksLikeOpaqueId(productId) ? String(productId || '').trim() : '') ||
      '';
    const resolverHints: ProductResolverHints = {
      ...(productId ? { product_id: productId } : {}),
      ...(skuId ? { sku_id: skuId } : {}),
      ...(brand ? { brand } : {}),
      ...(name ? { title: name } : {}),
      ...(productId || merchantId
        ? {
            product_ref: {
              ...(productId ? { product_id: productId } : {}),
              ...(merchantId ? { merchant_id: merchantId } : {}),
            },
          }
        : {}),
      ...(q ? { aliases: [q, name, brand].filter(Boolean) } : {}),
    };
    const externalAnchorSeed =
      asString((pdpOpenHint as any)?.external?.url) ||
      asString((pdpOpenHint as any)?.external?.query) ||
      null;
    const anchorId =
      subjectProductGroupId ||
      canonicalProductId ||
      productId ||
      skuId ||
      (q ? `q:${q}` : null) ||
      (externalAnchorSeed ? `ext:${externalAnchorSeed.slice(0, 180)}` : null);
    const isResolving = detailsFlow.state === 'resolving' && detailsFlow.key === anchorId;
    const step = asString(item.step) || display.category || (language === 'CN' ? '步骤' : 'Step');
    const typeRaw =
      String(asString((item as any).type) || asString((item as any).tier) || asString((item as any).kind) || '').toLowerCase();
    const type = typeRaw.includes('dupe') ? 'dupe' : 'premium';
    const notes = asArray(item.notes).map((n) => asString(n)).filter(Boolean) as string[];
    const alternativesRaw = asArray((item as any).alternatives).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
    const evidencePack = asObject((item as any).evidence_pack) || asObject((item as any).evidencePack) || null;
    const keyActives = asArray(evidencePack?.keyActives ?? evidencePack?.key_actives)
      .map((v) => asString(v))
      .filter(Boolean) as string[];
    const comparisonNotes = asArray(evidencePack?.comparisonNotes ?? evidencePack?.comparison_notes)
      .map((v) => asString(v))
      .filter(Boolean) as string[];
    const sensitivityFlagsRaw = asArray(evidencePack?.sensitivityFlags ?? evidencePack?.sensitivity_flags)
      .map((v) => asString(v))
      .filter(Boolean)
      .filter((v) => !isInternalKbCitationId(v)) as string[];
    const sensitivityFlags = filterContradictoryFragranceFlags(sensitivityFlagsRaw);
    const pairingRules = asArray(evidencePack?.pairingRules ?? evidencePack?.pairing_rules)
      .map((v) => asString(v))
      .filter(Boolean) as string[];
    const citations = asArray(evidencePack?.citations).map((v) => asString(v)).filter(Boolean) as string[];
    const internalCitations = citations.filter((c) => isInternalKbCitationId(c));
    const externalCitations = citations.filter((c) => !isInternalKbCitationId(c));

    const labelKind = (kindRaw: string | null) => {
      const k = String(kindRaw || '').trim().toLowerCase();
      if (k === 'dupe') return language === 'CN' ? '平替' : 'Dupe';
      if (k === 'premium') return language === 'CN' ? '升级款' : 'Premium';
      return language === 'CN' ? '相似' : 'Similar';
    };

    const detailsTracks = buildStepAlternativesSheetTracks(alternativesRaw, pairingRules, comparisonNotes);
    const anchorProductIdForAlternatives = subjectProductGroupId || canonicalProductId || productId || skuId || null;
    const alternativesBusyKey = anchorId || `q:${(resolveQuery || q || '').slice(0, 180)}`;
    const isLazyAlternativesBusy = lazyAlternativesBusyKey === alternativesBusyKey;
    const { productInput: alternativeProductInput, canLoadAlternatives } = getRecommendationAlternativeRequest({
      item,
      brand,
      name,
      isExternalItem,
      anchorId,
      resolveQuery: resolveQuery || null,
      fallbackQuery: q || null,
    });
    const canOpenSheet = Boolean(onOpenAlternativesSheet) && (detailsTracks.length > 0 || canLoadAlternatives);
    const canOpenPdp = Boolean(anchorId);
    const canOpenDetails = canOpenPdp || canOpenSheet;

    return (
      <div key={`${step}_${idx}`} className="rounded-2xl border border-border/60 bg-background/60 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground">{step}</div>
            <div className="text-sm font-semibold text-foreground">
              {brand ? `${brand} ` : ''}
              {name || (language === 'CN' ? '未知产品' : 'Unknown product')}
            </div>
            {isExternalItem ? (
              <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                External
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-muted-foreground">#{idx + 1}</div>
            <button
              type="button"
              className="chip-button text-[11px]"
              disabled={isResolving || isLazyAlternativesBusy || !canOpenDetails}
              onClick={() => {
                const summaryStep: RecoRoutineStep = {
                  category: normalizeCategory(step || ''),
                  product: {
                    brand: brand || (language === 'CN' ? '未知品牌' : 'Unknown'),
                    name: name || (language === 'CN' ? '未知产品' : 'Unknown'),
                  },
                  type,
                  external: isExternalItem,
                  slot: String(item.slot || '').trim().toLowerCase() === 'am' ? 'am' : 'pm',
                  position: idx + 1,
                  rawItem: item,
                  anchor_key: anchorId,
                  subject_product_group_id: subjectProductGroupId,
                  canonical_product_ref: canonicalRefTarget,
                  resolve_query: resolveQuery || null,
                  hints: Object.keys(resolverHints).length ? resolverHints : undefined,
                  pdp_open: pdpOpenHint,
                  anchor_product_id: anchorProductIdForAlternatives,
                  product_input: alternativeProductInput,
                  details_tracks: detailsTracks,
                  can_load_alternatives: canLoadAlternatives,
                };
                if (canOpenSheet) {
                  void openRecommendationAlternativesForStep(summaryStep);
                }
                if (canOpenPdp) {
                  void openRecommendationPdpForStep(summaryStep);
                }
              }}
            >
              {language === 'CN' ? '查看详情' : 'View details'}
              {isResolving || isLazyAlternativesBusy ? (
                <span className="ml-2 text-[10px] text-muted-foreground">{language === 'CN' ? '加载中…' : 'Loading…'}</span>
              ) : null}
            </button>
          </div>
        </div>

        {keyActives.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {keyActives.slice(0, 6).map((k) => (
              <span
                key={k}
                className="rounded-full border border-border/60 bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {k}
              </span>
            ))}
          </div>
        ) : null}

        {notes.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {notes.slice(0, 3).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}

        {alternativesRaw.length ? (
          <details className="mt-2 rounded-xl border border-border/50 bg-muted/30 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-primary/90">
              <span>{language === 'CN' ? '相似/平替/升级选择（点击查看差异）' : 'Alternatives (dupe / similar / premium) — see tradeoffs'}</span>
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="mt-3 space-y-2">
              {alternativesRaw.slice(0, 3).map((alt, j) => {
                const kind = asString((alt as any).kind);
                const kindLabel = labelKind(kind);
                const similarity = asNumber((alt as any).similarity);
                const altProduct = asObject((alt as any).product) || null;
                const altRef = asObject((alt as any).product_ref) || asObject((alt as any).productRef) || null;
                const altProductRef = asObject((altProduct as any)?.product_ref) || asObject((altProduct as any)?.productRef) || null;
                const altCanonicalTop =
                  asObject((alt as any).canonical_product_ref) ||
                  asObject((alt as any).canonicalProductRef) ||
                  asObject((altProduct as any)?.canonical_product_ref) ||
                  asObject((altProduct as any)?.canonicalProductRef) ||
                  null;
                const altCanonicalRef =
                  altCanonicalTop ||
                  asObject((altRef as any)?.canonical_product_ref) ||
                  asObject((altRef as any)?.canonicalProductRef) ||
                  asObject((altProductRef as any)?.canonical_product_ref) ||
                  asObject((altProductRef as any)?.canonicalProductRef) ||
                  null;
                const altSubjectProductGroupId =
                  asString((alt as any)?.subject?.product_group_id) ||
                  asString((alt as any)?.subject?.productGroupId) ||
                  asString((altProduct as any)?.subject?.product_group_id) ||
                  asString((altProduct as any)?.subject?.productGroupId) ||
                  asString((alt as any)?.product_group_id) ||
                  asString((alt as any)?.productGroupId) ||
                  asString((altProduct as any)?.product_group_id) ||
                  asString((altProduct as any)?.productGroupId) ||
                  null;
                const altBrand = asString(altProduct?.brand) || null;
                const altName =
                  asString(altProduct?.name) || asString((altProduct as any)?.display_name) || asString((altProduct as any)?.displayName) || null;
                const altSkuId =
                  asString((altProduct as any)?.sku_id) ||
                  asString((altProduct as any)?.skuId) ||
                  null;
                const altCanonicalProductId =
                  asString((altCanonicalRef as any)?.product_id) ||
                  asString((altCanonicalRef as any)?.productId) ||
                  null;
                const altRefProductId =
                  asString((altRef as any)?.product_id) ||
                  asString((altRef as any)?.productId) ||
                  asString((altProductRef as any)?.product_id) ||
                  asString((altProductRef as any)?.productId) ||
                  null;
                const altRawProductId =
                  asString((altProduct as any)?.product_id) ||
                  asString((altProduct as any)?.productId) ||
                  asString((alt as any)?.product_id) ||
                  asString((alt as any)?.productId) ||
                  null;
                const altProductId = pickPreferredId(
                  [altCanonicalProductId, altRefProductId, altRawProductId],
                  looksLikeOpaqueId,
                );
                const altCanonicalMerchantId =
                  asString((altCanonicalRef as any)?.merchant_id) ||
                  asString((altCanonicalRef as any)?.merchantId) ||
                  null;
                const altRefMerchantId =
                  asString((altRef as any)?.merchant_id) ||
                  asString((altRef as any)?.merchantId) ||
                  asString((altProductRef as any)?.merchant_id) ||
                  asString((altProductRef as any)?.merchantId) ||
                  null;
                const altRawMerchantId =
                  asString((altProduct as any)?.merchant_id) ||
                  asString((altProduct as any)?.merchantId) ||
                  asString((altProduct as any)?.merchant?.id) ||
                  asString((altProduct as any)?.merchant?.merchant_id) ||
                  asString((altProduct as any)?.merchant?.merchantId) ||
                  asString((alt as any)?.merchant_id) ||
                  asString((alt as any)?.merchantId) ||
                  null;
                const altMerchantId = pickPreferredId(
                  [altCanonicalMerchantId, altRefMerchantId, altRawMerchantId],
                  looksLikeOpaqueId,
                );
                const altResolveQuery =
                  [altBrand, altName]
                    .map((v) => String(v || '').trim())
                    .filter(Boolean)
                    .filter((v) => !looksLikeOpaqueId(v))
                    .join(' ')
                    .trim() ||
                  (!looksLikeOpaqueId(altProductId) ? String(altProductId || '').trim() : '') ||
                  '';
                const altQ = [altBrand, altName].map((v) => String(v || '').trim()).filter(Boolean).join(' ').trim();
                const altResolverHints: ProductResolverHints = {
                  ...(altProductId ? { product_id: altProductId } : {}),
                  ...(altSkuId ? { sku_id: altSkuId } : {}),
                  ...(altBrand ? { brand: altBrand } : {}),
                  ...(altName ? { title: altName } : {}),
                  ...(altQ ? { aliases: [altQ, altName, altBrand].filter(Boolean) } : {}),
                  ...(altProductId || altMerchantId
                    ? {
                        product_ref: {
                          ...(altProductId ? { product_id: altProductId } : {}),
                          ...(altMerchantId ? { merchant_id: altMerchantId } : {}),
                        },
                      }
                    : {}),
                };
                const altCanonicalRefTarget = altCanonicalProductId
                  && !looksLikeOpaqueId(altCanonicalProductId)
                  ? {
                      product_id: altCanonicalProductId,
                      ...(altCanonicalMerchantId ? { merchant_id: altCanonicalMerchantId } : {}),
                    }
                  : null;
                const altPdpOpen = asObject((alt as any)?.pdp_open) || asObject((alt as any)?.pdpOpen) || null;
                const altPdpOpenExternal = asObject((altPdpOpen as any)?.external) || null;
                const altResolveReasonCode =
                  asString((alt as any)?.metadata?.resolve_reason_code) ||
                  asString((alt as any)?.metadata?.resolveReasonCode) ||
                  asString((alt as any)?.metadata?.pdp_open_fail_reason) ||
                  asString((alt as any)?.metadata?.resolve_fail_reason) ||
                  null;
                const altPdpOpenHint = altPdpOpen
                  ? {
                      path: asString((altPdpOpen as any)?.path) || null,
                      resolve_reason_code: asString((altPdpOpen as any)?.resolve_reason_code) || altResolveReasonCode || null,
                      external: altPdpOpenExternal
                        ? {
                            query: asString((altPdpOpenExternal as any)?.query) || null,
                            url: asString((altPdpOpenExternal as any)?.url) || null,
                          }
                        : null,
                    }
                  : null;
                const altAnchorId = altSubjectProductGroupId || altCanonicalProductId || altProductId || altSkuId || (altQ ? `q:${altQ}` : '');
                const isAltResolving = Boolean(altAnchorId) && detailsFlow.state === 'resolving' && detailsFlow.key === altAnchorId;
                const tradeoffs = uniqueStrings((alt as any).tradeoffs).slice(0, 4);
                const reasons = uniqueStrings((alt as any).reasons).slice(0, 2);
                const reason = reasons.length
                  ? reasons[0]
                    .replace(/^pros:\s*/i, '')
                    .replace(/^优势：\s*/i, '')
                    .trim()
                  : null;

                const availability = uniqueStrings(asArray((altProduct as any)?.availability)).find(Boolean) || null;
                const priceObj = asObject((altProduct as any)?.price);
                const priceUnknown = Boolean(priceObj && (priceObj as any).unknown === true);
                const priceUsd = priceObj ? asNumber((priceObj as any).usd) : null;
                const priceCny = priceObj ? asNumber((priceObj as any).cny) : null;
                const priceNumber = !priceObj ? asNumber((altProduct as any)?.price) : null;
                const currencyRaw = asString((altProduct as any)?.currency) || null;
                const currency = currencyRaw ? currencyRaw.toUpperCase() : null;
                const currencySymbol = currency === 'CNY' || currency === 'RMB' ? '¥' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
                const priceText = priceUnknown
                  ? '—'
                  : priceUsd != null
                    ? `$${Math.round(priceUsd * 100) / 100}`
                    : priceCny != null
                      ? `¥${Math.round(priceCny)}`
                      : priceNumber != null
                        ? `${currencySymbol}${Math.round(priceNumber * 100) / 100}`
                        : '—';

                return (
                  <div key={`${kindLabel}_${j}_${altSkuId || altName || 'alt'}`} className="rounded-xl border border-border/60 bg-background/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">{kindLabel}</span>
                          {typeof similarity === 'number' ? (
                            <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">
                              {language === 'CN' ? `相似度 ${Math.round(similarity)}%` : `${Math.round(similarity)}% similar`}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          {altBrand ? `${altBrand} ` : ''}
                          {altName || (language === 'CN' ? '未知产品' : 'Unknown product')}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">{priceText}</span>
                          {availability ? (
                            <span className="whitespace-nowrap rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">
                              {availability}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                      className="chip-button"
                      disabled={isAltResolving}
                      onClick={() =>
                        void openPdpFromCard({
                          anchor_key: altAnchorId,
                          position: idx + 1,
                          brand: altBrand,
                          name: altName,
                          subject_product_group_id: altSubjectProductGroupId,
                          canonical_product_ref: altCanonicalRefTarget,
                          resolve_query: altResolveQuery || null,
                          hints: Object.keys(altResolverHints).length ? altResolverHints : undefined,
                          pdp_open: altPdpOpenHint,
                        })
                      }
                    >
                        {language === 'CN' ? '查看详情' : 'View details'}
                      </button>
                    </div>

                    {reason ? (
                      <div className="mt-2 text-xs text-foreground/90">
                        <span className="font-semibold text-muted-foreground">{language === 'CN' ? '推荐理由：' : 'Why: '}</span>
                        {reason}
                      </div>
                    ) : null}

                    {tradeoffs.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {tradeoffs.slice(0, 4).map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {language === 'CN' ? '差异信息缺失（上游未返回 tradeoffs）。' : 'Tradeoffs missing (upstream did not return details).'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}

        {evidencePack ? (
          <details className="mt-2">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-primary/90">
              <ChevronDown className="h-4 w-4" />
              {language === 'CN' ? '证据与注意事项' : 'Evidence & cautions'}
            </summary>

            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              {comparisonNotes.length ? (
                <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                  <div className="text-[11px] font-semibold text-foreground">
                    {language === 'CN' ? '对比/取舍' : 'Tradeoffs'}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {comparisonNotes.slice(0, 4).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {sensitivityFlags.length ? (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-warning">
                  <div className="text-[11px] font-semibold text-warning">
                    {language === 'CN' ? '敏感风险' : 'Sensitivity risks'}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {sensitivityFlags.slice(0, 4).map((n, idx) => {
                      const label = humanizeKbNote(n, language);
                      if (!label) return null;
                      return <li key={`${n}_${idx}`}>{label}</li>;
                    })}
                  </ul>
                </div>
              ) : null}

              {pairingRules.length ? (
                <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                  <div className="text-[11px] font-semibold text-foreground">
                    {language === 'CN' ? '搭配建议' : 'Pairing notes'}
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {pairingRules.slice(0, 4).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {citations.length ? (
                <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                  <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '引用' : 'Citations'}</div>
                  {!debug ? (
                    <div className="mt-2 space-y-2">
                      {externalCitations.length ? (
                        <div className="space-y-1">
                          {externalCitations.slice(0, 3).map((c) =>
                            isLikelyUrl(c) ? (
                              <a
                                key={c}
                                href={c}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 truncate text-primary underline-offset-4 hover:underline"
                              >
                                <span className="truncate">{c}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <div key={c} className="truncate">
                                {c}
                              </div>
                            ),
                          )}
                        </div>
                      ) : null}

                      {internalCitations.length ? (
                        <div className="text-xs text-muted-foreground">
                          {language === 'CN'
                            ? '证据来源：Aurora 知识库（内部维护的成分/配方信息）。'
                            : 'Evidence source: Aurora knowledge base (internal ingredient/formula info).'}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {citations.slice(0, 3).map((c) => (
                        <div key={c} className="truncate font-mono">
                          {c}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {debug ? (
                <pre className="mt-2 max-h-[260px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
                  {renderJson(evidencePack)}
                </pre>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    );
  };

  const warningLike = new Set([
    'over_budget',
    'price_unknown',
    'availability_unknown',
    'recent_logs_missing',
    'itinerary_unknown',
    'analysis_missing',
    'evidence_missing',
    'upstream_missing_or_unstructured',
    'upstream_missing_or_empty',
    'alternatives_partial',
  ]);

  const rawMissing = uniqueStrings(
    Array.isArray(payload.missing_info) && payload.missing_info.length ? (payload.missing_info as unknown[]) : [],
  );
  const rawWarnings = uniqueStrings((payload as any)?.warnings ?? (payload as any)?.warning ?? (payload as any)?.context_gaps ?? (payload as any)?.contextGaps);
  const internalWarnings = uniqueStrings(
    (payload as any)?.warning_codes_internal ?? (payload as any)?.warningCodesInternal ?? [],
  );
  const userVisibleWarnings = uniqueStrings(
    (payload as any)?.warning_codes_user_visible ?? (payload as any)?.warningCodesUserVisible ?? [],
  );

  const warningCandidates = debug
    ? uniqueStrings([...userVisibleWarnings, ...rawWarnings, ...internalWarnings, ...rawMissing.filter((c) => warningLike.has(String(c)))])
    : uniqueStrings(userVisibleWarnings.length ? userVisibleWarnings : rawWarnings);
  const showWarnings = warningCandidates.slice(0, 6);
  const suppressWhenRecoPresent = new Set([
    'analysis_missing',
    'evidence_missing',
    'upstream_missing_or_unstructured',
    'upstream_missing_or_empty',
  ]);
  const displayWarnings = showWarnings.filter(
    (c) => !(items.length > 0 && suppressWhenRecoPresent.has(String(c || '').trim())),
  );
  const showMissing = debug ? rawMissing.filter((c) => !warningLike.has(String(c))).slice(0, 6) : [];
  const warningLabels = displayWarnings
    .map((code) => {
      const label = labelMissing(code, language);
      if (!label) return null;
      if (!debug && label === code) return null;
      return label;
    })
    .filter(Boolean)
    .join(' · ');
  const recommendationMeta = asObject((payload as any).recommendation_meta);
  const recommendationBasis = (() => {
    if (!recommendationMeta) return null;
    const source = String(asString((recommendationMeta as any).source_mode) || '').trim().toLowerCase();
    const sourceLabel =
      source === 'llm_primary'
        ? language === 'CN'
          ? 'LLM 主推荐'
          : 'LLM primary'
        : source === 'llm_catalog_hybrid'
        ? language === 'CN'
          ? 'LLM + 商品库匹配'
          : 'LLM + catalog match'
        : source === 'catalog_grounded'
        ? language === 'CN'
          ? '商品库锚定推荐'
          : 'catalog grounded'
        : source === 'catalog_transient_fallback'
        ? language === 'CN'
          ? '商品库临时降级'
          : 'catalog fallback'
        : source === 'bridge_error'
        ? language === 'CN'
          ? '桥接降级'
          : 'bridge fallback'
        : source === 'artifact_matcher'
        ? language === 'CN'
          ? '结构化诊断匹配'
          : 'artifact matcher'
        : source === 'upstream_fallback'
          ? language === 'CN'
            ? '上游补全回退'
            : 'upstream fallback'
          : source === 'travel_handoff'
            ? language === 'CN'
              ? '旅行场景接续'
              : 'travel handoff'
          : language === 'CN'
            ? '规则保守路径'
            : 'rules-only';
    const flags: string[] = [];
    if ((recommendationMeta as any).used_recent_logs === true) {
      flags.push(language === 'CN' ? '近期打卡' : 'recent check-ins');
    }
    if ((recommendationMeta as any).used_itinerary === true) {
      flags.push(language === 'CN' ? '行程/环境' : 'itinerary/environment');
    }
    if ((recommendationMeta as any).used_safety_flags === true) {
      flags.push(language === 'CN' ? '安全约束' : 'safety constraints');
    }
    const envSource = String(asString((recommendationMeta as any).env_source) || '').trim().toLowerCase();
    const envLabel =
      envSource === 'weather_api'
        ? language === 'CN'
          ? '实时天气'
          : 'weather API'
        : envSource === 'climate_fallback'
          ? language === 'CN'
            ? '气候常模回退'
            : 'climate fallback'
          : envSource
            ? language === 'CN'
              ? `环境输入(${envSource})`
              : `environment (${envSource})`
            : '';
    const epiRaw = Number((recommendationMeta as any).epi);
    const epi = Number.isFinite(epiRaw) ? Math.round(epiRaw) : null;
    const activeTripId = asString((recommendationMeta as any).active_trip_id);
    const destination =
      asString((recommendationMeta as any).destination) ||
      asString((recommendationMeta as any).destination_name) ||
      asString((recommendationMeta as any).destination_place?.label) ||
      asString((recommendationMeta as any).destination_place?.canonical_name) ||
      null;
    const contextText = flags.length
      ? flags.join(language === 'CN' ? '、' : ', ')
      : language === 'CN'
        ? '基础画像'
        : 'base profile';
    const extras: string[] = [];
    if (envLabel) extras.push(language === 'CN' ? `环境来源：${envLabel}` : `Env: ${envLabel}`);
    if (epi != null) extras.push(`EPI: ${epi}`);
    if (activeTripId) extras.push(language === 'CN' ? `行程ID：${activeTripId}` : `Trip: ${activeTripId}`);
    if (destination) extras.push(language === 'CN' ? `目的地：${destination}` : `Destination: ${destination}`);
    const extrasText = extras.length ? ` · ${extras.join(language === 'CN' ? '；' : ', ')}` : '';
    return language === 'CN'
      ? `推荐依据：${contextText} · 路径：${sourceLabel}${extrasText}`
      : `Why this fits: ${contextText} · Path: ${sourceLabel}${extrasText}`;
  })();

  const renderSection = (slot: 'am' | 'pm' | 'other', list: RecoItem[]) => {
    if (!list.length) return null;
    return (
      <section className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">{sectionTitle(slot)}</div>
        <div className="space-y-2">{list.map(renderStep)}</div>
      </section>
    );
  };

  const normalizeCategory = (raw: string) => {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return 'treatment';
    if (s.includes('cleanser') || s.includes('洁面')) return 'cleanser';
    if (s.includes('spf') || s.includes('sunscreen') || s.includes('防晒')) return 'sunscreen';
    if (s.includes('moistur') || s.includes('cream') || s.includes('lotion') || s.includes('保湿') || s.includes('面霜') || s.includes('乳液'))
      return 'moisturizer';
    if (s.includes('treatment') || s.includes('serum') || s.includes('精华') || s.includes('功效')) return 'treatment';
    return raw;
  };

  const toRoutineSteps = (list: RecoItem[], slot: 'am' | 'pm') =>
    list
      .map((item, idx) => {
        const display = extractRecoDisplayData(item);
        const sku = display.sku;
        const brand = display.brand || '';
        const name = display.name || '';
        const step = asString(item.step) || display.category || '';
        const typeRaw =
          String(asString((item as any).type) || asString((item as any).tier) || asString((item as any).kind) || '').toLowerCase();
        const type = typeRaw.includes('dupe') ? 'dupe' : 'premium';
        const itemRef = asObject((item as any).product_ref) || asObject((item as any).productRef) || null;
        const skuRef = asObject((sku as any)?.product_ref) || asObject((sku as any)?.productRef) || null;
        const itemCanonicalTop = display.canonicalProductRef;
        const skuCanonicalTop =
          asObject((sku as any)?.canonical_product_ref) ||
          asObject((sku as any)?.canonicalProductRef) ||
          null;
        const itemCanonicalRef =
          itemCanonicalTop ||
          asObject((itemRef as any)?.canonical_product_ref) ||
          asObject((itemRef as any)?.canonicalProductRef) ||
          skuCanonicalTop ||
          asObject((skuRef as any)?.canonical_product_ref) ||
          asObject((skuRef as any)?.canonicalProductRef) ||
          null;
        const subjectProductGroupId =
          asString((item as any)?.subject?.product_group_id) ||
          asString((item as any)?.subject?.productGroupId) ||
          asString((sku as any)?.subject?.product_group_id) ||
          asString((sku as any)?.subject?.productGroupId) ||
          asString((item as any)?.product_group_id) ||
          asString((item as any)?.productGroupId) ||
          asString((sku as any)?.product_group_id) ||
          asString((sku as any)?.productGroupId) ||
          null;
        const skuId = asString((sku as any)?.sku_id) || asString((sku as any)?.skuId) || null;
        const canonicalProductId =
          asString((itemCanonicalRef as any)?.product_id) ||
          asString((itemCanonicalRef as any)?.productId) ||
          null;
        const refProductId =
          asString((itemRef as any)?.product_id) ||
          asString((itemRef as any)?.productId) ||
          asString((skuRef as any)?.product_id) ||
          asString((skuRef as any)?.productId) ||
          null;
        const rawProductId = display.rawProductId || asString((sku as any)?.product_id) || asString((sku as any)?.productId) || null;
        const productId = pickPreferredId([canonicalProductId, refProductId, rawProductId], looksLikeOpaqueId);
        const canonicalMerchantId =
          asString((itemCanonicalRef as any)?.merchant_id) ||
          asString((itemCanonicalRef as any)?.merchantId) ||
          null;
        const refMerchantId =
          asString((itemRef as any)?.merchant_id) ||
          asString((itemRef as any)?.merchantId) ||
          asString((skuRef as any)?.merchant_id) ||
          asString((skuRef as any)?.merchantId) ||
          null;
        const rawMerchantId =
          asString((item as any)?.merchant_id) ||
          asString((item as any)?.merchantId) ||
          asString((sku as any)?.merchant_id) ||
          asString((sku as any)?.merchantId) ||
          asString((sku as any)?.merchant?.id) ||
          asString((sku as any)?.merchant?.merchant_id) ||
          asString((sku as any)?.merchant?.merchantId) ||
          null;
        const merchantId = pickPreferredId([canonicalMerchantId, refMerchantId, rawMerchantId], looksLikeOpaqueId);
        const q = [brand, name].map((v) => String(v || '').trim()).filter(Boolean).join(' ').trim();
        const canonicalRefTarget = canonicalProductId
          && !looksLikeOpaqueId(canonicalProductId)
          ? {
              product_id: canonicalProductId,
              ...(canonicalMerchantId ? { merchant_id: canonicalMerchantId } : {}),
            }
          : null;
        const pdpOpen = asObject((item as any).pdp_open) || asObject((item as any).pdpOpen) || null;
        const pdpOpenExternal = asObject((pdpOpen as any)?.external) || null;
        const itemResolveReasonCode =
          asString((item as any)?.metadata?.resolve_reason_code) ||
          asString((item as any)?.metadata?.resolveReasonCode) ||
          asString((item as any)?.metadata?.pdp_open_fail_reason) ||
          asString((item as any)?.metadata?.resolve_fail_reason) ||
          null;
        const pdpOpenHint = pdpOpen
          ? {
              path: asString((pdpOpen as any)?.path) || null,
              resolve_reason_code: asString((pdpOpen as any)?.resolve_reason_code) || itemResolveReasonCode || null,
              external: pdpOpenExternal
                ? {
                    query: asString((pdpOpenExternal as any)?.query) || null,
                    url: asString((pdpOpenExternal as any)?.url) || null,
                  }
                : null,
            }
          : null;
        const isExternalItem =
          String((pdpOpenHint as any)?.path || '').trim().toLowerCase() === 'external' ||
          String((item as any)?.metadata?.pdp_open_path || '').trim().toLowerCase() === 'external';
        const resolveQuery =
          [brand, name]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
            .filter((v) => !looksLikeOpaqueId(v))
            .join(' ')
            .trim() ||
          (!looksLikeOpaqueId(productId) ? String(productId || '').trim() : '') ||
          '';
        const resolverHints: ProductResolverHints = {
          ...(productId ? { product_id: productId } : {}),
          ...(skuId ? { sku_id: skuId } : {}),
          ...(brand ? { brand } : {}),
          ...(name ? { title: name } : {}),
          ...(productId || merchantId
            ? {
                product_ref: {
                  ...(productId ? { product_id: productId } : {}),
                  ...(merchantId ? { merchant_id: merchantId } : {}),
                },
              }
            : {}),
          ...(q ? { aliases: [q, name, brand].filter(Boolean) } : {}),
        };
        const externalAnchorSeed =
          asString((pdpOpenHint as any)?.external?.url) ||
          asString((pdpOpenHint as any)?.external?.query) ||
          null;
        const anchorId =
          subjectProductGroupId ||
          canonicalProductId ||
          productId ||
          skuId ||
          (q ? `q:${q}` : null) ||
          (externalAnchorSeed ? `ext:${externalAnchorSeed.slice(0, 180)}` : null);
        const notes = asArray(item.notes).map((n) => asString(n)).filter(Boolean) as string[];
        const reasons = uniqueStrings((item as any).reasons).slice(0, 3);
        const alternativesRaw = asArray((item as any).alternatives).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
        const evidencePack = asObject((item as any).evidence_pack) || asObject((item as any).evidencePack) || null;
        const comparisonNotes = asArray(evidencePack?.comparisonNotes ?? evidencePack?.comparison_notes)
          .map((v) => asString(v))
          .filter(Boolean) as string[];
        const pairingRules = asArray(evidencePack?.pairingRules ?? evidencePack?.pairing_rules)
          .map((v) => asString(v))
          .filter(Boolean) as string[];
        const detailsTracks = buildStepAlternativesSheetTracks(alternativesRaw, pairingRules, comparisonNotes);
        const anchorProductIdForAlternatives = subjectProductGroupId || canonicalProductId || productId || skuId || null;
        const { productInput: alternativeProductInput, canLoadAlternatives } = getRecommendationAlternativeRequest({
          item,
          brand,
          name,
          isExternalItem,
          anchorId,
          resolveQuery: resolveQuery || null,
          fallbackQuery: q || null,
        });
        const canOpenPdp = Boolean(anchorId);
        const canOpenSecondaryAction = Boolean(onOpenAlternativesSheet) && (detailsTracks.length > 0 || canLoadAlternatives);
        const summary = reasons[0] || notes[0] || null;

        if (!brand && !name) return null;
        return {
          category: normalizeCategory(step || ''),
          product: { brand: brand || (language === 'CN' ? '未知品牌' : 'Unknown'), name: name || (language === 'CN' ? '未知产品' : 'Unknown') },
          type,
          external: isExternalItem,
          disabled: !canOpenPdp && !canOpenSecondaryAction,
          secondaryLabel: canOpenSecondaryAction ? (language === 'CN' ? '查看更多对比' : 'More comparison candidates') : null,
          summary,
          slot,
          position: idx + 1,
          rawItem: item,
          anchor_key: anchorId,
          subject_product_group_id: subjectProductGroupId,
          canonical_product_ref: canonicalRefTarget,
          resolve_query: resolveQuery || null,
          hints: Object.keys(resolverHints).length ? resolverHints : undefined,
          pdp_open: pdpOpenHint,
          anchor_product_id: anchorProductIdForAlternatives,
          product_input: alternativeProductInput,
          details_tracks: detailsTracks,
          can_load_alternatives: canLoadAlternatives,
        };
      })
      .filter(Boolean)
      .slice(0, 12) as RecoRoutineStep[];

  const amSteps = toRoutineSteps(groups.am, 'am');
  const pmSteps = toRoutineSteps(groups.pm, 'pm');
  const compatibilityRoutine = {
    am: amSteps.map((step) => toCompatibilityStepInput(step.rawItem)),
    pm: pmSteps.map((step) => toCompatibilityStepInput(step.rawItem)),
  };
  const compatibilityRequestKey = JSON.stringify(compatibilityRoutine);
  const ingredientRenderMode = deriveIngredientRenderMode(payload);
  const unexpectedEmptyRecommendations = items.length === 0 && ingredientRenderMode === 'show_products';
  const emptyRecommendationsViolationRef = useRef(false);

  useEffect(() => {
    setCompatibilityState(null);
    if (!loadRecommendationCompatibility) return;
    if (compatibilityRoutine.am.length === 0 && compatibilityRoutine.pm.length === 0) return;

    let cancelled = false;
    void loadRecommendationCompatibility(compatibilityRoutine)
      .then((result) => {
        if (cancelled || !result || result.analysisReady !== true) return;
        setCompatibilityState({
          compatibility: 'known',
          conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
          summary: result.summary || null,
        });
      })
      .catch(() => {
        if (!cancelled) setCompatibilityState(null);
      });

    return () => {
      cancelled = true;
    };
  }, [compatibilityRequestKey, loadRecommendationCompatibility]);

  useEffect(() => {
    if (!unexpectedEmptyRecommendations || !analyticsCtx || emptyRecommendationsViolationRef.current) return;
    emptyRecommendationsViolationRef.current = true;
    emitAuroraEmptyRecommendationsContractViolation(analyticsCtx, {
      card_id: asString(card.card_id) || null,
      source_card_type: 'recommendations',
      task_mode:
        asString((payload as any)?.recommendation_meta?.task_mode) ||
        asString((payload as any)?.task_mode) ||
        null,
      products_empty_reason: asString((payload as any)?.products_empty_reason) || null,
    });
  }, [analyticsCtx, card.card_id, payload, unexpectedEmptyRecommendations]);

  useEffect(() => {
    if (unexpectedEmptyRecommendations) return;
    emptyRecommendationsViolationRef.current = false;
  }, [unexpectedEmptyRecommendations]);

  if (ingredientRenderMode === 'empty_match') {
    const emptyActions = asArray((payload as any).empty_match_actions);
    const ingredientQuery = asString(
      (payload as any)?.ingredient_evidence?.query ??
      (payload as any)?.ingredient_context?.query ??
      (payload as any)?.recommendation_meta?.ingredient_query,
    ) || '';
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
        <div className="text-sm font-medium text-foreground">
          {ingredientQuery
            ? (language === 'CN'
              ? `暂未找到确认含有 ${ingredientQuery} 的产品。`
              : `No confirmed products containing ${ingredientQuery} found yet.`)
            : (language === 'CN'
              ? '暂未找到成分匹配的产品。'
              : 'No confirmed ingredient-matched products found yet.')}
        </div>
        <div className="text-xs text-muted-foreground">
          {language === 'CN'
            ? '仅在成分信息可验证时展示产品推荐。'
            : 'Products are only shown when ingredient presence can be verified.'}
        </div>
        {emptyActions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {emptyActions.map((action: unknown) => {
              const a = asObject(action);
              if (!a) return null;
              const actionId = asString((a as any).action_id) || '';
              const actionLabel = asString((a as any).label) || actionId || '';
              return (
                <button
                  key={actionId}
                  type="button"
                  className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
                  onClick={() => {
                    if (!onAction || !actionId) return;
                    onAction(actionId, {
                      action_id: actionId,
                      action_label: actionLabel,
                      trigger_source: 'ingredient_empty_match',
                      source_card_type: 'recommendations',
                      ...(ingredientQuery ? { ingredient_query: ingredientQuery } : {}),
                    });
                  }}
                >
                  {actionLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (unexpectedEmptyRecommendations) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="text-sm font-medium text-foreground">
          {language === 'CN'
            ? '这轮推荐还没有形成可展示的产品清单。'
            : 'This recommendation round did not produce a displayable product shortlist yet.'}
        </div>
        <div className="text-xs text-muted-foreground">
          {language === 'CN'
            ? '请稍后重试，或先补充当前 routine / 肤况信息后再继续。'
            : 'Retry shortly, or add your current routine / skin context before trying again.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ingredientRenderMode === 'pending_match' ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          {language === 'CN' ? '成分匹配验证中…' : 'Verifying ingredient match…'}
        </div>
      ) : null}
      {recommendationBasis ? (
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          {recommendationBasis}
        </div>
      ) : null}

      {(amSteps.length || pmSteps.length) ? (
        <AuroraRoutineCard
          amSteps={amSteps}
          pmSteps={pmSteps}
          compatibility={compatibilityState?.compatibility}
          conflicts={compatibilityState?.conflicts || null}
          compatibilitySummary={compatibilityState?.summary || null}
          language={language}
          onStepClick={(step) => {
            void openRecommendationPdpForStep(step as RecoRoutineStep);
          }}
          onStepSecondaryAction={(step) => {
            void openRecommendationAlternativesForStep(step as RecoRoutineStep);
          }}
        />
      ) : null}

      {(groups.am.length || groups.pm.length || groups.other.length) ? (
        <details
          className="rounded-2xl border border-border/60 bg-background/60 p-3"
          open={detailsOpen}
          onToggle={(e) => setDetailsOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
            <span>
              {language === 'CN' ? '查看证据与完整说明' : 'View evidence & full notes'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </summary>
          <div className="mt-3 space-y-3">
            {renderSection('am', groups.am)}
            {renderSection('pm', groups.pm)}
            {renderSection('other', groups.other)}
          </div>
        </details>
      ) : null}

      {hasMissingAlternatives ? (
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          {language === 'CN'
            ? '提示：部分步骤暂时没有找到“相似/平替/升级选择”（上游未返回）。'
            : 'Note: alternatives are not available for some steps yet (upstream did not return).'}
        </div>
      ) : null}

      {showMissing.length ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          {language === 'CN' ? '信息缺失：' : 'Missing info: '}
          {showMissing
            .slice(0, 6)
            .map((v) => labelMissing(String(v), language))
            .filter(Boolean)
            .join('、')}
        </div>
      ) : null}

      {displayWarnings.length && (debug || warningLabels) ? (
        <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          {language === 'CN' ? '提示：' : 'Note: '}
          {warningLabels || displayWarnings.join(' · ')}
        </div>
      ) : null}
    </div>
  );
}

function BffCardView({
  card,
  language,
  debug,
  meta,
  requestHeaders,
  session,
  onAction,
  resolveOffers,
  resolveProductRef,
  resolveProductsSearch,
  onDeepScanProduct,
  bootstrapInfo,
  profileSnapshot,
  onOpenCheckin,
  onOpenProfile,
  onIngredientQuestionSelect,
  ingredientQuestionBusy,
  onOpenPdp,
  onOpenRecommendationAlternatives,
  loadRecommendationAlternatives,
  loadRecommendationCompatibility,
  analyticsCtx,
  analysisPhotoRefs,
  sessionPhotos,
}: {
  card: Card;
  language: UiLanguage;
  debug: boolean;
  meta?: Pick<V1Envelope, 'request_id' | 'trace_id' | 'events'>;
  requestHeaders: BffHeaders;
  session: Session;
  onAction: (actionId: string, data?: Record<string, any>) => void;
  resolveOffers?: (args: { sku_id?: string | null; product_id?: string | null; merchant_id?: string | null }) => Promise<any>;
  resolveProductRef?: (args: {
    query: string;
    lang: 'en' | 'cn';
    hints?: {
      product_ref?: { product_id?: string | null; merchant_id?: string | null } | null;
      product_id?: string | null;
      sku_id?: string | null;
      aliases?: Array<string | null | undefined>;
      brand?: string | null;
      title?: string | null;
    };
    signal?: AbortSignal;
  }) => Promise<any>;
  resolveProductsSearch?: (args: {
    query: string;
    limit?: number;
    preferBrand?: string | null;
    uiSurface?: string | null;
    clarificationSlot?: string | null;
    clarificationAnswer?: string | null;
    slotState?: ProductSearchSlotState | null;
  }) => Promise<any>;
  onDeepScanProduct?: (inputText: string) => void;
  bootstrapInfo?: BootstrapInfo | null;
  profileSnapshot?: Record<string, unknown> | null;
  onOpenCheckin?: () => void;
  onOpenProfile?: () => void;
  onIngredientQuestionSelect?: (selection: IngredientReportQuestionSelection) => void;
  ingredientQuestionBusy?: boolean;
  onOpenPdp?: (args: { url: string; title?: string }) => void;
  onOpenRecommendationAlternatives?: (tracks: ProductAlternativeTrack[]) => void;
  loadRecommendationAlternatives?: (args: {
    anchorProductId?: string | null;
    productInput?: string | null;
    product?: Record<string, unknown> | null;
  }) => Promise<{ alternatives: Array<Record<string, unknown>>; llmTrace?: Record<string, unknown> | null } | null>;
  loadRecommendationCompatibility?: (routine: {
    am: Array<Record<string, unknown>>;
    pm: Array<Record<string, unknown>>;
  }) => Promise<{ analysisReady: boolean; safe: boolean; summary: string | null; conflicts: string[] } | null>;
  analyticsCtx?: AnalyticsContext;
  analysisPhotoRefs?: AnalysisPhotoRef[];
  sessionPhotos?: Session['photos'];
}) {
  const cardType = String(card.type || '').toLowerCase();

  const payloadObj = asObject(card.payload);
  const payload = payloadObj ?? (card.payload as any);
  const [feedbackBusyByKey, setFeedbackBusyByKey] = useState<Record<string, boolean>>({});
  const [feedbackSavedByKey, setFeedbackSavedByKey] = useState<Record<string, RecoEmployeeFeedbackType>>({});
  const [feedbackErrorByKey, setFeedbackErrorByKey] = useState<Record<string, string>>({});
  const alternativesFilterEventKeysRef = useRef<Set<string>>(new Set());
  const howToLayerEventKeysRef = useRef<Set<string>>(new Set());
  const travelLookupRequestRef = useRef(0);
  const [travelLookupOpen, setTravelLookupOpen] = useState(false);
  const [travelLookupState, setTravelLookupState] = useState<{
    categoryTitle: string;
    query: string;
    ingredientHints: string | null;
    preferBrand: string | null;
    loading: boolean;
    error: string | null;
    results: TravelLookupResultItem[];
    reply: string | null;
    clarification: ProductSearchClarification | null;
    slotState: ProductSearchSlotState;
    lastClarification: ProductSearchClarification | null;
    selectedOption: string | null;
  } | null>(null);

  const submitRecoFeedback = useCallback(
    async ({
      candidate,
      block,
      rankPosition,
      feedbackType,
      wrongBlockTarget,
      anchorProductId,
      pipelineVersion,
      models,
    }: {
      candidate: Record<string, unknown>;
      block: RecoBlockType;
      rankPosition: number;
      feedbackType: RecoEmployeeFeedbackType;
      wrongBlockTarget?: RecoBlockType;
      anchorProductId: string;
      pipelineVersion?: string;
      models?: string | Record<string, unknown>;
    }) => {
      const anchorId = String(anchorProductId || '').trim();
      if (!anchorId) return;
      const candidateId = String((candidate as any)?.product_id || (candidate as any)?.sku_id || '').trim();
      const candidateName = String((candidate as any)?.name || (candidate as any)?.display_name || (candidate as any)?.displayName || '').trim();
      if (!candidateId && !candidateName) return;
      const key = `${block}::${candidateId || candidateName}`.toLowerCase();
      setFeedbackBusyByKey((prev) => ({ ...prev, [key]: true }));
      setFeedbackErrorByKey((prev) => ({ ...prev, [key]: '' }));

      const llmSuggestion = asObject((candidate as any)?.llm_suggestion || (candidate as any)?.llmSuggestion) || null;
      const suggestedLabel = normalizeRecoLabel(llmSuggestion?.suggested_label);
      const suggestionId = asString(llmSuggestion?.id) || '';
      const suggestionConfidence = asNumber(llmSuggestion?.confidence);

      try {
        await sendRecoEmployeeFeedback(requestHeaders, {
          anchor_product_id: anchorId,
          block,
          ...(candidateId ? { candidate_product_id: candidateId } : {}),
          ...(candidateName ? { candidate_name: candidateName } : {}),
          feedback_type: feedbackType,
          ...(feedbackType === 'wrong_block' && wrongBlockTarget ? { wrong_block_target: wrongBlockTarget } : {}),
          rank_position: Math.max(1, rankPosition),
          ...(pipelineVersion ? { pipeline_version: pipelineVersion } : {}),
          ...(models ? { models } : {}),
          ...(suggestionId ? { suggestion_id: suggestionId } : {}),
          ...(suggestedLabel ? { llm_suggested_label: suggestedLabel } : {}),
          ...(typeof suggestionConfidence === 'number' ? { llm_confidence: suggestionConfidence } : {}),
          request_id: requestHeaders.trace_id,
          session_id: requestHeaders.aurora_uid || requestHeaders.brief_id,
          timestamp: Date.now(),
        });
        setFeedbackSavedByKey((prev) => ({ ...prev, [key]: feedbackType }));
        toast({
          title: language === 'CN' ? '反馈已记录' : 'Feedback saved',
          description:
            language === 'CN'
              ? `已标记为：${formatRecoLabel(feedbackType, language)}`
              : `Marked as ${formatRecoLabel(feedbackType, language)}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setFeedbackErrorByKey((prev) => ({ ...prev, [key]: msg }));
      } finally {
        setFeedbackBusyByKey((prev) => ({ ...prev, [key]: false }));
      }
    },
    [language, requestHeaders],
  );

  const structuredCitations = cardType === 'aurora_structured' ? extractExternalVerificationCitations(payload) : [];

  const runTravelLookupSearch = useCallback(
    async ({
      categoryTitle,
      query,
      ingredientHints,
      preferBrand,
      clarificationSlot,
      clarificationAnswer,
      slotState,
      selectedOption,
    }: {
      categoryTitle: string;
      query: string;
      ingredientHints: string | null;
      preferBrand?: string | null;
      clarificationSlot?: string | null;
      clarificationAnswer?: string | null;
      slotState?: ProductSearchSlotState | null;
      selectedOption?: string | null;
    }) => {
      if (!resolveProductsSearch) return;
      const requestId = travelLookupRequestRef.current + 1;
      const normalizedSlotState = normalizeProductSearchSlotState(slotState);
      travelLookupRequestRef.current = requestId;
      setTravelLookupOpen(true);
      setTravelLookupState({
        categoryTitle,
        query,
        ingredientHints,
        preferBrand: preferBrand || null,
        loading: true,
        error: null,
        results: [],
        reply: null,
        clarification: null,
        slotState: normalizedSlotState,
        lastClarification: null,
        selectedOption: selectedOption || null,
      });

      try {
        const resp = await resolveProductsSearch({
          query,
          limit: 8,
          preferBrand: preferBrand || null,
          uiSurface: 'travel_lookup',
          clarificationSlot: clarificationSlot || null,
          clarificationAnswer: clarificationAnswer || null,
          slotState: normalizedSlotState,
        });
        if (travelLookupRequestRef.current !== requestId) return;
        const results = sortTravelLookupProducts(
          extractProductsFromSearchResponse(resp)
            .map((row) => ({
              product: toUiProduct(asObject((row as any).product) || row, language),
              raw: row,
            }))
            .slice(0, 8),
        );
        const reply = extractProductSearchReply(resp);
        const clarification = extractProductSearchClarification(resp);
        const responseSlotState = extractProductSearchSlotState(resp);
        const mergedSlotState = mergeProductSearchSlotState(
          mergeProductSearchSlotState(
            normalizedSlotState,
            clarificationSlot && clarificationAnswer
              ? {
                  asked_slots: [clarificationSlot],
                  resolved_slots: { [clarificationSlot]: clarificationAnswer },
                }
              : null,
          ),
          responseSlotState,
        );
        const finalSlotState = clarification?.slot
          ? mergeProductSearchSlotState(mergedSlotState, {
              asked_slots: [clarification.slot],
              resolved_slots: {},
            })
          : mergedSlotState;
        setTravelLookupState({
          categoryTitle,
          query,
          ingredientHints,
          preferBrand: preferBrand || null,
          loading: false,
          error: null,
          results,
          reply,
          clarification,
          slotState: finalSlotState,
          lastClarification: clarification,
          selectedOption: selectedOption || null,
        });
      } catch (err) {
        if (travelLookupRequestRef.current !== requestId) return;
        const isAbort =
          (err instanceof DOMException && err.name === 'AbortError') ||
          /abort/i.test(err instanceof Error ? err.message : String(err));
        setTravelLookupState({
          categoryTitle,
          query,
          ingredientHints,
          preferBrand: preferBrand || null,
          loading: false,
          error: isAbort
            ? (language === 'CN'
              ? '搜索超时，请重试。'
              : 'Search timed out. Please retry.')
            : (err instanceof Error ? err.message : String(err)),
          results: [],
          reply: null,
          clarification: null,
          slotState: normalizedSlotState,
          lastClarification: null,
          selectedOption: selectedOption || null,
        });
      }
    },
    [language, resolveProductsSearch],
  );

  const handleTravelProductLookup = useCallback(
    async (lookup: TravelProductLookupQuery) => {
      const query = String(lookup.searchQuery || '').trim();
      if (!query) return;
      await runTravelLookupSearch({
        categoryTitle: String(lookup.categoryTitle || '').trim() || (language === 'CN' ? '旅行清单' : 'Travel kit'),
        query,
        ingredientHints: asString(lookup.ingredientHints) || null,
        preferBrand: asString(lookup.preferBrand) || null,
      });
    },
    [language, runTravelLookupSearch],
  );
  const handleTravelLookupClarificationSelect = useCallback(
    async (option: string) => {
      if (!travelLookupState?.lastClarification?.slot) return;
      await runTravelLookupSearch({
        categoryTitle: travelLookupState.categoryTitle,
        query: travelLookupState.query,
        ingredientHints: travelLookupState.ingredientHints,
        preferBrand: travelLookupState.preferBrand,
        clarificationSlot: travelLookupState.lastClarification.slot,
        clarificationAnswer: option,
        slotState: travelLookupState.slotState,
        selectedOption: option,
      });
    },
    [runTravelLookupSearch, travelLookupState],
  );

  const openTravelLookupProduct = useCallback(
    async (entry: TravelLookupResultItem) => {
      const target = buildTravelLookupOpenTarget(entry.raw, entry.product);
      const title = [target.brand, target.name].filter(Boolean).join(' ').trim() || entry.product.name;

      if (target.internalUrl) {
        if (onOpenPdp) {
          onOpenPdp({ url: target.internalUrl, ...(title ? { title } : {}) });
        } else {
          window.location.assign(target.internalUrl);
        }
        return;
      }

      if (!target.preferExternalSearch && resolveProductRef && target.resolveQuery) {
        try {
          const resolved = await resolveProductRef({
            query: target.resolveQuery,
            lang: language === 'CN' ? 'cn' : 'en',
            ...(Object.keys(target.hints).length ? { hints: target.hints } : {}),
          });
          const stableTarget = extractStablePdpTargetFromProductsResolveResponse(resolved);
          if (stableTarget?.product_id) {
            const resolvedUrl = buildPdpUrl({
              product_id: stableTarget.product_id,
              merchant_id: stableTarget.merchant_id ?? null,
            });
            if (onOpenPdp) {
              onOpenPdp({ url: resolvedUrl, ...(title ? { title } : {}) });
            } else {
              window.location.assign(resolvedUrl);
            }
            return;
          }
        } catch {
          // Fall through to external search fallback when lightweight resolve fails.
        }
      }

      const externalUrl = target.externalUrl || buildGoogleSearchFallbackUrl(target.externalQuery || '', language);
      if (!externalUrl) return;

      const popup = window.open(externalUrl, '_blank', 'noopener,noreferrer');
      if (popup) return;

      try {
        window.location.assign(externalUrl);
      } catch {
        toast({
          title: language === 'CN' ? '无法打开外部页面' : 'Unable to open external page',
          description:
            language === 'CN'
              ? '浏览器可能拦截了新标签页弹窗，请允许后重试。'
              : 'Your browser may have blocked the popup. Please allow popups and retry.',
        });
      }
    },
    [language, onOpenPdp, resolveProductRef],
  );

  const travelLookupTitle = language === 'CN' ? '旅行产品查找' : 'Travel product lookup';
  const travelLookupBody = travelLookupState ? (
    <div className="space-y-3 px-4 pb-4">
      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
        <div className="text-sm font-semibold text-foreground">{travelLookupState.categoryTitle}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {travelLookupState.query ? `${language === 'CN' ? '搜索词' : 'Query'} · ${travelLookupState.query}` : null}
        </div>
        {travelLookupState.ingredientHints ? (
          <div className="mt-1 text-[11px] text-muted-foreground">{travelLookupState.ingredientHints}</div>
        ) : null}
      </div>
      {travelLookupState.loading ? (
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
          {language === 'CN' ? '正在查找…' : 'Searching…'}
        </div>
      ) : travelLookupState.error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {travelLookupState.error}
        </div>
      ) : travelLookupState.results.length ? (
        <div className="space-y-2">
          {travelLookupState.results.map((entry, idx) => {
            const { product } = entry;
            const imageUrl = pickProductImageUrl(product);
            const target = buildTravelLookupOpenTarget(entry.raw, product);
            const isOpenable = Boolean(target.internalUrl || target.externalUrl || target.externalQuery || (resolveProductRef && target.resolveQuery));
            const availabilityState = resolveTravelLookupAvailabilityState(product);
            const availabilityLabel =
              availabilityState === 'out_of_stock'
                ? (language === 'CN' ? '缺货' : 'Out of stock')
                : availabilityState === 'unknown'
                  ? (language === 'CN' ? '库存未知' : 'Availability unknown')
                  : null;
            return (
              <div
                key={`${product.sku_id}_${idx}`}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-3"
              >
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-border/50 bg-muted/30">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                      {(product.brand || product.name || 'P').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    {isOpenable ? (
                      <>
                        <button
                          type="button"
                          className="min-w-0 text-left text-sm font-semibold leading-snug text-foreground hover:underline"
                          onClick={() => {
                            void openTravelLookupProduct(entry);
                          }}
                        >
                          <span className="line-clamp-2">{product.name}</span>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                          onClick={() => {
                            void openTravelLookupProduct(entry);
                          }}
                          aria-label={language === 'CN' ? '打开商品' : 'Open product'}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="text-sm font-semibold leading-snug text-foreground">{product.name}</div>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[product.brand, product.category].filter(Boolean).join(' · ')}
                  </div>
                  {availabilityLabel ? (
                    <div className="mt-1">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium',
                          availabilityState === 'out_of_stock'
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : 'border-border/60 bg-muted/30 text-muted-foreground',
                        )}
                      >
                        {availabilityLabel}
                      </span>
                    </div>
                  ) : null}
                  {product.description ? (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.description}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : travelLookupState.clarification || travelLookupState.reply ? (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
          {travelLookupState.clarification?.question ? (
            <div className="font-medium text-foreground">{travelLookupState.clarification.question}</div>
          ) : null}
          {travelLookupState.reply ? <div>{travelLookupState.reply}</div> : null}
          {travelLookupState.clarification?.options?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {travelLookupState.clarification.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={travelLookupState.loading}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] transition',
                    travelLookupState.selectedOption === option
                      ? 'border-foreground/30 bg-foreground/10 text-foreground'
                      : 'border-border/60 bg-muted/20 text-foreground/80 hover:bg-muted/40',
                  )}
                  onClick={() => {
                    void handleTravelLookupClarificationSelect(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
          {language === 'CN' ? '暂无匹配产品。' : 'No matching products found.'}
        </div>
      )}
    </div>
  ) : null;
  const travelLookupPanel = travelLookupState ? (
    <Drawer open={travelLookupOpen} onOpenChange={setTravelLookupOpen}>
      <DrawerContent
        className="max-h-[85dvh] rounded-t-3xl border border-border/60 bg-background/95 sm:left-1/2 sm:right-auto sm:w-[420px] sm:max-w-[92vw] sm:-translate-x-1/2"
        aria-label={travelLookupTitle}
        aria-describedby={undefined}
      >
        <DrawerHeader>
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle>{travelLookupTitle}</DrawerTitle>
            <button
              type="button"
              className="rounded-full border border-border/60 p-2 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              onClick={() => setTravelLookupOpen(false)}
              aria-label={language === 'CN' ? '关闭' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto pb-2">{travelLookupBody}</div>
      </DrawerContent>
    </Drawer>
  ) : null;

  if (!debug && cardType === 'session_bootstrap') return null;

  if (!debug && cardType === 'aurora_structured' && structuredCitations.length === 0) return null;

  if (cardType === 'aurora_ingredient_report') {
    const profileForFit = profileSnapshot ?? bootstrapInfo?.profile ?? null;
    const fitStatus = getIngredientFitProfileStatus(profileForFit);
    const hiddenQuestionIds = [
      ...(fitStatus.hasGoals ? ['goal'] : []),
      ...(fitStatus.hasSensitivity ? ['sensitivity'] : []),
    ];
    return (
      <IngredientReportCard
        payload={payload}
        language={language}
        showNextQuestions={!fitStatus.isComplete}
        hiddenQuestionIds={hiddenQuestionIds}
        nextQuestionBusy={Boolean(ingredientQuestionBusy)}
        onSelectNextQuestion={onIngredientQuestionSelect}
        onOpenProfile={onOpenProfile}
        onPollResearch={(query) =>
          onAction('ingredient.research.poll', {
            action_id: 'ingredient.research.poll',
            ingredient_query: query,
            normalized_query: query,
            entry_source: 'ingredient_report_card',
          })
        }
        onRetryResearch={(query) =>
          onAction('ingredient.lookup', {
            action_id: 'ingredient.lookup',
            ingredient_query: query,
            entry_source: 'ingredient_report_card_retry',
          })
        }
      />
    );
  }

  if (cardType === 'aurora_structured') {
    return (
      <div className="space-y-3">
        <AuroraReferencesCard citations={structuredCitations} language={language} />
        {debug ? (
          <details className="rounded-2xl border border-border/50 bg-background/50 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              <span>{language === 'CN' ? '结构化详情' : 'Structured details'}</span>
              <ChevronDown className="h-4 w-4" />
            </summary>
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
              {renderJson(payloadObj ?? card.payload)}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }

  if (CHAT_CARDS_V1_TYPES.has(cardType)) {
    const adapterHit = adaptChatCardForRichRender({
      cardType,
      payload: asObject(payload) || {},
      language,
    });
    if (adapterHit?.kind === 'compatibility') {
      return (
        <CompatibilityInsightsCard
          routineSimulationPayload={adapterHit.data.routineSimulationPayload}
          conflictHeatmapPayload={adapterHit.data.conflictHeatmapPayload}
          language={language}
          debug={debug}
          meta={meta}
          analyticsCtx={analyticsCtx}
        />
      );
    }

    if (adapterHit?.kind === 'routine') {
      return (
        <AuroraRoutineCard
          amSteps={adapterHit.data.amSteps}
          pmSteps={adapterHit.data.pmSteps}
          conflicts={adapterHit.data.conflicts}
          compatibility={adapterHit.data.compatibility}
          language={language}
        />
      );
    }

    if (adapterHit?.kind === 'travel') {
      return (
        <div className="space-y-3">
          <EnvStressCard
            payload={adapterHit.data.payload}
            language={language}
            onOpenCheckin={onOpenCheckin}
            onOpenRecommendations={() =>
              onAction('chip.start.reco_products', {
                reply_text:
                  language === 'CN'
                    ? '请给我完整护肤产品推荐。'
                    : 'Show full skincare product recommendations.',
                force_route: 'reco_products',
                trigger_source: 'travel_handoff',
                source_card_type: 'travel',
              })
            }
            onRefineRoutine={() =>
              onAction('chip.start.routine', {
                reply_text:
                  language === 'CN'
                    ? '用我的 AM/PM routine 进一步细化建议'
                    : 'Refine recommendations with my AM/PM routine',
              })
            }
            onProductLookup={handleTravelProductLookup}
          />
          {travelLookupPanel}
        </div>
      );
    }

    if (adapterHit?.kind === 'product_verdict') {
      return (
        <ProductAnalysisCard
          result={adapterHit.data.result}
          photoPreview={adapterHit.data.photoPreview}
          language={language}
          onAction={(id, data) => onAction(id, data)}
        />
      );
    }

    if (adapterHit?.kind === 'skin_status') {
      return (
        <SkinIdentityCard
          payload={adapterHit.data.payload}
          onAction={(id, data) => onAction(id, data)}
          language={language}
        />
      );
    }

    if (adapterHit?.kind === 'effect_review') {
      return (
        <AnalysisStoryCard
          payload={adapterHit.data.payload}
          language={language}
          onAction={(id, data) => onAction(id, data)}
        />
      );
    }

    if (adapterHit?.kind === 'triage') {
      const data = adapterHit.data;
      const riskToneClass =
        data.riskLevel === 'high'
          ? 'border-rose-300 bg-rose-50 text-rose-900'
          : data.riskLevel === 'medium'
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-border/60 bg-background/70 text-foreground';
      return (
        <div data-testid="chatcards-triage-adapter" className={`space-y-3 rounded-2xl border p-3 ${riskToneClass}`}>
          <div className="text-sm font-semibold">
            {language === 'CN' ? '应急分诊建议' : 'Triage plan'}
            {data.recoveryWindowHours
              ? (
                <span className="ml-2 text-xs font-medium opacity-80">
                  {language === 'CN'
                    ? `${data.recoveryWindowHours}小时观察窗`
                    : `${data.recoveryWindowHours}h observation window`}
                </span>
              )
              : null}
          </div>
          <div className="text-sm">{data.summary}</div>
          {data.actionPoints.length ? (
            <div>
              <div className="text-xs font-semibold opacity-80">{language === 'CN' ? '执行要点' : 'Action points'}</div>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {data.actionPoints.slice(0, 6).map((line, idx) => (
                  <li key={`triage_action_${idx}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.redFlags.length ? (
            <div>
              <div className="text-xs font-semibold opacity-80">{language === 'CN' ? '红旗信号' : 'Red flags'}</div>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {data.redFlags.slice(0, 4).map((line, idx) => (
                  <li key={`triage_redflag_${idx}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="chip-button chip-button-primary"
              onClick={() => {
                const actionType = data.primaryAction?.type || 'log_symptom';
                const actionLabel = data.primaryAction?.label || (language === 'CN' ? '记录症状' : 'Log symptom');
                const actionPayload = data.primaryAction?.payload || {};
                if (analyticsCtx) {
                  emitCardActionClick(analyticsCtx, {
                    card_type: cardType,
                    card_id: card.card_id || null,
                    action_type: actionType,
                    action_label: actionLabel,
                  });
                  emitTriageActionTap(analyticsCtx, {
                    card_id: card.card_id || null,
                    action_type: actionType,
                    action_label: actionLabel,
                    risk_level: data.riskLevel,
                    recovery_window_hours:
                      typeof data.recoveryWindowHours === 'number' ? data.recoveryWindowHours : null,
                  });
                }
                onAction(actionType, actionPayload);
              }}
            >
              {data.primaryAction?.label || (language === 'CN' ? '记录症状' : 'Log symptom')}
            </button>
            <button
              type="button"
              className="chip-button chip-button-outline"
              onClick={() => {
                const actionType = data.secondaryAction?.type || 'add_to_experiment';
                const actionLabel =
                  data.secondaryAction?.label || (language === 'CN' ? '创建恢复实验' : 'Create recovery experiment');
                const actionPayload = data.secondaryAction?.payload || {};
                if (analyticsCtx) {
                  emitCardActionClick(analyticsCtx, {
                    card_type: cardType,
                    card_id: card.card_id || null,
                    action_type: actionType,
                    action_label: actionLabel,
                  });
                  emitTriageActionTap(analyticsCtx, {
                    card_id: card.card_id || null,
                    action_type: actionType,
                    action_label: actionLabel,
                    risk_level: data.riskLevel,
                    recovery_window_hours:
                      typeof data.recoveryWindowHours === 'number' ? data.recoveryWindowHours : null,
                  });
                }
                onAction(actionType, actionPayload);
              }}
            >
              {data.secondaryAction?.label || (language === 'CN' ? '创建恢复实验' : 'Create recovery experiment')}
            </button>
          </div>
        </div>
      );
    }

    if (adapterHit?.kind === 'nudge') {
      const data = adapterHit.data;
      return (
        <div data-testid="chatcards-nudge-adapter" className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
          <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '可选加分项' : 'Optional nudge'}</div>
          <div className="text-sm text-foreground">{data.message}</div>
          {data.hints.length ? (
            <div>
              <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '为什么有帮助' : 'Why this helps'}</div>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                {data.hints.slice(0, 4).map((line, idx) => (
                  <li key={`nudge_hint_${idx}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {typeof data.cadenceDays === 'number' && data.cadenceDays > 0 ? (
            <div className="text-xs text-muted-foreground">
              {language === 'CN'
                ? `建议 ${data.cadenceDays} 天后复查一次。`
                : `Suggested check-in cadence: every ${data.cadenceDays} days.`}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="chip-button chip-button-primary"
              onClick={() => {
                const actionType = data.primaryAction?.type || 'dismiss';
                const actionLabel = data.primaryAction?.label || (language === 'CN' ? '暂时不需要' : 'Dismiss');
                const actionPayload = data.primaryAction?.payload || {};
                if (analyticsCtx) {
                  emitCardActionClick(analyticsCtx, {
                    card_type: cardType,
                    card_id: card.card_id || null,
                    action_type: actionType,
                    action_label: actionLabel,
                  });
                  emitNudgeActionTap(analyticsCtx, {
                    card_id: card.card_id || null,
                    action_type: actionType,
                    action_label: actionLabel,
                    cadence_days: typeof data.cadenceDays === 'number' ? data.cadenceDays : null,
                    hint_count: data.hints.length,
                  });
                }
                onAction(actionType, actionPayload);
              }}
            >
              {data.primaryAction?.label || (language === 'CN' ? '暂时不需要' : 'Dismiss')}
            </button>
            <button
              type="button"
              className="chip-button chip-button-outline"
              onClick={() => {
                const actionType = data.secondaryAction?.type || 'save_tip';
                const actionLabel = data.secondaryAction?.label || (language === 'CN' ? '加入提醒' : 'Save tip');
                const actionPayload = data.secondaryAction?.payload || {};
                if (analyticsCtx) {
                  emitCardActionClick(analyticsCtx, {
                    card_type: cardType,
                    card_id: card.card_id || null,
                    action_type: actionType,
                    action_label: actionLabel,
                  });
                  emitNudgeActionTap(analyticsCtx, {
                    card_id: card.card_id || null,
                    action_type: actionType,
                    action_label: actionLabel,
                    cadence_days: typeof data.cadenceDays === 'number' ? data.cadenceDays : null,
                    hint_count: data.hints.length,
                  });
                }
                onAction(actionType, actionPayload);
              }}
            >
              {data.secondaryAction?.label || (language === 'CN' ? '加入提醒' : 'Save tip')}
            </button>
          </div>
        </div>
      );
    }

    const cardTitle = asString(card.title) || asString((payload as any)?.title) || titleForCard(cardType, language);
    const subtitle = asString((payload as any)?.subtitle) || undefined;
    const tags = asArray((payload as any)?.tags).map((item) => asString(item)).filter(Boolean) as string[];
    const sections = asArray((payload as any)?.sections).map((item) => asObject(item)).filter(Boolean) as Array<Record<string, unknown>>;
    const actions = asArray((payload as any)?.actions).map((item) => asObject(item)).filter(Boolean) as Array<Record<string, unknown>>;

    return (
      <ChatCardsV1Card
        cardType={cardType}
        cardId={card.card_id}
        title={cardTitle}
        subtitle={subtitle}
        tags={tags}
        sections={sections}
        actions={actions as any}
        language={language}
        onAction={(actionId, data) => {
          if (analyticsCtx) {
            emitCardActionClick(analyticsCtx, {
              card_type: cardType,
              card_id: card.card_id || null,
              action_type: actionId,
              action_label: typeof data?.action_label === 'string' ? data.action_label : null,
            });
          }
          onAction(actionId, data);
        }}
      />
    );
  }

  if (isEnvStressCard(card)) {
    return (
      <div className="space-y-3">
        <EnvStressCard
          payload={payload}
          language={language}
          onOpenCheckin={onOpenCheckin}
          onOpenRecommendations={() =>
            onAction('chip.start.reco_products', {
              reply_text:
                language === 'CN'
                  ? '请给我完整护肤产品推荐。'
                  : 'Show full skincare product recommendations.',
              force_route: 'reco_products',
              trigger_source: 'travel_handoff',
              source_card_type: 'travel',
            })
          }
          onRefineRoutine={() =>
            onAction('chip.start.routine', {
              reply_text:
                language === 'CN'
                  ? '用我的 AM/PM routine 进一步细化建议'
                  : 'Refine recommendations with my AM/PM routine',
            })
          }
          onProductLookup={handleTravelProductLookup}
        />
        {travelLookupPanel}
      </div>
    );
  }

  if (isConflictHeatmapCard(card)) {
    return <ConflictHeatmapCard payload={payload} language={language} debug={debug} />;
  }

  if (cardType === 'photo_modules_v1') {
    if (!FF_PHOTO_MODULES_CARD) return null;

    const safeAnalysisPhotoRefs = Array.isArray(analysisPhotoRefs) ? analysisPhotoRefs : [];
    const safeSessionPhotos = sessionPhotos && typeof sessionPhotos === 'object' ? sessionPhotos : {};
    const payloadWithSessionPhotoFallback = enrichPhotoModulesPayloadWithSessionPreview(
      payload,
      safeAnalysisPhotoRefs,
      safeSessionPhotos,
    );

    const { model, errors, sanitizer_drops } = normalizePhotoModulesUiModelV1(payloadWithSessionPhotoFallback);
    if (!model) {
      if (analyticsCtx) {
        emitAuroraPhotoModulesSchemaFail(analyticsCtx, {
          card_id: card.card_id ?? null,
          error_count: errors.length,
          errors: errors.slice(0, 8),
          sanitizer_drop_count: sanitizer_drops.length,
        });
      }
      if (!debug) return null;
      return (
        <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
          {language === 'CN'
            ? '照片模块卡片暂不可用（数据格式异常），已自动降级。'
            : 'Photo modules card is temporarily unavailable (invalid payload), downgraded safely.'}
        </div>
      );
    }

    if (!model.used_photos || model.quality_grade === 'fail') {
      return (
        <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
          {language === 'CN'
            ? '当前照片条件不足，暂不展示模块叠加卡片。'
            : 'Photo conditions are insufficient for module overlay rendering right now.'}
        </div>
      );
    }

    return (
      <PhotoModulesCard
        model={model}
        language={language}
        analyticsCtx={analyticsCtx}
        cardId={card.card_id}
        sanitizerDrops={sanitizer_drops}
        resolveProductRef={resolveProductRef}
        onOpenPdp={onOpenPdp}
      />
    );
  }

  if (cardType === 'ingredient_hub') {
    return <IngredientHubCard payload={payload as Record<string, unknown>} language={language} onAction={(id, data) => onAction(id, data)} />;
  }

  if (cardType === 'ingredient_goal_match') {
    return <IngredientGoalMatchCard payload={payload as Record<string, unknown>} language={language} onAction={(id, data) => onAction(id, data)} />;
  }

  if (cardType === 'diagnosis_gate') {
    const payloadObj = asObject(payload) || {};
    const sections = asArray((payloadObj as any).sections).map((row) => asObject(row)).filter(Boolean) as Array<Record<string, unknown>>;
    const isDiagnosisV2Gate = sections.some((section) => String(section?.type || '').trim() === 'goal_selection');
    if (isDiagnosisV2Gate) {
      const goalSelection = sections.find((section) => String(section?.type || '').trim() === 'goal_selection');
      return (
        <DiagnosisV2IntroCard
          payload={{
            ...payloadObj,
            goal_profile: asObject((payloadObj as any).goal_profile) || { selected_goals: [], constraints: [] },
            goal_options: Array.isArray((goalSelection as any)?.options) ? ((goalSelection as any).options as Array<Record<string, unknown>>) : [],
            sections,
          } as any}
          language={language}
          onAction={(id, data) => onAction(id, data)}
        />
      );
    }
    return <DiagnosisCard onAction={(id, data) => onAction(id, data)} language={language} />;
  }

  if (cardType === 'diagnosis_v2_photo_prompt') {
    return <DiagnosisV2PhotoPromptCard payload={payload as any} language={language} onAction={(id, data) => onAction(id, data)} />;
  }

  if (cardType === 'analysis_summary') {
    const analysisObj = asObject((payload as any).analysis) || {};
    const featuresRaw = asArray((analysisObj as any).features).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
    const features = featuresRaw
      .map((f) => ({
        observation: asString(f.observation) || '',
        confidence: (asString(f.confidence) || 'somewhat_sure') as 'pretty_sure' | 'somewhat_sure' | 'not_sure',
      }))
      .filter((f) => Boolean(f.observation))
      .slice(0, 8);
    const analysis = {
      features,
      strategy: asString((analysisObj as any).strategy) || '',
      needs_risk_check: (analysisObj as any).needs_risk_check === true,
    };

    const analysisSource = asString((payload as any).analysis_source) || '';
    const photoQc = asArray((payload as any).photo_qc).map((v) => asString(v)).filter(Boolean) as string[];
    const lowConfidence = resolveAnalysisSummaryLowConfidence(payload as Record<string, unknown>, Array.isArray(card.field_missing) ? card.field_missing : []);
    const photosProvided = (payload as any).photos_provided === true;

    return (
      <AnalysisSummaryCard
        payload={{
          analysis: analysis as any,
          session,
          low_confidence: lowConfidence,
          photos_provided: photosProvided,
          photo_qc: photoQc,
          analysis_source: analysisSource,
        }}
        onAction={(id, data) => onAction(id, data)}
        language={language}
      />
    );
  }

  if (cardType === 'analysis_story_v2') {
    return <AnalysisStoryCard payload={payload as Record<string, unknown>} language={language} onAction={(id, data) => onAction(id, data)} />;
  }

  if (cardType === 'routine_product_audit_v1') {
    return <RoutineProductAuditCard payload={payload as Record<string, unknown>} language={language} />;
  }

  if (cardType === 'routine_adjustment_plan_v1') {
    return <RoutineAdjustmentPlanCard payload={payload as Record<string, unknown>} language={language} />;
  }

  if (cardType === 'routine_recommendation_v1') {
    return <RoutineRecommendationCard payload={payload as Record<string, unknown>} language={language} />;
  }

  if (cardType === 'routine_fit_summary') {
    return <RoutineFitSummaryCard payload={payload as Record<string, unknown>} language={language} onAction={(id, data) => onAction(id, data)} />;
  }

  if (cardType === 'routine_prompt') {
    const missingFields = asArray((payload as any).missing_fields).map((item) => asString(item)).filter(Boolean) as string[];
    const whyNow =
      asString((payload as any).why_now) ||
      (language === 'CN'
        ? '补全 AM/PM routine 后，系统会基于你当前产品做冲突规避与个性化排序。'
        : 'Complete AM/PM routine to unlock conflict-aware personalized ranking.');
    const ctaLabel = asString((payload as any).cta_label) || (language === 'CN' ? '补全 AM/PM Routine' : 'Add AM/PM routine');

    return (
      <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
        <div className="text-sm text-foreground">{whyNow}</div>
        {missingFields.length ? <div className="mt-2 text-xs text-muted-foreground">{missingFields.join(' · ')}</div> : null}
        <button
          type="button"
          className="chip-button chip-button-primary mt-3"
          onClick={() =>
            onAction('chip.start.routine', {
              trigger_source: 'routine_prompt',
              source_card_type: 'routine_prompt',
              cta_action: asString((payload as any).cta_action) || 'open_routine_intake',
            })
          }
        >
          {ctaLabel}
        </button>
      </div>
    );
  }

  if (cardType === 'ingredient_plan') {
    const planObj = asObject((payload as any).plan) ?? asObject(payload) ?? {};
    const intensity = asString((planObj as any).intensity) || asString((payload as any).intensity) || 'balanced';
    const targets = asArray((planObj as any).targets ?? (payload as any).targets)
      .map((item) => asObject(item))
      .filter(Boolean) as Array<Record<string, unknown>>;
    const avoid = asArray((planObj as any).avoid ?? (payload as any).avoid)
      .map((item) => asObject(item))
      .filter(Boolean) as Array<Record<string, unknown>>;
    const conflicts = asArray((planObj as any).conflicts ?? (payload as any).conflicts)
      .map((item) => asObject(item))
      .filter(Boolean) as Array<Record<string, unknown>>;

    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
        <div className="text-xs font-semibold text-foreground">
          {language === 'CN' ? `强度：${intensity}` : `Intensity: ${intensity}`}
        </div>
        {targets.length ? (
          <div>
            <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '推荐成分' : 'Target ingredients'}</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
              {targets.slice(0, 6).map((item, idx) => (
                <li key={`target_${idx}`}>
                  {asString((item as any).ingredient_id) || asString((item as any).ingredientId) || 'ingredient'}
                  {Number.isFinite(Number((item as any).priority)) ? ` · P${Math.round(Number((item as any).priority))}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {avoid.length ? (
          <div>
            <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '需规避/谨慎' : 'Avoid / caution'}</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
              {avoid.slice(0, 6).map((item, idx) => (
                <li key={`avoid_${idx}`}>
                  {asString((item as any).ingredient_id) || 'ingredient'}
                  {asString((item as any).severity) ? ` · ${asString((item as any).severity)}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {conflicts.length ? (
          <div>
            <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '冲突说明' : 'Conflicts'}</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
              {conflicts.slice(0, 4).map((item, idx) => (
                <li key={`conflict_${idx}`}>
                  {asString((item as any).description) || asString((item as any).message) || ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (cardType === 'ingredient_plan_v2') {
    return (
      <IngredientPlanCard
        payload={payload as Record<string, unknown>}
        language={language}
        analyticsCtx={analyticsCtx}
        cardId={card.card_id}
        onOpenPdp={onOpenPdp}
      />
    );
  }

  if (cardType === 'gate_notice' || cardType === 'budget_gate') {
    const gatePayload = asObject(payload) ?? {};
    const reason = asString((gatePayload as any).reason);
    const summary =
      cardType === 'budget_gate'
        ? language === 'CN'
          ? '预算补充（可选）'
          : 'Budget details (optional)'
        : language === 'CN'
          ? '分析限制与补充信息'
          : 'Analysis limits and optional details';
    const hint =
      cardType === 'budget_gate'
        ? language === 'CN'
          ? '主结果已给出，补充预算可用于细化推荐。'
          : 'Main answer is already provided. Budget can refine recommendations.'
        : language === 'CN'
          ? '主结果已返回；以下信息仅用于提高精度。'
          : 'Main answer already returned. Details below only improve precision.';
    return (
      <details className="rounded-2xl border border-border/60 bg-background/50 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground">
          <span>{summary}</span>
          <ChevronDown className="h-4 w-4" />
        </summary>
        <div className="mt-2 space-y-2 text-xs text-muted-foreground">
          <div>{hint}</div>
          {reason ? (
            <div className="rounded-xl border border-border/50 bg-muted/40 px-2 py-1">
              {language === 'CN' ? `原因：${reason}` : `Reason: ${reason}`}
            </div>
          ) : null}
        </div>
      </details>
    );
  }

  if (cardType === 'confidence_notice') {
    if (!FF_SHOW_PASSIVE_GATES && isPassiveAdvisoryNoticeCard(card)) return null;
    const notice = asObject(payload) ?? {};
    const messageText = asString((notice as any).message) || (language === 'CN' ? '当前建议以保守策略输出。' : 'Current guidance is conservative.');
    const details = asArray((notice as any).details).map((item) => asString(item)).filter(Boolean) as string[];
    const actions = asArray((notice as any).actions).map((item) => asString(item)).filter(Boolean) as string[];
    const severity = asString((notice as any).severity) || 'warn';
    const toneClass =
      severity === 'block'
        ? 'border-rose-300 bg-rose-50 text-rose-800'
        : 'border-amber-300 bg-amber-50 text-amber-800';
    return (
      <div className={`rounded-2xl border p-3 text-sm ${toneClass}`}>
        <div className="font-medium">{messageText}</div>
        {details.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {details.slice(0, 5).map((line, idx) => (
              <li key={`detail_${idx}`}>{line}</li>
            ))}
          </ul>
        ) : null}
        {actions.length ? (
          <div className="mt-2 text-[11px] opacity-80">
            {(language === 'CN' ? '建议动作：' : 'Suggested actions: ') + actions.slice(0, 4).join(' · ')}
          </div>
        ) : null}
      </div>
    );
  }

  if (cardType === 'profile') {
    const profilePayload = asObject((payload as any)?.profile) ?? asObject(payload) ?? null;
    const diagnosis = toDiagnosisResult(profilePayload);
    return (
      <div className="space-y-3">
        <SkinIdentityCard
          payload={{ diagnosis, avatarUrl: null, photoHint: true }}
          onAction={(id, data) => onAction(id, data)}
          language={language}
        />
      </div>
    );
  }

  const Icon = iconForCard(card.type);
  const title = titleForCard(card.type, language);
  const fieldMissingCount = 0;

  const qcStatus = normalizePhotoQcStatus(asString((payload as any)?.qc_status));
  const qcObj = asObject((payload as any)?.qc);
  const qcAdvice = asObject(qcObj?.advice);
  const qcSummary = asString(qcAdvice?.summary) || null;
  const qcSuggestions = asArray(qcAdvice?.suggestions).map((s) => asString(s)).filter(Boolean) as string[];

  const evidence = asObject((payload as any)?.evidence) || null;
  const science = asObject(evidence?.science) || null;
  const socialEvidence = asObject(evidence?.social_signals || (evidence as any)?.socialSignals) || null;
  const socialBlock = asObject((payload as any)?.social_signals || (payload as any)?.socialSignals) || null;
  const socialSummary = asObject(socialBlock?.overall_summary || (socialBlock as any)?.overallSummary) || null;
  const provenanceTop = asObject((payload as any)?.provenance) || null;
  const socialChannelsUsed = uniqueStrings([
    ...asArray((provenanceTop as any)?.social_channels_used),
    ...asArray((socialBlock as any)?.channels_used || (socialBlock as any)?.channelsUsed),
    ...asArray((socialSummary as any)?.channels_used || (socialSummary as any)?.channelsUsed),
  ])
    .map((channel) => normalizeSocialChannelName(channel))
    .filter(Boolean) as string[];
  const expertNotes = uniqueStrings(evidence?.expert_notes || (evidence as any)?.expertNotes);
  const sourcePriority = (type: string): number => {
    const token = String(type || '').trim().toLowerCase();
    if (token === 'official_page') return 0;
    if (token === 'regulatory') return 1;
    if (token === 'retail_page') return 2;
    if (token === 'inci_decoder') return 3;
    return 9;
  };
  const evidenceSources = asArray((evidence as any)?.sources)
    .map((item) => asObject(item))
    .filter(Boolean)
    .map((source) => ({
      type: asString((source as any)?.type).toLowerCase(),
      url: asString((source as any)?.url),
      label: asString((source as any)?.label),
    }))
    .filter((source) => /^https?:\/\//i.test(source.url))
    .filter((source, idx, arr) => arr.findIndex((x) => x.url === source.url) === idx)
    .sort((a, b) => sourcePriority(a.type) - sourcePriority(b.type))
    .slice(0, 3);

  const evidenceKeyIngredients = uniqueStrings(science?.key_ingredients || (science as any)?.keyIngredients).slice(0, 10);
  const evidenceMechanisms = uniqueStrings(science?.mechanisms).slice(0, 8);
  const evidenceFitNotes = uniqueStrings(science?.fit_notes || (science as any)?.fitNotes).slice(0, 6);
  const evidenceRiskNotes = uniqueStrings(science?.risk_notes || (science as any)?.riskNotes).slice(0, 6);

  const platformScores = asObject(socialEvidence?.platform_scores || (socialEvidence as any)?.platformScores) || null;
  const socialPositive = uniqueStrings([
    ...uniqueStrings(socialEvidence?.typical_positive || (socialEvidence as any)?.typicalPositive),
    ...uniqueStrings(socialSummary?.top_pos_themes || (socialSummary as any)?.topPosThemes),
  ]).slice(0, 6);
  const socialNegative = uniqueStrings([
    ...uniqueStrings(socialEvidence?.typical_negative || (socialEvidence as any)?.typicalNegative),
    ...uniqueStrings(socialSummary?.top_neg_themes || (socialSummary as any)?.topNegThemes),
  ]).slice(0, 6);
  const socialRisks = uniqueStrings([
    ...uniqueStrings(socialEvidence?.risk_for_groups || (socialEvidence as any)?.riskForGroups),
    ...uniqueStrings(socialSummary?.watchouts),
  ]).slice(0, 6);

  const socialOverall = (() => {
    const pos = socialPositive.length;
    const neg = socialNegative.length;
    const risk = socialRisks.length;
    if (!pos && !neg && !risk) {
      if (!socialChannelsUsed.length && !socialBlock && !socialEvidence) return null;
      return {
        headline:
          language === 'CN'
            ? '跨平台讨论较少，当前以有限信号为参考。'
            : 'Cross-platform discussion is limited right now.',
        details:
          socialChannelsUsed.length > 0
            ? language === 'CN'
              ? `已覆盖渠道：${socialChannelsUsed.join('、')}`
              : `Channels covered: ${socialChannelsUsed.join(', ')}`
            : language === 'CN'
              ? '暂未拿到足够的跨平台主题信号。'
              : 'Not enough cross-platform topic signals yet.',
        channels: socialChannelsUsed,
      };
    }

    const tone: 'positive' | 'mixed' | 'caution' =
      pos >= neg + 2 ? 'positive' : neg >= pos + 2 || (neg > 0 && risk >= 2) ? 'caution' : 'mixed';

    const headline =
      language === 'CN'
        ? tone === 'positive'
          ? '整体口碑偏正向（多为保湿、肤感轻薄）'
          : tone === 'caution'
            ? '整体口碑偏谨慎（负向/风险反馈相对更多）'
            : '整体口碑中性偏混合（正负反馈并存）'
        : tone === 'positive'
          ? 'Overall feedback is mostly positive.'
          : tone === 'caution'
            ? 'Overall feedback suggests caution.'
            : 'Overall feedback is mixed.';

    const detailParts = [
      socialPositive.length
        ? language === 'CN'
          ? `常见好评：${socialPositive.slice(0, 3).join('、')}`
          : `Common positives: ${socialPositive.slice(0, 3).join(', ')}`
        : '',
      socialNegative.length
        ? language === 'CN'
          ? `常见担忧：${socialNegative.slice(0, 3).join('、')}`
          : `Common concerns: ${socialNegative.slice(0, 3).join(', ')}`
        : '',
      socialRisks.length
        ? language === 'CN'
          ? `人群注意：${socialRisks.slice(0, 2).join('；')}`
          : `Watchouts: ${socialRisks.slice(0, 2).join('; ')}`
        : '',
    ].filter(Boolean);

    return {
      headline,
      details: detailParts.join(language === 'CN' ? '。' : '. '),
      channels: socialChannelsUsed,
    };
  })();

  return (
    <div className="chat-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/50 bg-muted/60">
            <Icon className="h-5 w-5 text-foreground/80" />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            {card.title ? <div className="text-xs text-muted-foreground">{card.title}</div> : null}
          </div>
        </div>

        {fieldMissingCount ? (
          <div className="rounded-full border border-border/60 bg-muted/70 px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {language === 'CN' ? `缺字段 ${fieldMissingCount}` : `${fieldMissingCount} missing`}
          </div>
        ) : null}
      </div>

      {cardType === 'recommendations' ? (
        <RecommendationsCard
          card={card}
          language={language}
          debug={debug}
          resolveOffers={resolveOffers}
          resolveProductRef={resolveProductRef}
          resolveProductsSearch={resolveProductsSearch}
          onDeepScanProduct={onDeepScanProduct}
          onOpenPdp={onOpenPdp}
          onOpenAlternativesSheet={onOpenRecommendationAlternatives}
          loadAlternativesForItem={loadRecommendationAlternatives}
          loadRecommendationCompatibility={loadRecommendationCompatibility}
          analyticsCtx={analyticsCtx}
        />
      ) : null}

      {cardType === 'routine_simulation' ? (() => {
        const safe = (payload as any)?.safe === true;
        const summary = asString((payload as any)?.summary) || '';
        const conflicts = asArray((payload as any)?.conflicts).map((c) => asObject(c)).filter(Boolean) as Array<Record<string, unknown>>;
        const Icon = safe ? CheckCircle2 : AlertTriangle;
        const tone = safe ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-700 bg-amber-500/10 border-amber-500/20';
        return (
          <div className="space-y-3">
            <div className={`flex items-start gap-3 rounded-2xl border p-3 ${tone}`}>
              <Icon className="h-5 w-5" />
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  {safe
                    ? language === 'CN'
                      ? '看起来兼容 ✅'
                      : 'Looks compatible ✅'
                    : language === 'CN'
                      ? '存在刺激/冲突风险'
                      : 'Irritation/conflict risks detected'}
                </div>
                {summary ? <div className="text-xs text-muted-foreground">{summary}</div> : null}
              </div>
            </div>

            {conflicts.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '冲突点' : 'Conflicts'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {conflicts.slice(0, 6).map((c, idx) => {
                    const rule = asString(c.rule_id) || asString((c as any).ruleId) || '';
                    const msg = asString(c.message) || '';
                    const sev = asString(c.severity) || '';
                    return (
                      <li key={`${rule || 'c'}_${idx}`}>
                        {msg}
                        {debug && (rule || sev) ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {rule ? `(${rule}${sev ? ` · ${sev}` : ''})` : sev ? `(${sev})` : ''}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })() : null}

      {cardType === 'offers_resolved' ? (() => {
        const items = asArray((payload as any)?.items).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
        if (!items.length) return null;

        return (
          <div className="space-y-3">
            {items.slice(0, 8).map((item, idx) => {
              const productRaw = asObject(item.product);
              const offerRaw = asObject(item.offer);
              if (!productRaw) return null;
              const product = toUiProduct(productRaw, language);
              const offer = offerRaw ? toUiOffer(offerRaw) : null;
              const outboundUrl = offer?.purchase_route === 'affiliate_outbound' ? offer.affiliate_url : undefined;

              return (
                <div key={`${product.sku_id}_${idx}`} className="space-y-2">
                  <AuroraAnchorCard product={product} offers={offer ? [offer] : []} language={language} />

                  {outboundUrl ? (
                    <button
                      type="button"
                      className="chip-button chip-button-primary w-full"
                      onClick={() => onAction('affiliate_open', { url: outboundUrl, offer_id: offer?.offer_id })}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {language === 'CN' ? '打开购买链接' : 'Open purchase link'}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })() : null}

      {cardType === 'error' ? (() => {
        const code = asString((payload as any)?.error) || 'UNKNOWN_ERROR';
        const status = asNumber((payload as any)?.status);
        const details = (payload as any)?.details ?? null;
        return (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="font-semibold">
              {code}
              {typeof status === 'number' ? ` (HTTP ${status})` : ''}
            </div>
            {details ? (
              <pre className="mt-2 max-h-[220px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
                {renderJson(details)}
              </pre>
            ) : null}
          </div>
        );
      })() : null}

      {cardType === 'product_parse' ? (() => {
        const productRaw = asObject((payload as any).product);
        const product = productRaw ? toUiProduct(productRaw, language) : null;
        const productOffers = productRaw ? toAnchorOffers(productRaw, language) : [];
        const confidence = asNumber((payload as any).confidence);
        const parseSource = (asString((payload as any).parse_source || (payload as any).parseSource) || '').toLowerCase();
        const parseSourceLabel = (() => {
          if (!parseSource || parseSource === 'none') return '';
          const labels: Record<string, { CN: string; EN: string }> = {
            upstream_structured: { CN: '上游结构化', EN: 'Upstream structured' },
            answer_json: { CN: '回答 JSON', EN: 'Answer JSON' },
            heuristic_url: { CN: 'URL 启发式', EN: 'URL heuristic' },
            catalog_resolve: { CN: 'Catalog resolve', EN: 'Catalog resolve' },
            catalog_search: { CN: 'Catalog search', EN: 'Catalog search' },
          };
          return labels[parseSource]?.[language] || parseSource;
        })();
        const missingCodes = uniqueStrings([
          ...(Array.isArray((payload as any).missing_info) ? (payload as any).missing_info : []),
          ...asArray(card.field_missing)
            .map((item) => asObject(item))
            .filter(Boolean)
            .map((item) => asString((item as any).reason))
            .filter(Boolean),
        ]);
        const reasonLabels = missingCodes
          .slice(0, 3)
          .map((code) => labelMissing(String(code), language))
          .filter(Boolean)
          .join(language === 'CN' ? '、' : ' · ');
        const anchorSoftBlocked = missingCodes.some((code) => {
          const token = String(code || '').trim().toLowerCase();
          return token.startsWith('anchor_soft_blocked_') || token === 'anchor_id_not_used_due_to_low_trust';
        });

        return (
          <div className="space-y-3">
            {product ? (
              <div className="space-y-2">
                <AuroraAnchorCard product={product} offers={productOffers} language={language} hidePriceWhenUnknown />
                {anchorSoftBlocked ? (
                  <div className="px-1 text-[11px] text-muted-foreground">
                    {language === 'CN'
                      ? '提示：已阻止不可靠锚点绑定 ID，分析仍会继续（URL realtime）。'
                      : 'Note: an unreliable anchor was blocked from ID binding; URL realtime analysis continues.'}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-foreground">
                <div>
                  {anchorSoftBlocked
                    ? (
                      language === 'CN'
                        ? '已阻止不可靠锚点，分析已自动切到 URL 实时链路继续。'
                        : 'An unreliable anchor was blocked; analysis automatically continues on the URL realtime path.'
                    )
                    : (
                      language === 'CN'
                        ? '本次未拿到稳定产品锚点，已自动尝试降级恢复并继续后续分析。'
                        : 'No stable product anchor was parsed; fallback recovery was attempted so analysis can continue.'
                    )}
                </div>
                {reasonLabels ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {language === 'CN' ? `原因：${reasonLabels}` : `Reason: ${reasonLabels}`}
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {typeof confidence === 'number' && Number.isFinite(confidence) ? (
                <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {language === 'CN' ? `置信度 ${(confidence * 100).toFixed(0)}%` : `Confidence ${(confidence * 100).toFixed(0)}%`}
                </span>
              ) : null}
              {parseSourceLabel ? (
                <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {language === 'CN' ? `来源 ${parseSourceLabel}` : `Source ${parseSourceLabel}`}
                </span>
              ) : null}
            </div>
          </div>
        );
      })() : null}

      {cardType === 'product_analysis' ? (() => {
        const assessment = asObject((payload as any).assessment);
        const verdictRaw = asString(assessment?.verdict);
        const verdict = verdictRaw ? verdictRaw.trim() : null;
        const rawMissingAll = uniqueStrings(asArray((payload as any).missing_info).map((item) => asString(item)).filter(Boolean));
        const rawReasons = uniqueStrings(assessment?.reasons).slice(0, 10);
        const heroRaw = asObject((assessment as any)?.hero_ingredient || (assessment as any)?.heroIngredient) || null;
        const heroName = asString(heroRaw?.name);
        const heroRole = asString(heroRaw?.role);
        const heroWhy = asString(heroRaw?.why);
        const anchorRaw = asObject((assessment as any)?.anchor_product || (assessment as any)?.anchorProduct);
        const product = anchorRaw ? toUiProduct(anchorRaw, language) : null;
        const anchorOffers = anchorRaw ? toAnchorOffers(anchorRaw, language) : [];
        const hasAnchorProduct = Boolean(
          anchorRaw && (
            asString((anchorRaw as any).product_id) ||
            asString((anchorRaw as any).sku_id) ||
            asString((anchorRaw as any).display_name) ||
            asString((anchorRaw as any).name) ||
            asString((anchorRaw as any).url)
          ),
        );
        const rawMissing = uniqueStrings(
          rawMissingAll.filter((code) => !(hasAnchorProduct && String(code || '').trim().toLowerCase() === 'anchor_product_missing')),
        );
        const visibleMissingLabels = rawMissing
          .map((code) => labelMissing(String(code), language))
          .filter(Boolean)
          .slice(0, 5);
        const howToUse = (assessment as any)?.how_to_use ?? (assessment as any)?.howToUse ?? null;

        // ─── V4 payload fields ────────────────────────────────────────────────
        // Detect V4 by presence of verdict_level field
        const verdictLevel = asString((assessment as any)?.verdict_level) || null;
        const isV4Payload = Boolean(verdictLevel);
        const dataQualityBanner = asString((assessment as any)?.data_quality_banner) || null;
        const v4TopTakeaways = isV4Payload ? uniqueStrings(asArray((assessment as any)?.top_takeaways)).slice(0, 5) : [];
        const v4BestFor = isV4Payload ? uniqueStrings(asArray((assessment as any)?.best_for)).slice(0, 5) : [];
        const v4WatchoutsRaw = isV4Payload ? asArray((assessment as any)?.watchouts) : [];
        const v4Watchouts = v4WatchoutsRaw
          .map((item: unknown) => {
            const o = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : null;
            if (!o) return null;
            const issue = asString(o.issue);
            const status = asString(o.status);
            const whatToDo = asString(o.what_to_do);
            if (!issue) return null;
            return {
              issue,
              status: ['confirmed', 'possible'].includes(status) ? status : 'possible',
              what_to_do: whatToDo,
            };
          })
          .filter(Boolean) as Array<{ issue: string; status: string; what_to_do: string }>;
        const v4HowToUse = isV4Payload
          ? (() => {
              const htu = typeof howToUse === 'object' && howToUse !== null ? (howToUse as Record<string, unknown>) : null;
              if (!htu) return null;
              return {
                when: asString(htu.when) || null,
                frequency: asString(htu.frequency) || null,
                order_in_routine: asString(htu.order_in_routine) || null,
                pairing_rules: uniqueStrings(asArray(htu.pairing_rules)).slice(0, 4),
                stop_signs: uniqueStrings(asArray(htu.stop_signs)).slice(0, 4),
              };
            })()
          : null;
        const evidence = typeof (payload as any).evidence === 'object' && (payload as any).evidence !== null
          ? ((payload as any).evidence as Record<string, unknown>)
          : null;
        const v4KeyIngredientsByFunction = isV4Payload
          ? asArray(evidence?.key_ingredients_by_function)
              .map((item: unknown) => {
                const o = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : null;
                if (!o) return null;
                const fn = asString(o.function);
                const ingredients = uniqueStrings(asArray(o.ingredients)).filter(Boolean).slice(0, 8);
                const confidence = asString(o.confidence);
                if (!fn || !ingredients.length) return null;
                return { function: fn, ingredients, confidence };
              })
              .filter(Boolean) as Array<{ function: string; ingredients: string[]; confidence: string }>
          : [];
        const v4ProductTypeReasoning = isV4Payload ? asString(evidence?.product_type_reasoning) || null : null;
        const inciStatus = (payload as any).inci_status && typeof (payload as any).inci_status === 'object'
          ? ((payload as any).inci_status as Record<string, unknown>)
          : null;
        const inciConsensusTier = asString(inciStatus?.consensus_tier) || null;

        // Verdict-level color coding (V4)
        const verdictLevelStyle = (() => {
          if (!verdictLevel) return null;
          const vl = verdictLevel.toLowerCase();
          if (vl === 'recommended') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
          if (vl === 'cautiously_ok') return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
          if (vl === 'needs_verification') return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
          if (vl === 'not_recommended') return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
          return null;
        })();
        const verdictLevelLabel = (() => {
          if (!verdictLevel) return null;
          const vl = verdictLevel.toLowerCase();
          if (language === 'CN') {
            if (vl === 'recommended') return '推荐';
            if (vl === 'cautiously_ok') return '谨慎适合';
            if (vl === 'needs_verification') return '待验证';
            if (vl === 'not_recommended') return '不推荐';
          } else {
            if (vl === 'recommended') return 'Recommended';
            if (vl === 'cautiously_ok') return 'Cautiously OK';
            if (vl === 'needs_verification') return 'Needs Verification';
            if (vl === 'not_recommended') return 'Not Recommended';
          }
          return null;
        })();
        const watchoutStatusIcon = (status: string) => {
          if (status === 'confirmed') return '⚠️';
          if (status === 'possible') return '❓';
          return '○';
        };
        // ─────────────────────────────────────────────────────────────────────
        const profilePromptRaw = asObject((payload as any).profile_prompt || (payload as any).profilePrompt) || null;
        const competitorsObj = asObject((payload as any).competitors) || null;
        const relatedProductsObj = asObject((payload as any).related_products || (payload as any).relatedProducts) || null;
        const dupesObj = asObject((payload as any).dupes) || null;
        const rawCompetitorCandidates = asArray((competitorsObj as any)?.candidates)
          .map((v) => asObject(v))
          .filter(Boolean) as Array<Record<string, unknown>>;
        const rawRelatedCandidates = asArray((relatedProductsObj as any)?.candidates)
          .map((v) => asObject(v))
          .filter(Boolean) as Array<Record<string, unknown>>;
        const rawDupeCandidates = asArray((dupesObj as any)?.candidates)
          .map((v) => asObject(v))
          .filter(Boolean) as Array<Record<string, unknown>>;
        const competitorCandidates = rawCompetitorCandidates
          .filter((candidate) => !isLikelyNonSkincareAlternativeCandidate(candidate));
        const relatedCandidates = rawRelatedCandidates
          .filter((candidate) => !isLikelyNonSkincareAlternativeCandidate(candidate));
        const dupeCandidates = rawDupeCandidates
          .filter((candidate) => !isLikelyNonSkincareAlternativeCandidate(candidate));
        const alternativeFilteredStats = {
          competitors: Math.max(0, rawCompetitorCandidates.length - competitorCandidates.length),
          related_products: Math.max(0, rawRelatedCandidates.length - relatedCandidates.length),
          dupes: Math.max(0, rawDupeCandidates.length - dupeCandidates.length),
        };
        const originalForCompare = anchorRaw || asObject((payload as any).product) || null;
        const provenance = asObject((payload as any).provenance) || null;
        const dogfoodFeatures = asObject((provenance as any)?.dogfood_features_effective || (provenance as any)?.dogfoodFeaturesEffective) || null;
        const showEmployeeFeedbackControls = dogfoodFeatures?.show_employee_feedback_controls === true;
        const canShowEmployeeFeedbackControls = Boolean(showEmployeeFeedbackControls && debug);
        const pipelineVersion = asString((provenance as any)?.pipeline) || 'reco_blocks_dag.v1';
        const feedbackModels = asString((provenance as any)?.source) || 'aurora_bff';
        const anchorProductIdForFeedback = (() => {
          const pid = asString((anchorRaw as any)?.product_id) || asString((anchorRaw as any)?.productId);
          if (pid && pid.trim()) return pid.trim();
          const sku = asString((anchorRaw as any)?.sku_id) || asString((anchorRaw as any)?.skuId);
          if (sku && sku.trim()) return sku.trim();
          const name = asString((anchorRaw as any)?.name);
          if (name && name.trim()) return name.trim();
          return '';
        })();

        const assessmentSummary = (asString((assessment as any)?.summary || (assessment as any)?.quick_summary || (assessment as any)?.quickSummary) || '').trim();
        const assessmentFormulaIntent = uniqueStrings([
          ...uniqueStrings((assessment as any)?.formula_intent),
          ...uniqueStrings((assessment as any)?.formulaIntent),
        ]).slice(0, 6);
        const assessmentBestFor = uniqueStrings([
          ...uniqueStrings((assessment as any)?.best_for),
          ...uniqueStrings((assessment as any)?.bestFor),
        ]).slice(0, 6);
        const assessmentNotFor = uniqueStrings([
          ...uniqueStrings((assessment as any)?.not_for),
          ...uniqueStrings((assessment as any)?.notFor),
        ]).slice(0, 6);
        const assessmentIfNotIdeal = uniqueStrings([
          ...uniqueStrings((assessment as any)?.if_not_ideal),
          ...uniqueStrings((assessment as any)?.ifNotIdeal),
        ]).slice(0, 6);
        const assessmentBetterPairing = uniqueStrings([
          ...uniqueStrings((assessment as any)?.better_pairing),
          ...uniqueStrings((assessment as any)?.betterPairing),
        ]).slice(0, 6);
        const assessmentFollowUpQuestion = (asString((assessment as any)?.follow_up_question || (assessment as any)?.followUpQuestion) || '').trim();

        const formulaIntentFromReasons: string[] = [];
        const bestForFromReasons: string[] = [];
        const usageHintsFromReasons: string[] = [];
        const cautionFromReasons: string[] = [];
        const dataNotesFromReasons: string[] = [];
        const detectedIngredientsFromReasons: string[] = [];
        const normalizeIngredientName = (token: string) => String(token || '').replace(/[.;:，。；：]+$/g, '').replace(/\s+/g, ' ').trim();
        const isDataQualityLine = (line: string) =>
          /\b(official[-\s]?page|incidecoder|inci extraction|extraction was blocked|ingredient-source consistency|cross-check with package inci|supplement used|source used|version verification)\b/i
            .test(String(line || '').trim());

        rawReasons.forEach((entry) => {
          const line = String(entry || '').trim();
          if (!line) return;
          const lower = line.toLowerCase();

          if (/^i extracted the inci list/i.test(line)) {
            dataNotesFromReasons.push(
              line
                .replace(/^i extracted/i, 'INCI list extracted')
                .replace(/\s+for this assessment\.?$/i, '.')
                .trim(),
            );
            return;
          }

          if (/^detected key ingredients:/i.test(line)) {
            const parsed = line
              .replace(/^detected key ingredients:\s*/i, '')
              .split(',')
              .map((token) => normalizeIngredientName(token))
              .filter(Boolean);
            detectedIngredientsFromReasons.push(...parsed);
            return;
          }

          if (/^how to use:/i.test(line)) {
            usageHintsFromReasons.push(line.replace(/^how to use:\s*/i, '').trim());
            return;
          }

          if (/contains exfoliating acids/i.test(lower)) {
            cautionFromReasons.push(
              language === 'CN'
                ? '可能含去角质酸，频率和叠加活性时建议更保守。'
                : 'Possible exfoliation signal: keep frequency and active layering conservative.',
            );
            return;
          }

          if (/^profile priorities:/i.test(lower)) {
            // Ignore profile recap lines in fit section; use dedicated assessment/evidence fields instead.
            return;
          }

          if (/^your profile:/i.test(lower) || /^你的情况[:：]/i.test(line)) {
            return;
          }

          if (/^fit:/i.test(lower) || /^匹配点[:：]/i.test(line)) {
            bestForFromReasons.push(line.replace(/^fit:\s*/i, '').replace(/^匹配点[:：]\s*/i, '').trim());
            return;
          }

          if (/risk|watchout|caution|irrit|敏感|刺激|刺痛|泛红/i.test(lower)) {
            cautionFromReasons.push(line);
            return;
          }

          formulaIntentFromReasons.push(line);
        });

        const verdictStyle = (() => {
          const v = String(verdict || '').toLowerCase();
          if (v.includes('mismatch') || v.includes('not') || v.includes('avoid') || v.includes('veto')) return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
          if (v.includes('risky') || v.includes('caution') || v.includes('warn')) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
          if (v.includes('suitable') || v.includes('good') || v.includes('yes')) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
          return 'bg-muted/60 text-muted-foreground border-border/60';
        })();
        const isLikelyInvalidIngredientToken = (raw: string) => {
          const token = String(raw || '').trim();
          if (!token) return true;
          if (token.length < 2 || token.length > 90) return true;
          if (/^(key ingredients?|ingredients?|active ingredients?)$/i.test(token)) return true;
          if (/as we wrote in our lengthy retinol description/i.test(token)) return true;
          if (/read more|learn more|discover|shop now|add to cart|selected because|strong category\/use-case/i.test(token)) return true;
          if (/\b(how to use|faq|privacy policy|terms of use|copyright)\b/i.test(token)) return true;
          if (/[?!]/.test(token)) return true;
          return false;
        };
        const allDetectedIngredients = uniqueStrings([
          ...detectedIngredientsFromReasons,
          ...evidenceKeyIngredients,
          ...(heroName ? [heroName] : []),
        ]
          .map((name) => normalizeIngredientName(name))
          .filter((name) => !isLikelyInvalidIngredientToken(name))).slice(0, 12);
        const ingredientGroupDefs: Array<{
          key: string;
          title: string;
          colorClass: string;
          patterns: RegExp[];
        }> = [
          {
            key: 'barrier',
            title: language === 'CN' ? 'Barrier support' : 'Barrier support',
            colorClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
            patterns: [/\b(ceramide|cholesterol|fatty acid|panthenol|beta[-\s]?glucan|allantoin|squalane|glycerin|hyaluron)\b/i],
          },
          {
            key: 'acne',
            title: language === 'CN' ? 'Acne control' : 'Acne control',
            colorClass: 'border-sky-200 bg-sky-50 text-sky-800',
            patterns: [/\b(salicylic|bha|benzoyl|niacinamide|azelaic|adapalene|tretinoin|retinol|retinal|zinc)\b/i],
          },
          {
            key: 'brightening',
            title: language === 'CN' ? 'Brightening' : 'Brightening',
            colorClass: 'border-violet-200 bg-violet-50 text-violet-800',
            patterns: [/\b(ascorb|vitamin c|tranexamic|arbutin|kojic|licorice|niacinamide)\b/i],
          },
          {
            key: 'soothing',
            title: language === 'CN' ? 'Soothing' : 'Soothing',
            colorClass: 'border-teal-200 bg-teal-50 text-teal-800',
            patterns: [/\b(cica|centella|madecassoside|bisabolol|oat|aloe|allantoin|panthenol)\b/i],
          },
          {
            key: 'irritant',
            title: language === 'CN' ? 'Potential irritants' : 'Potential irritants',
            colorClass: 'border-rose-200 bg-rose-50 text-rose-800',
            patterns: [/\b(fragrance|parfum|linalool|limonene|citral|retino|aha|bha|glycolic|lactic|mandelic|oxybenzone|octocrylene)\b/i],
          },
        ];
        const ingredientGroups = (() => {
          const buckets = ingredientGroupDefs.map((group) => ({ ...group, items: [] as string[] }));
          const seen = new Set<string>();
          allDetectedIngredients.forEach((ingredient) => {
            const token = String(ingredient || '').trim();
            if (!token) return;
            const key = token.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            const matched = buckets.filter((group) => group.patterns.some((re) => re.test(token)));
            if (matched.length) {
              matched.forEach((group) => {
                if (!group.items.includes(token)) group.items.push(token);
              });
              return;
            }
            buckets[0]?.items.push(token);
          });
          return buckets.filter((group) => group.items.length > 0).map((group) => ({
            key: group.key,
            title: group.title,
            colorClass: group.colorClass,
            items: group.items.slice(0, 8),
          }));
        })();

        const normalizeLineToken = (line: string) =>
          String(line || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
        const lineSimilarity = (left: string, right: string) => {
          const l = normalizeLineToken(left);
          const r = normalizeLineToken(right);
          if (!l || !r) return 0;
          if (l === r) return 1;
          if (l.includes(r) || r.includes(l)) return 0.85;
          const leftTokens = new Set(l.split(' ').filter(Boolean));
          const rightTokens = new Set(r.split(' ').filter(Boolean));
          if (!leftTokens.size || !rightTokens.size) return 0;
          let overlap = 0;
          leftTokens.forEach((token) => {
            if (rightTokens.has(token)) overlap += 1;
          });
          const denom = Math.max(leftTokens.size, rightTokens.size);
          return denom > 0 ? overlap / denom : 0;
        };
        const filterNearDuplicateLines = (rows: string[], refs: string[], threshold = 0.7) =>
          rows.filter((line) => !refs.some((ref) => lineSimilarity(line, ref) >= threshold));
        const isProfileEchoLine = (line: string) =>
          /^(your profile|profile priorities|你的情况|你的画像|匹配点|fit signal)[:：]/i.test(String(line || '').trim());
        const isProfileTupleLine = (line: string) => {
          const text = String(line || '').trim();
          if (!text) return false;
          const lower = text.toLowerCase();
          const profileTokenCount = [
            /\b(oily|dry|combo|combination|normal)\b/.test(lower),
            /\b(sensitivity|sensitive|low|medium|high)\b/.test(lower),
            /\b(barrier|healthy|impaired)\b/.test(lower),
            /肤质|敏感|屏障|油皮|干皮|混合皮|低敏|中敏|高敏/.test(text),
            /skintype=|sensitivity=|barrier=/.test(lower),
          ].filter(Boolean).length;
          const productSignal = /\b(ingredient|formula|efficacy|mechanis|retino|acid|niacinamide|ceramide|peptide|spf|sunscreen|cleanser|moisturizer|serum|防晒|保湿|修护|控痘|去角质)\b/i
            .test(text);
          return !productSignal && profileTokenCount >= 2 && text.length <= 120;
        };
        const shouldDropProfileLine = (line: string) => isProfileEchoLine(line) || isProfileTupleLine(line);

        const formulaIntentCandidates = uniqueStrings([
          ...assessmentFormulaIntent,
          ...formulaIntentFromReasons,
          ...evidenceMechanisms,
        ])
          .filter((line) => !shouldDropProfileLine(line) && !isDataQualityLine(line))
          .slice(0, 6);
        const bestForSignalsRaw = uniqueStrings([
          ...assessmentBestFor,
          ...bestForFromReasons,
          ...evidenceFitNotes,
          ...socialPositive,
        ])
          .filter((line) => !shouldDropProfileLine(line))
          .slice(0, 6);
        const cautionSignalsRaw = uniqueStrings([
          ...assessmentNotFor,
          ...cautionFromReasons,
          ...evidenceRiskNotes,
          ...socialNegative,
          ...socialRisks,
        ]).slice(0, 6);

        const formulaIntent = filterNearDuplicateLines(formulaIntentCandidates, bestForSignalsRaw, 0.72).slice(0, 3);
        const bestForSignals = filterNearDuplicateLines(bestForSignalsRaw, formulaIntent, 0.72).slice(0, 3);
        const cautionSignals = uniqueStrings(cautionSignalsRaw).slice(0, 4);
        const ifNotIdealSignals = uniqueStrings([
          ...assessmentIfNotIdeal,
          ...(cautionSignals.length
            ? [language === 'CN'
              ? '如果出现持续刺痛/泛红，请暂停该产品并回到温和修护基线。'
              : 'If persistent stinging/redness occurs, pause this product and return to a gentle repair baseline.']
            : []),
        ]).slice(0, 3);
        const betterPairingSignals = uniqueStrings([
          ...assessmentBetterPairing,
          ...(cautionSignals.some((line) => /\b(dry|drying|tight|dehydrat|干燥|紧绷)\b/i.test(String(line || '')))
            ? [language === 'CN'
              ? '建议叠加屏障保湿层（如神经酰胺/泛醇）来降低拔干概率。'
              : 'Pair with a barrier-hydration layer (for example ceramide/panthenol) to reduce dryness risk.']
            : []),
          ...(bestForSignals.some((line) => /\b(acne|pores?|痘|毛孔)\b/i.test(String(line || '')))
            ? [language === 'CN'
              ? '如果重点是控痘，优先低刺激控油路线，避免同晚叠加强活性。'
              : 'If acne control is the priority, prefer low-irritation oil-control pairing and avoid same-night strong active stacking.']
            : []),
        ]).slice(0, 3);
        const profilePromptNeeded = profilePromptRaw?.needed === true || rawMissing.includes('profile_not_provided');
        const followUpQuestion = assessmentFollowUpQuestion || (
          profilePromptNeeded
            ? (language === 'CN'
              ? '你当前更在意控痘、提亮还是屏障修护？我可以据此把下一步方案收敛到 2-3 个选项。'
              : 'Which matters most right now: acne control, brightening, or barrier repair? I can narrow next steps to 2-3 options.')
            : (language === 'CN'
              ? '你更倾向更温和还是更快见效？我可以按这个偏好细化后续方案。'
              : 'Do you prefer gentler progression or faster visible results? I can tailor the next-step plan accordingly.')
        );

        const keyTakeawayLines = uniqueStrings([
          assessmentSummary,
          verdict ? (language === 'CN' ? `结论：${verdict}` : `Verdict: ${verdict}`) : '',
          bestForSignals[0] || '',
          cautionSignals[0] ? (language === 'CN' ? `主要注意：${cautionSignals[0]}` : `Main watchout: ${cautionSignals[0]}`) : '',
        ]).slice(0, 3);
        const followupAnchorPayload = {
          ...(asString((anchorRaw as any)?.product_id) ? { product_id: asString((anchorRaw as any)?.product_id) } : {}),
          ...(asString((anchorRaw as any)?.sku_id) ? { sku_id: asString((anchorRaw as any)?.sku_id) } : {}),
          ...(asString((anchorRaw as any)?.brand) ? { brand: asString((anchorRaw as any)?.brand) } : {}),
          ...(asString((anchorRaw as any)?.name) ? { name: asString((anchorRaw as any)?.name) } : {}),
          ...(asString((anchorRaw as any)?.display_name) ? { display_name: asString((anchorRaw as any)?.display_name) } : {}),
          ...(asString((anchorRaw as any)?.url) ? { url: asString((anchorRaw as any)?.url) } : {}),
        };
        const profilePromptFields = uniqueStrings(
          (profilePromptRaw as any)?.missing_fields || (profilePromptRaw as any)?.missingFields || [],
        );
        const profileFieldLabel = (field: string) => {
          const token = String(field || '').trim();
          if (token === 'skinType') return language === 'CN' ? '肤质' : 'Skin type';
          if (token === 'sensitivity') return language === 'CN' ? '敏感度' : 'Sensitivity';
          if (token === 'barrierStatus') return language === 'CN' ? '屏障状态' : 'Barrier status';
          if (token === 'goals') return language === 'CN' ? '目标' : 'Goals';
          return '';
        };
        const profilePromptFieldText = uniqueStrings(profilePromptFields.map((field) => profileFieldLabel(field))).slice(0, 4);

        const howToUseBullets = (() => {
          const out: string[] = [];
          if (typeof howToUse === 'string') {
            const text = howToUse.trim();
            if (text) out.push(text);
          } else {
            const o = asObject(howToUse);
            if (o) {
              const timing = asString((o as any).timing) || asString((o as any).time) || null;
              const frequency = asString((o as any).frequency) || null;
              const steps = uniqueStrings((o as any).steps).slice(0, 4);
              const notes = uniqueStrings((o as any).notes).slice(0, 4);
              if (timing) out.push(language === 'CN' ? `建议时段：${timing}` : `Timing: ${timing}`);
              if (frequency) out.push(language === 'CN' ? `建议频率：${frequency}` : `Suggested frequency: ${frequency}`);
              out.push(...steps);
              out.push(...notes);
            }
          }
          out.push(...usageHintsFromReasons);

          const hasExfoliationSignal = uniqueStrings([
            ...allDetectedIngredients,
            ...cautionSignals,
            ...out,
          ]).some((line) => /\b(acid|aha|bha|pha|exfoliat|去角质|酸类)\b/i.test(String(line || '')));

          if (hasExfoliationSignal) {
            out.push(
              language === 'CN'
                ? '叠加提醒：若与其他强活性同用，建议降低频率并观察耐受。'
                : 'Layering caution: if paired with other strong actives, reduce frequency and monitor tolerance.',
            );
          }

          const hasDryingSignal = uniqueStrings([...cautionSignals, ...rawReasons, ...out]).some((line) =>
            /\b(drying|dryness|tight|peel|flake|dehydrat|干燥|起皮|紧绷)\b/i.test(String(line || '')),
          );
          out.push(
            hasDryingSignal
              ? (language === 'CN'
                ? '观察周期：先连续观察 10–14 天，若持续干燥/刺痛，降低频率或更换更温和替代。'
                : 'Observation window: monitor for 10-14 days; reduce frequency or switch if dryness/stinging persists.')
              : (language === 'CN'
                ? '观察周期：先连续观察 7–10 天，再决定是否提高频率。'
                : 'Observation window: monitor for 7-10 days before increasing frequency.'),
          );

          return uniqueStrings(out).slice(0, 5);
        })();

        const dataNotes = uniqueStrings([
          ...dataNotesFromReasons,
          ...expertNotes.filter((note) => /(evidence source|ingredient list|inci|entries|product page|parsed)/i.test(String(note || ''))),
        ]).slice(0, 3);

        const routineCompatibilityProducts = extractRoutineProductsFromProfileCurrentRoutine((bootstrapInfo?.profile as any)?.currentRoutine);
        const compatibilityBaseProduct: CompatibilityProductInput = {
          id:
            asString((anchorRaw as any)?.product_id) ||
            asString((anchorRaw as any)?.sku_id) ||
            asString((anchorRaw as any)?.name) ||
            asString((assessment as any)?.product_id) ||
            'product_analysis_base',
          name:
            asString((anchorRaw as any)?.name) ||
            asString((assessment as any)?.product_name) ||
            asString((assessment as any)?.productName) ||
            (language === 'CN' ? '当前产品' : 'Current product'),
          brand: asString((anchorRaw as any)?.brand) || undefined,
          ingredientTokens: uniqueStrings([
            ...allDetectedIngredients,
            ...evidenceKeyIngredients,
            ...(heroName ? [heroName] : []),
            ...cautionSignals.filter((line) => /\b(acid|aha|bha|pha|retino|benzoyl|ascorb|peptide|fragrance|parfum|去角质|维a|维A|香精)\b/i.test(String(line || ''))),
            ...howToUseBullets.filter((line) => /\b(acid|aha|bha|pha|retino|benzoyl|ascorb|peptide|fragrance|parfum|去角质|维a|维A|香精)\b/i.test(String(line || ''))),
          ]).slice(0, 24),
          irritationSignal: uniqueStrings([...cautionSignals, ...rawReasons, ...howToUseBullets]).some((line) =>
            /\b(sting|stinging|redness|irritat|burn|drying|sensitive|刺痛|泛红|刺激|干燥|敏感)\b/i.test(String(line || '')),
          ),
          source: 'base',
        };
        const normalizeRecommendationIntent = (candidate: Record<string, unknown>, block: RecoBlockType): 'replace' | 'pair' => {
          const raw = (asString((candidate as any).recommendation_intent || (candidate as any).recommendationIntent) || '').toLowerCase();
          if (raw === 'replace' || raw === 'pair') return raw;
          return block === 'related_products' ? 'pair' : 'replace';
        };
        const flattenAlternatives = (
          candidates: Array<Record<string, unknown>>,
          block: RecoBlockType,
        ) => candidates.map((candidate, idx) => ({
          candidate,
          block,
          rank: idx + 1,
          intent: normalizeRecommendationIntent(candidate, block),
        }));
        const flattenedAlternatives = [
          ...flattenAlternatives(competitorCandidates, 'competitors'),
          ...flattenAlternatives(dupeCandidates, 'dupes'),
          ...flattenAlternatives(relatedCandidates, 'related_products'),
        ];
        const replaceAlternatives = flattenedAlternatives.filter((row) => row.intent === 'replace');
        const pairingAlternatives = flattenedAlternatives.filter((row) => row.intent === 'pair');
        const alternativeTracks: ProductAlternativeTrack[] = [
          {
            key: 'replace',
            title: language === 'CN' ? 'Replace options' : 'Replace options',
            subtitle: language === 'CN' ? '用于替换当前产品' : 'Direct alternatives to replace current product',
            items: replaceAlternatives,
            filteredCount: alternativeFilteredStats.competitors + alternativeFilteredStats.dupes,
          },
          {
            key: 'pair',
            title: language === 'CN' ? 'Pairing ideas' : 'Pairing ideas',
            subtitle: language === 'CN' ? '用于搭配补位，不是直接替代' : 'Companion products to pair with your current pick',
            items: pairingAlternatives,
            filteredCount: alternativeFilteredStats.related_products,
          },
        ];
        const hasAlternatives = alternativeTracks.some((section) => section.items.length > 0);
        const totalFilteredAlternatives = alternativeTracks.reduce((acc, section) => acc + Number(section.filteredCount || 0), 0);
        if (analyticsCtx && totalFilteredAlternatives > 0) {
          const eventKey = `${card.card_id || 'product_analysis'}::${totalFilteredAlternatives}`;
          if (!alternativesFilterEventKeysRef.current.has(eventKey)) {
            alternativesFilterEventKeysRef.current.add(eventKey);
            emitAuroraProductAlternativesFiltered(analyticsCtx, {
              request_id: asString((payload as any)?.request_id) || null,
              bff_trace_id: requestHeaders.trace_id || null,
              competitors_filtered: alternativeFilteredStats.competitors,
              related_filtered: alternativeFilteredStats.related_products,
              dupes_filtered: alternativeFilteredStats.dupes,
            });
          }
        }

        return (
          <div className="space-y-3">
            {product ? <AuroraAnchorCard product={product} offers={anchorOffers} language={language} hidePriceWhenUnknown /> : null}

            {/* V4: Data quality banner — shown at the top when non-null */}
            {dataQualityBanner ? (
              <div className="rounded-2xl border border-orange-500/30 bg-orange-50/60 px-3 py-2 text-xs text-orange-800">
                <span className="mr-1 font-semibold">{language === 'CN' ? '数据质量提示：' : 'Data quality note:'}</span>
                {dataQualityBanner}
              </div>
            ) : null}

            {/* V4: verdict_level badge (replaces legacy verdict badge when V4 payload detected) */}
            {isV4Payload && verdictLevelLabel ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${verdictLevelStyle || verdictStyle}`}>
                  {language === 'CN' ? '评估：' : 'Assessment: '} {verdictLevelLabel}
                </div>
                {inciConsensusTier ? (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    inciConsensusTier === 'high' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                    inciConsensusTier === 'medium' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                    'border-slate-300 bg-slate-50 text-slate-600'
                  }`}>
                    {language === 'CN'
                      ? `成分可信度：${inciConsensusTier === 'high' ? '高' : inciConsensusTier === 'medium' ? '中' : '低'}`
                      : `INCI confidence: ${inciConsensusTier}`}
                  </span>
                ) : null}
              </div>
            ) : verdict ? (
              <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${verdictStyle}`}>
                {language === 'CN' ? '结论：' : 'Verdict: '} {verdict}
              </div>
            ) : null}

            {/* V4: compact top takeaways (replaces keyTakeawayLines when V4) */}
            {isV4Payload && v4TopTakeaways.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '核心结论' : 'Key takeaways'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {v4TopTakeaways.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : !isV4Payload && keyTakeawayLines.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '重点结论' : 'Key takeaway'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {keyTakeawayLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {visibleMissingLabels.length ? (
              <details className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-amber-700">
                  <span>
                    {language === 'CN'
                      ? `分析限制（${visibleMissingLabels.length}）：${visibleMissingLabels[0]}${visibleMissingLabels.length > 1 ? '…' : ''}`
                      : `Analysis limits (${visibleMissingLabels.length}): ${visibleMissingLabels[0]}${visibleMissingLabels.length > 1 ? '…' : ''}`}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleMissingLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-amber-500/40 bg-background/70 px-2 py-1 text-[11px] text-amber-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </details>
            ) : null}

            {profilePromptNeeded ? (
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3">
                <div className="text-xs font-semibold text-sky-700">
                  {language === 'CN' ? '补充肤况可提升个性化准确度' : 'Add profile details for more personalized guidance'}
                </div>
                <div className="mt-1 text-xs text-sky-700/90">
                  {profilePromptFieldText.length
                    ? language === 'CN'
                      ? `建议补充：${profilePromptFieldText.join('、')}`
                      : `Recommended fields: ${profilePromptFieldText.join(', ')}`
                    : language === 'CN'
                      ? '可一键补充肤质、敏感度和屏障状态。'
                      : 'You can complete skin type, sensitivity, and barrier status in one tap.'}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="chip-button"
                    onClick={() => {
                      if (onOpenProfile) {
                        onOpenProfile();
                        return;
                      }
                      onAction('chip_quick_profile');
                    }}
                  >
                    {language === 'CN' ? '一键补充画像' : 'Complete profile'}
                  </button>
                </div>
              </div>
            ) : null}

            {(heroName || heroWhy) ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '核心成分' : 'Hero ingredient(s)'}</div>
                {heroName ? <div className="mt-1 text-sm font-semibold text-foreground">{heroName}</div> : null}
                {heroRole ? (
                  <div className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {language === 'CN' ? `角色：${heroRole}` : `Role: ${heroRole}`}
                  </div>
                ) : null}
                {heroWhy ? <div className="mt-2 text-sm text-foreground">{heroWhy}</div> : null}
              </div>
            ) : null}

            {formulaIntent.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {language === 'CN' ? '这个配方主要在做什么' : 'What the formula is trying to do'}
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {formulaIntent.slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ingredientGroups.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {language === 'CN' ? '关键活性与支持成分' : 'Notable actives & support ingredients'}
                </div>
                <div className="mt-3 space-y-2">
                  {ingredientGroups.map((group) => (
                    <div key={group.key}>
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{group.title}</div>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((ingredient) => (
                          <button
                            key={`${group.key}_${ingredient}`}
                            type="button"
                            className={`rounded-full border px-2 py-1 text-[11px] transition hover:opacity-90 ${group.colorClass}`}
                            title={language === 'CN' ? '点击查看成分分析' : 'Click to view ingredient analysis'}
                            onClick={() => onAction('ingredient_drilldown', { ingredient_name: ingredient })}
                          >
                            {ingredient}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* V4: best_for from assessment — shown alongside legacy best_for when available */}
            {isV4Payload && v4BestFor.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '更适合' : 'Best for'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {v4BestFor.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : !isV4Payload && (bestForSignals.length || cautionSignals.length) ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '是否适合你' : 'Is it a fit for you?'}</div>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {bestForSignals.length ? (
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '更适合' : 'Best for'}</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                      {bestForSignals.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {cautionSignals.length ? (
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '不太适合/需谨慎' : 'Not ideal for / caution'}</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                      {cautionSignals.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                </div>
              </div>
            ) : null}

            {ifNotIdealSignals.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {language === 'CN' ? '如果不太适合，现在该怎么做' : 'If not ideal, what to do now'}
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {ifNotIdealSignals.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {betterPairingSignals.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {language === 'CN' ? '更理想的搭配方式' : 'Better pairing for your goals'}
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {betterPairingSignals.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* V4: structured watchouts with confirmed/possible status icons */}
            {isV4Payload && v4Watchouts.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {language === 'CN' ? '需要注意的地方' : 'Watchouts'}
                </div>
                <div className="mt-2 space-y-2">
                  {v4Watchouts.map((w, i) => (
                    <div key={`watchout_${i}_${w.issue}`} className="rounded-xl border border-border/40 bg-background/70 p-2">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 text-sm ${w.status === 'confirmed' ? 'text-amber-600' : 'text-orange-500'}`}>
                          {watchoutStatusIcon(w.status)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground">{w.issue}</div>
                          {w.what_to_do ? (
                            <div className="mt-1 text-xs text-muted-foreground">{w.what_to_do}</div>
                          ) : null}
                        </div>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          w.status === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                          'bg-orange-100 text-orange-600'
                        }`}>
                          {w.status === 'confirmed'
                            ? (language === 'CN' ? '已确认' : 'Confirmed')
                            : (language === 'CN' ? '可能' : 'Possible')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* V4: structured how_to_use with when/frequency/order/pairing/stop_signs */}
            {isV4Payload && v4HowToUse ? (
              <details
                open
                className="rounded-2xl border border-border/60 bg-background/60 p-3"
                onToggle={(event) => {
                  const current = event.currentTarget;
                  if (!current.open || !analyticsCtx) return;
                  const eventKey = `${card.card_id || 'product_analysis'}::how_to_layer_inline_opened`;
                  if (howToLayerEventKeysRef.current.has(eventKey)) return;
                  howToLayerEventKeysRef.current.add(eventKey);
                  emitAuroraHowToLayerInlineOpened(analyticsCtx, {
                    request_id: asString((payload as any)?.request_id) || null,
                    bff_trace_id: requestHeaders.trace_id || null,
                  });
                }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                  <span>{language === 'CN' ? '怎么用（使用指南）' : 'How to use'}</span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="mt-2 space-y-2 text-sm">
                  {v4HowToUse.when ? (
                    <div><span className="font-medium text-foreground">{language === 'CN' ? '使用时段：' : 'When: '}</span><span className="text-muted-foreground">{v4HowToUse.when}</span></div>
                  ) : null}
                  {v4HowToUse.frequency ? (
                    <div><span className="font-medium text-foreground">{language === 'CN' ? '频率：' : 'Frequency: '}</span><span className="text-muted-foreground">{v4HowToUse.frequency}</span></div>
                  ) : null}
                  {v4HowToUse.order_in_routine ? (
                    <div><span className="font-medium text-foreground">{language === 'CN' ? 'Routine 顺序：' : 'Order in routine: '}</span><span className="text-muted-foreground">{v4HowToUse.order_in_routine}</span></div>
                  ) : null}
                  {v4HowToUse.pairing_rules.length ? (
                    <div>
                      <div className="font-medium text-foreground">{language === 'CN' ? '搭配建议：' : 'Pairing rules:'}</div>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                        {v4HowToUse.pairing_rules.map((rule) => <li key={rule}>{rule}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {v4HowToUse.stop_signs.length ? (
                    <div>
                      <div className="font-medium text-rose-700">{language === 'CN' ? '停用信号：' : 'Stop signs:'}</div>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-rose-700/80">
                        {v4HowToUse.stop_signs.map((sign) => <li key={sign}>{sign}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : howToUseBullets.length ? (
              <details
                open
                className="rounded-2xl border border-border/60 bg-background/60 p-3"
                onToggle={(event) => {
                  const current = event.currentTarget;
                  if (!current.open || !analyticsCtx) return;
                  const eventKey = `${card.card_id || 'product_analysis'}::how_to_layer_inline_opened`;
                  if (howToLayerEventKeysRef.current.has(eventKey)) return;
                  howToLayerEventKeysRef.current.add(eventKey);
                  emitAuroraHowToLayerInlineOpened(analyticsCtx, {
                    request_id: asString((payload as any)?.request_id) || null,
                    bff_trace_id: requestHeaders.trace_id || null,
                  });
                }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                  <span>{language === 'CN' ? 'How to layer（就地建议）' : 'How to layer (inline guidance)'}</span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {howToUseBullets.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            {/* V4: key_ingredients_by_function grouped display */}
            {isV4Payload && v4KeyIngredientsByFunction.length ? (
              <details className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                  <span>{language === 'CN' ? '关键成分（按功能分组）' : 'Key ingredients by function'}</span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="mt-3 space-y-3">
                  {v4KeyIngredientsByFunction.map((group) => (
                    <div key={group.function}>
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] font-semibold text-muted-foreground">{group.function}</div>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          group.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                          group.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {group.confidence}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {group.ingredients.map((ingredient) => (
                          <button
                            key={`${group.function}_${ingredient}`}
                            type="button"
                            className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[11px] transition hover:opacity-90"
                            title={language === 'CN' ? '点击查看成分分析' : 'Click to view ingredient analysis'}
                            onClick={() => onAction('ingredient_drilldown', { ingredient_name: ingredient })}
                          >
                            {ingredient}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {/* V4: product type reasoning */}
            {isV4Payload && v4ProductTypeReasoning ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{language === 'CN' ? '产品分类：' : 'Product type: '}</span>
                {v4ProductTypeReasoning}
              </div>
            ) : null}

            {followUpQuestion ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {language === 'CN' ? '下一步关键追问' : 'One smart follow-up question'}
                </div>
                <div className="mt-2 text-sm text-foreground">{followUpQuestion}</div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="chip-button"
                onClick={() => onAction('analysis_followup_prompt', {
                  goal: 'less_drying',
                  anchor: followupAnchorPayload,
                  prompt: language === 'CN'
                    ? '基于这款产品，帮我找更不容易拔干的替代品，并说明利弊取舍。'
                    : 'Find less-drying alternatives to this product and explain the tradeoffs.',
                })}
              >
                {language === 'CN' ? 'Find less-drying alternatives' : 'Find less-drying alternatives'}
              </button>
              <button
                type="button"
                className="chip-button"
                onClick={() => onAction('analysis_followup_prompt', {
                  goal: 'acne_focus',
                  anchor: followupAnchorPayload,
                  prompt: language === 'CN'
                    ? '如果目标是 acne 控制，帮我找更聚焦的替代品并给出选择建议。'
                    : 'Find acne-focused alternatives and give me a clear pick recommendation.',
                })}
              >
                {language === 'CN' ? 'Find acne-focused alternatives' : 'Find acne-focused alternatives'}
              </button>
              <button
                type="button"
                className="chip-button"
                onClick={() => onAction('analysis_followup_prompt', {
                  goal: 'pros_cons',
                  anchor: followupAnchorPayload,
                  prompt: language === 'CN'
                    ? '总结这个产品的用户反馈优缺点，按常见好评和常见踩雷分开。'
                    : 'Show user-reported pros and cons for this product.',
                })}
              >
                {language === 'CN' ? 'Show user-reported pros/cons' : 'Show user-reported pros/cons'}
              </button>
            </div>

            {socialOverall ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '社媒反馈摘要' : 'Social feedback snapshot'}</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{socialOverall.headline}</div>
                {socialOverall.details && !(socialPositive.length || socialNegative.length || socialRisks.length) ? (
                  <div className="mt-2 text-xs text-muted-foreground">{socialOverall.details}</div>
                ) : null}
                {Array.isArray((socialOverall as any).channels) && (socialOverall as any).channels.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {((socialOverall as any).channels as string[]).slice(0, 5).map((channel) => (
                      <span key={channel} className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {channel}
                      </span>
                    ))}
                  </div>
                ) : null}
                {(socialPositive.length || socialNegative.length || socialRisks.length) ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {socialPositive.length ? (
                      <div>
                        <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '常见好评' : 'Common positives'}</div>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                          {socialPositive.slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {socialNegative.length ? (
                      <div>
                        <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '常见担忧' : 'Common concerns'}</div>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                          {socialNegative.slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {socialRisks.length ? (
                      <div>
                        <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '重点提醒' : 'Watchouts'}</div>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                          {socialRisks.slice(0, 3).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {language === 'CN'
                    ? '说明：这是聚合口碑信号，用于辅助判断，不等同于医疗建议。'
                    : 'Note: this is aggregated feedback for guidance, not medical advice.'}
                </div>
              </div>
            ) : null}

            {dataNotes.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '数据说明' : 'Data notes'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {dataNotes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {evidenceSources.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '证据来源' : 'Evidence sources'}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {evidenceSources.map((source) => {
                    const sourceLabel = source.label ||
                      (source.type === 'regulatory'
                        ? (language === 'CN' ? '监管源' : 'Regulatory')
                        : source.type === 'retail_page'
                          ? (language === 'CN' ? '零售页补充' : 'Retail PDP')
                        : source.type === 'inci_decoder'
                          ? (language === 'CN' ? 'INCIDecoder' : 'INCIDecoder')
                        : (language === 'CN' ? '官网页面' : 'Official page'));
                    return (
                      <a
                        key={`${source.type}_${source.url}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-foreground transition hover:bg-muted/80"
                      >
                        {sourceLabel}
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* G3: when all three alternative sections are empty, show a single line instead of empty blocks */}
            {!hasAlternatives && (rawCompetitorCandidates.length > 0 || rawRelatedCandidates.length > 0 || rawDupeCandidates.length > 0) ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                {language === 'CN' ? '暂未找到合适的替代品或搭配建议。' : 'No alternatives found for this product.'}
              </div>
            ) : null}

            {hasAlternatives ? (
              <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-sm font-semibold text-foreground">
                  {language === 'CN' ? '可比替代与搭配建议' : 'Comparable alternatives'}
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  {competitorCandidates.length ? <span>{language === 'CN' ? '对标品' : 'Competitors'}</span> : null}
                  {dupeCandidates.length ? <span>{language === 'CN' ? '平替' : 'Dupes'}</span> : null}
                  {relatedCandidates.length ? <span>{language === 'CN' ? '相关产品' : 'Related products'}</span> : null}
                </div>
                {alternativeTracks.map((section) => {
                  if (!section.items.length) return null;
                  return (
                    <div key={section.key} className="rounded-xl border border-border/50 bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">{section.title}</div>
                          <div className="text-[11px] text-muted-foreground">{section.subtitle}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {section.items.length > 1 ? (
                            <button
                              type="button"
                              className="chip-button text-[11px]"
                              onClick={() => {
                                onOpenRecommendationAlternatives?.(alternativeTracks);
                              }}
                            >
                              {language === 'CN' ? '更多' : 'More'}
                            </button>
                          ) : null}
                          {section.filteredCount > 0 ? (
                            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                              {language === 'CN'
                                ? `已过滤非护肤 ${section.filteredCount}`
                                : `${section.filteredCount} non-skincare filtered`}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 space-y-2">
                        {section.items.slice(0, 1).map((entry, idx) => {
                          const candidate = entry.candidate;
                          const sourceBlock = entry.block;
                          const cBrand = asString(candidate.brand) || (language === 'CN' ? '未知品牌' : 'Unknown brand');
                          const cName =
                            asString(candidate.name) ||
                            asString((candidate as any).display_name) ||
                            asString((candidate as any).displayName) ||
                            (language === 'CN' ? '未知产品' : 'Unknown product');
                          const cSimilarity = asNumber((candidate as any).similarity_score ?? (candidate as any).similarityScore);
                          const cWhyObj = asObject((candidate as any).why_candidate || (candidate as any).whyCandidate) || null;
                          const cWhy = cWhyObj
                            ? uniqueStrings([
                              asString((cWhyObj as any).summary),
                              ...asArray((cWhyObj as any).reasons_user_visible || (cWhyObj as any).reasonsUserVisible).map((x) => asString(x)),
                            ]).slice(0, 2)
                            : uniqueStrings((candidate as any).why_candidate || (candidate as any).whyCandidate).slice(0, 2);
                          const cHighlights = uniqueStrings((candidate as any).compare_highlights || (candidate as any).compareHighlights).slice(0, 3);
                          const cTradeoffNotes = uniqueStrings((candidate as any).tradeoff_notes || (candidate as any).tradeoffNotes).slice(0, 3);
                          const cTradeoff = cTradeoffNotes[0] || cHighlights.find((line) => !isLikelyUrl(line)) || cWhy[1] || '';
                          const cExpectedOutcome = asString((candidate as any).expected_outcome || (candidate as any).expectedOutcome);
                          const cUrl = cHighlights.find((x) => isLikelyUrl(x)) || asString((candidate as any).url) || '';
                          const llmSuggestion = asObject((candidate as any).llm_suggestion || (candidate as any).llmSuggestion) || null;
                          const llmSuggestedLabel = normalizeRecoLabel(llmSuggestion?.suggested_label);
                          const llmWrongBlockTarget = isRecoBlockType(llmSuggestion?.wrong_block_target)
                            ? llmSuggestion?.wrong_block_target
                            : undefined;
                          const llmRationale = asString(llmSuggestion?.rationale_user_visible);
                          const llmFlags = uniqueStrings(llmSuggestion?.flags).slice(0, 4);
                          const llmConfidence = asNumber(llmSuggestion?.confidence);
                          const candidateId = asString((candidate as any).product_id) || asString((candidate as any).sku_id) || cName;
                          const feedbackKey = `${sourceBlock}::${candidateId}`.toLowerCase();
                          const feedbackBusy = feedbackBusyByKey[feedbackKey] === true;
                          const feedbackSaved = feedbackSavedByKey[feedbackKey] || null;
                          const feedbackError = asString(feedbackErrorByKey[feedbackKey]);

                          return (
                            <div key={`${section.key}_${sourceBlock}_${cBrand}_${cName}_${idx}`} className="rounded-xl border border-border/50 bg-background/60 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[11px] text-muted-foreground">#{idx + 1}</div>
                                  <div className="truncate text-sm font-semibold text-foreground">{cBrand}</div>
                                  <div className="truncate text-xs text-muted-foreground">{cName}</div>
                                </div>
                                {typeof cSimilarity === 'number' && Number.isFinite(cSimilarity) ? (
                                  <span className="rounded-full border border-border/60 bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                    {language === 'CN'
                                      ? `相似度 ${Math.round((cSimilarity <= 1 ? cSimilarity * 100 : cSimilarity))}%`
                                      : `Similarity ${Math.round((cSimilarity <= 1 ? cSimilarity * 100 : cSimilarity))}%`}
                                  </span>
                                ) : null}
                              </div>

                              {cWhy.length ? (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                  {cWhy.map((x) => (
                                    <li key={x}>
                                      <span className="font-medium text-foreground">{language === 'CN' ? 'Why this: ' : 'Why this: '}</span>
                                      {x}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}

                              {cExpectedOutcome ? (
                                <div className="mt-2 text-[11px] text-muted-foreground">
                                  <span className="font-medium text-foreground">{language === 'CN' ? 'Best use: ' : 'Best use: '}</span>
                                  {cExpectedOutcome}
                                </div>
                              ) : null}

                              {cTradeoff ? (
                                <div className="mt-2 text-[11px] text-muted-foreground">
                                  {language === 'CN' ? `Tradeoff: ${cTradeoff}` : `Tradeoff: ${cTradeoff}`}
                                </div>
                              ) : null}

                              {(canShowEmployeeFeedbackControls && anchorProductIdForFeedback && sourceBlock === 'competitors') ? (
                                <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-background/70 p-2">
                                  {llmSuggestedLabel ? (
                                    <div className="space-y-1 text-[11px] text-muted-foreground">
                                      <div className="font-medium text-foreground">
                                        {language === 'CN' ? 'LLM 预标注：' : 'LLM prelabel: '}
                                        {formatRecoLabel(llmSuggestedLabel, language)}
                                        {typeof llmConfidence === 'number' ? ` (${Math.round(llmConfidence * 100)}%)` : ''}
                                      </div>
                                      {llmRationale ? <div>{llmRationale}</div> : null}
                                      {llmFlags.length ? (
                                        <div className="flex flex-wrap gap-1">
                                          {llmFlags.map((flag) => (
                                            <span key={flag} className="rounded-full border border-border/60 bg-muted/70 px-2 py-0.5 text-[10px]">
                                              {flag}
                                            </span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className="chip-button"
                                      disabled={feedbackBusy}
                                      onClick={() => {
                                        void submitRecoFeedback({
                                          candidate,
                                          block: sourceBlock,
                                          rankPosition: idx + 1,
                                          feedbackType: 'relevant',
                                          anchorProductId: anchorProductIdForFeedback,
                                          pipelineVersion,
                                          models: feedbackModels,
                                        });
                                      }}
                                    >
                                      {language === 'CN' ? '✅ 相关' : '✅ Relevant'}
                                    </button>
                                    <button
                                      type="button"
                                      className="chip-button"
                                      disabled={feedbackBusy}
                                      onClick={() => {
                                        void submitRecoFeedback({
                                          candidate,
                                          block: sourceBlock,
                                          rankPosition: idx + 1,
                                          feedbackType: 'not_relevant',
                                          anchorProductId: anchorProductIdForFeedback,
                                          pipelineVersion,
                                          models: feedbackModels,
                                        });
                                      }}
                                    >
                                      {language === 'CN' ? '❌ 不相关' : '❌ Not relevant'}
                                    </button>
                                    <button
                                      type="button"
                                      className="chip-button"
                                      disabled={feedbackBusy}
                                      onClick={() => {
                                        void submitRecoFeedback({
                                          candidate,
                                          block: sourceBlock,
                                          rankPosition: idx + 1,
                                          feedbackType: 'wrong_block',
                                          wrongBlockTarget: llmWrongBlockTarget || 'dupes',
                                          anchorProductId: anchorProductIdForFeedback,
                                          pipelineVersion,
                                          models: feedbackModels,
                                        });
                                      }}
                                    >
                                      {language === 'CN' ? '⚠️ 分块错了' : '⚠️ Wrong block'}
                                    </button>
                                  </div>

                                  {feedbackSaved ? (
                                    <div className="text-[11px] text-emerald-700">
                                      {language === 'CN'
                                        ? `已记录：${formatRecoLabel(feedbackSaved, language)}`
                                        : `Saved: ${formatRecoLabel(feedbackSaved, language)}`}
                                    </div>
                                  ) : null}
                                  {feedbackError ? (
                                    <div className="text-[11px] text-rose-700">
                                      {language === 'CN' ? `提交失败：${feedbackError}` : `Submit failed: ${feedbackError}`}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              {(originalForCompare || (cUrl && onOpenPdp)) ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {originalForCompare
                                  && isComparableProductLike(originalForCompare)
                                  && isComparableProductLike(candidate)
                                  && !looksLikeSelfRef(originalForCompare, candidate) ? (
                                    <button
                                      type="button"
                                      className="chip-button"
                                      onClick={() => onAction('dupe_compare', { original: originalForCompare, dupe: candidate })}
                                    >
                                      {language === 'CN' ? 'Compare tradeoffs' : 'Compare tradeoffs'}
                                    </button>
                                  ) : null}
                                  {(cUrl && onOpenPdp) ? (
                                    <button
                                      type="button"
                                      className="chip-button"
                                      onClick={() => onOpenPdp({ url: cUrl, title: `${cBrand} ${cName}`.trim() })}
                                    >
                                      {language === 'CN' ? '查看商品页' : 'Open product page'}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        {section.items.length > 1 ? (
                          <div className="text-[11px] text-muted-foreground">
                            {language === 'CN'
                              ? `还有 ${section.items.length - 1} 个候选，点击 More 查看。`
                              : `${section.items.length - 1} more options available. Tap More to view.`}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {(!hasAlternatives && totalFilteredAlternatives > 0) ? (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                {language === 'CN'
                  ? `已自动过滤 ${totalFilteredAlternatives} 个非护肤候选，当前暂未返回可用替代。`
                  : `${totalFilteredAlternatives} non-skincare alternatives were filtered; no valid alternatives returned yet.`}
              </div>
            ) : null}

            {(evidenceKeyIngredients.length ||
              evidenceMechanisms.length ||
              evidenceFitNotes.length ||
              evidenceRiskNotes.length ||
              socialPositive.length ||
              socialNegative.length ||
              socialRisks.length ||
              expertNotes.length ||
              platformScores) ? (
              <details className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                  <span>{language === 'CN' ? '证据与注意事项' : 'Evidence & notes'}</span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <div className="mt-3 space-y-3 text-sm text-foreground">
                  {evidenceKeyIngredients.length ? (
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '关键成分' : 'Key ingredients'}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {evidenceKeyIngredients.map((x) => (
                          <span key={x} className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px]">
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {evidenceMechanisms.length ? (
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '机制/作用' : 'Mechanisms'}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {evidenceMechanisms.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {evidenceFitNotes.length ? (
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '适配提示' : 'Fit notes'}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {evidenceFitNotes.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {evidenceRiskNotes.length ? (
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '风险点' : 'Risks'}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                        {evidenceRiskNotes.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {platformScores ? (
                    <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                      <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '平台信号' : 'Platform signals'}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {Object.entries(platformScores).slice(0, 6).map(([k, v]) => (
                          <span key={k} className="rounded-full border border-border/60 bg-background/60 px-2 py-1">
                            {k}: {typeof v === 'number' ? v : String(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(socialPositive.length || socialNegative.length || socialRisks.length) ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {socialPositive.length ? (
                        <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                          <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '常见好评' : 'Typical positives'}</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {socialPositive.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {socialNegative.length ? (
                        <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                          <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '常见差评' : 'Typical negatives'}</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {socialNegative.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {socialRisks.length ? (
                        <div className="rounded-xl border border-border/50 bg-muted/40 p-3 sm:col-span-2">
                          <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '对人群风险' : 'Risks for groups'}</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {socialRisks.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {expertNotes.length ? (
                    <div className="rounded-xl border border-border/50 bg-muted/40 p-3">
                      <div className="text-[11px] font-semibold text-foreground">{language === 'CN' ? '专家/说明' : 'Expert notes'}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {expertNotes.slice(0, 6).map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}

            <RoutineCompatibilityFooter
              language={language}
              baseProduct={compatibilityBaseProduct}
              routineProducts={routineCompatibilityProducts}
              resolveProductsSearch={resolveProductsSearch}
              analyticsCtx={analyticsCtx}
            />

          </div>
        );
      })() : null}

      {cardType === 'dupe_suggest' ? (() => {
        const originalRaw = asObject((payload as any).original) || asObject((payload as any).anchor_product) || null;
        const dupes = asArray((payload as any).dupes).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
        const comparables = asArray((payload as any).comparables).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;

        return (
          <DupeSuggestCard
            original={originalRaw}
            dupes={dupes as any}
            comparables={comparables as any}
            language={language}
            onCompare={({ original, dupe }) => onAction('dupe_compare', { original, dupe })}
          />
        );
      })() : null}

      {cardType === 'dupe_compare' ? (() => {
        const originalRaw = asObject((payload as any).original) || asObject((payload as any).original_product) || asObject((payload as any).originalProduct);
        const dupeRaw = asObject((payload as any).dupe) || asObject((payload as any).dupe_product) || asObject((payload as any).dupeProduct);
        const similarity = asNumber((payload as any).similarity);
        const compareQuality = String(asString((payload as any).compare_quality || (payload as any).compareQuality) || 'full').toLowerCase();
        const isLimitedCompare = compareQuality === 'limited';
        const limitedReasonCode = String(asString((payload as any).limited_reason || (payload as any).limitedReason) || '').toLowerCase();

        const tradeoffs = uniqueStrings((payload as any).tradeoffs);
        const tradeoffsDetail = asObject((payload as any).tradeoffs_detail || (payload as any).tradeoffsDetail) || null;

        const missingActives = uniqueStrings(tradeoffsDetail?.missing_actives || (tradeoffsDetail as any)?.missingActives);
        const addedBenefits = uniqueStrings(tradeoffsDetail?.added_benefits || (tradeoffsDetail as any)?.addedBenefits);
        const textureDiff = uniqueStrings(tradeoffsDetail?.texture_finish_differences || (tradeoffsDetail as any)?.textureFinishDifferences);
        const availabilityNote = asString(tradeoffsDetail?.availability_note || (tradeoffsDetail as any)?.availabilityNote);
        const priceDeltaUsd = asNumber(tradeoffsDetail?.price_delta_usd || (tradeoffsDetail as any)?.priceDeltaUsd);

        const tradeoffNoteParts = [
          ...textureDiff,
          ...(availabilityNote ? [availabilityNote] : []),
          ...(priceDeltaUsd != null ? [`Price delta (USD): ${priceDeltaUsd}`] : []),
        ].filter(Boolean);

        const tradeoffNote = isLimitedCompare
          ? undefined
          : tradeoffNoteParts.length
            ? tradeoffNoteParts.slice(0, 2).join(' · ')
            : tradeoffs[0] || undefined;
        const limitedReason = (() => {
          if (limitedReasonCode === 'tradeoffs_detail_missing') {
            return language === 'CN'
              ? '这组对比缺少更完整的取舍细节；补充更明确的平替商品链接或全名后可提升结果。'
              : 'Tradeoff detail is missing for this pair. Provide a clearer dupe product link/full name to improve tradeoffs.';
          }
          if (!limitedReasonCode) return undefined;
          return language === 'CN'
            ? '这组对比当前只有简版结果；补充更明确的商品信息后可提升取舍细节。'
            : 'Comparison details are limited for this pair. Provide clearer product information to improve tradeoffs.';
        })();

        const original = toDupeProduct(originalRaw, language);
        const dupe = toDupeProduct(dupeRaw, language);

        const labels =
          language === 'CN'
            ? {
                similarity: '相似度',
                tradeoffsTitle: '取舍分析',
                evidenceTitle: '证据与信号',
                scienceLabel: '科学',
                socialLabel: '口碑',
                keyActives: '关键成分',
                riskFlags: '风险',
                ingredientHighlights: '成分亮点',
                citations: '引用',
                tradeoffNote: '取舍',
                missingActives: '缺失成分',
                addedBenefits: '新增亮点',
                switchToDupe: '选平替',
                keepOriginal: '选原版',
              }
            : undefined;

        return (
          <div className="space-y-3">
            <DupeComparisonCard
              original={original as any}
              dupe={dupe as any}
              similarity={typeof similarity === 'number' && Number.isFinite(similarity) ? similarity : undefined}
              quality={isLimitedCompare ? 'limited' : 'full'}
              limitedReason={limitedReason}
              basicCompare={isLimitedCompare ? tradeoffs.slice(0, 4) : []}
              tradeoffNote={tradeoffNote}
              missingActives={missingActives}
              addedBenefits={addedBenefits}
              labels={labels as any}
            />

            {!isLimitedCompare && tradeoffs.length ? (
              <details className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                  <span>{language === 'CN' ? '更多取舍细节' : 'More tradeoffs'}</span>
                  <ChevronDown className="h-4 w-4" />
                </summary>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {tradeoffs.slice(0, 10).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        );
      })() : null}

      {cardType === 'photo_confirm' ? (
        <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-foreground">
          <div className="text-xs text-muted-foreground">{language === 'CN' ? '照片质检结果' : 'Photo QC result'}</div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {qcStatus === 'passed'
              ? language === 'CN'
                ? '通过 ✅'
                : 'Passed ✅'
              : qcStatus === 'degraded'
                ? language === 'CN'
                  ? '可用（质量一般）⚠️'
                  : 'Usable (degraded) ⚠️'
                : qcStatus === 'pending' || qcStatus === 'unknown'
                  ? language === 'CN'
                    ? '质检中…'
                    : 'Checking…'
                  : language === 'CN'
                    ? `需要重拍：${qcStatus}`
                    : `Needs retry: ${qcStatus}`}
          </div>
          {qcSummary ? <div className="mt-2 text-xs text-muted-foreground">{qcSummary}</div> : null}
          {qcSuggestions.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {qcSuggestions.slice(0, 4).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {cardType !== 'recommendations' && cardType !== 'profile' && cardType !== 'analysis_summary' && debug ? (
        <>
          <details className="rounded-2xl border border-border/50 bg-background/50 p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
              <span>{language === 'CN' ? '查看详情' : 'Details'}</span>
              <ChevronDown className="h-4 w-4" />
            </summary>
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
              {renderJson(payloadObj ?? card.payload)}
            </pre>
            {fieldMissingCount ? (
              <pre className="mt-2 max-h-[220px] overflow-auto rounded-xl bg-muted p-3 text-[11px] text-foreground">
                {renderJson(card.field_missing)}
              </pre>
            ) : null}
          </details>
        </>
      ) : null}
    </div>
  );
}

export default function BffChat() {
  const { language, setLanguage: setAppLanguage } = useLanguage();

  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [history, setHistory] = useState<ChatHistoryItem[]>(() => loadChatHistory());

  useEffect(() => {
    if (!sidebarOpen) return;
    setHistory(loadChatHistory());
  }, [sidebarOpen]);

  const openChatByBriefId = useCallback(
    (briefId: string) => {
      const id = String(briefId || '').trim();
      if (!id) return;
      navigate(`/chat?brief_id=${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  type DeepLinkOpen = 'photo' | 'routine' | 'auth' | 'checkin' | 'profile';
  const searchParams = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const openRaw = String(sp.get('open') || '').trim().toLowerCase();
      return {
        brief_id: String(sp.get('brief_id') || '').trim(),
        trace_id: String(sp.get('trace_id') || '').trim(),
        q: String(sp.get('q') || '').trim(),
        chip_id: String(sp.get('chip_id') || '').trim(),
        activity_id: String(sp.get('activity_id') || '').trim(),
        artifact_id: String(sp.get('artifact_id') || '').trim(),
        open: (
          openRaw === 'photo' || openRaw === 'routine' || openRaw === 'auth' || openRaw === 'checkin' || openRaw === 'profile'
            ? openRaw
            : null
        ) as DeepLinkOpen | null,
      };
    } catch {
      return {
        brief_id: '',
        trace_id: '',
        q: '',
        chip_id: '',
        activity_id: '',
        artifact_id: '',
        open: null as DeepLinkOpen | null,
      };
    }
  }, [location.search]);
  const initialAuthSessionRef = useRef<{ loaded: boolean; value: ReturnType<typeof loadAuroraAuthSession> }>({
    loaded: false,
    value: null,
  });
  if (!initialAuthSessionRef.current.loaded) {
    initialAuthSessionRef.current = {
      loaded: true,
      value: loadAuroraAuthSession(),
    };
  }
  const initialAuthSession = initialAuthSessionRef.current.value;
  const pendingLocationSessionProfilePatchRef = useRef<Record<string, unknown> | null>(
    asObject((location.state as any)?.session_patch?.profile) || null,
  );

  const [langReplyMode, setLangReplyModeState] = useState<LangReplyMode>(() => getLangReplyMode());
  const langMismatchHintMutedUntilRef = useRef<number>(getLangMismatchHintMutedUntil());
  const [headers, setHeaders] = useState(() => {
    const base = makeDefaultHeaders(language);
    const briefId = searchParams.brief_id;
    const traceId = searchParams.trace_id;
    return {
      ...base,
      ...(initialAuthSession?.token ? { auth_token: initialAuthSession.token } : {}),
      ...(briefId ? { brief_id: briefId.slice(0, 128) } : {}),
      ...(traceId ? { trace_id: traceId.slice(0, 128) } : {}),
    };
  });
  const [sessionState, setSessionState] = useState<string>('idle');
  const [sessionMeta, setSessionMeta] = useState<Record<string, unknown> | null>(() => {
    const next: Record<string, unknown> = {};
    if (searchParams.artifact_id) next.latest_artifact_id = searchParams.artifact_id;
    if (searchParams.activity_id) next.source_activity_id = searchParams.activity_id;
    return Object.keys(next).length ? next : null;
  });
  const [agentState, setAgentState] = useState<AgentState>('IDLE_CHAT');
  const agentStateRef = useRef<AgentState>('IDLE_CHAT');
  useEffect(() => {
    agentStateRef.current = agentState;
  }, [agentState]);
  const setAgentStateSafe = useCallback((next: AgentState) => {
    agentStateRef.current = next;
    setAgentState(next);
  }, []);
  const [quickProfileStep, setQuickProfileStep] = useState<QuickProfileStep>('skin_feel');
  const [quickProfileDraft, setQuickProfileDraft] = useState<QuickProfileProfilePatch>({});
  const [quickProfileBusy, setQuickProfileBusy] = useState(false);
  const [debug] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('debug') === '1';
    } catch {
      return false;
    }
  });
  const [anchorProductId] = useState<string>(() => {
    try {
      return String(new URLSearchParams(window.location.search).get('anchor_product_id') || '').trim();
    } catch {
      return '';
    }
  });
  const [anchorProductUrl] = useState<string>(() => {
    try {
      return String(new URLSearchParams(window.location.search).get('anchor_product_url') || '').trim();
    } catch {
      return '';
    }
  });
  const [input, setInput] = useState('');
  const [items, setItems] = useState<ChatItem[]>([]);
  const itemsRef = useRef<ChatItem[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [routineFormBusy, setRoutineFormBusy] = useState(false);
  const isLoading = chatBusy || analysisBusy;
  const [loadingIntent, setLoadingIntent] = useState<AuroraLoadingIntent>('default');
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [streamedText, setStreamedText] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const streamEndpointDisabledRef = useRef(false);
  const sessionStartedEmittedRef = useRef(false);
  const returnVisitEmittedRef = useRef(false);
  const openIntentConsumedRef = useRef<string | null>(null);
  const actionIntentConsumedRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [bootstrapInfo, setBootstrapInfo] = useState<BootstrapInfo | null>(null);
  const [profileSnapshot, setProfileSnapshot] = useState<Record<string, unknown> | null>(null);
  const [ingredientQuestionBusy, setIngredientQuestionBusy] = useState(false);
  const pendingActionAfterDiagnosisRef = useRef<V1Action | null>(null);
  const [pendingRecoGoalOther, setPendingRecoGoalOther] = useState(false);
  const threadStateRef = useRef<Record<string, unknown>>({});

  const clearDiagnosisThreadState = useCallback(() => {
    const next = { ...(threadStateRef.current || {}) };
    DIAGNOSIS_THREAD_STATE_KEYS.forEach((key) => {
      delete next[key];
    });
    threadStateRef.current = next;
  }, []);

  const applyThreadOps = useCallback((opsRaw: unknown) => {
    const ops = Array.isArray(opsRaw) ? opsRaw : [];
    if (ops.length === 0) return;
    const next = { ...(threadStateRef.current || {}) };
    for (const rawOp of ops) {
      if (!rawOp || typeof rawOp !== 'object' || Array.isArray(rawOp)) continue;
      const op = rawOp as Record<string, unknown>;
      if (op.op === 'set' && typeof op.key === 'string') {
        next[op.key] = op.value;
      } else if (op.op === 'delete' && typeof op.key === 'string') {
        delete next[op.key];
      } else if (op.op === 'clear') {
        Object.keys(next).forEach((k) => delete next[k]);
      }
    }
    threadStateRef.current = next;
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!searchParams.artifact_id && !searchParams.activity_id) return;
    setSessionMeta((prev) => {
      const base = asObject(prev) || {};
      return {
        ...base,
        ...(searchParams.artifact_id ? { latest_artifact_id: searchParams.artifact_id } : {}),
        ...(searchParams.activity_id ? { source_activity_id: searchParams.activity_id } : {}),
      };
    });
  }, [searchParams.activity_id, searchParams.artifact_id]);

  const shop = useShop();
  const cartCount = Math.max(0, Number(shop.cart?.item_count) || 0);

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [checkinSheetOpen, setCheckinSheetOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoSheetAutoOpenSlot, setPhotoSheetAutoOpenSlot] = useState<'daylight' | 'indoor_white' | null>(null);
  const [photoSheetAutoOpenNonce, setPhotoSheetAutoOpenNonce] = useState(0);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [dupeSheetOpen, setDupeSheetOpen] = useState(false);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [authSession, setAuthSession] = useState(() => initialAuthSession);
  const [authMode, setAuthMode] = useState<'code' | 'password'>('code');
  const [authStage, setAuthStage] = useState<'email' | 'code'>('email');
  const [authDraft, setAuthDraft] = useState(() => ({
    email: authSession?.email ?? '',
    code: '',
    password: '',
    newPassword: '',
    newPasswordConfirm: '',
  }));
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [analysisPhotoRefs, setAnalysisPhotoRefs] = useState<AnalysisPhotoRef[]>([]);
  const [sessionPhotos, setSessionPhotos] = useState<Session['photos']>({});
  const [promptRoutineAfterPhoto, setPromptRoutineAfterPhoto] = useState(false);
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false);
  const [routineTab, setRoutineTab] = useState<'am' | 'pm'>('am');
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft>(() => makeEmptyRoutineDraft());
  const [alternativesSheetOpen, setAlternativesSheetOpen] = useState(false);
  const [alternativesSheetTracks, setAlternativesSheetTracks] = useState<ProductAlternativeTrack[]>([]);

  const [productDraft, setProductDraft] = useState('');
  const [dupeDraft, setDupeDraft] = useState({ original: '' });

  const [profileDraft, setProfileDraft] = useState({
    region: '',
    budgetTier: '',
    age_band: 'unknown',
    high_risk_medications_text: '',
  });

  const [checkinDraft, setCheckinDraft] = useState({
    redness: 0,
    acne: 0,
    hydration: 0,
    notes: '',
  });

  useEffect(() => {
    setHeaders((prev) => ({ ...prev, lang: language }));
  }, [language]);

  useEffect(() => {
    setHeaders((prev) => ({ ...prev, auth_token: authSession?.token }));
  }, [authSession?.token]);

  useEffect(() => {
    const email = String(authSession?.email || '').trim();
    if (!email) return;
    const normalized = normalizeProfileFromBootstrap(profileSnapshot ?? bootstrapInfo?.profile ?? null);
    if (!normalized) return;
    saveAuroraProfileCache(email, {
      displayName: normalized.displayName || '',
      avatarUrl: normalized.avatarUrl || '',
      region: normalized.region || '',
    });
  }, [authSession?.email, bootstrapInfo?.profile, profileSnapshot]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, isLoading]);

  const openPdpDrawer = useCallback(
    (args: { url: string; title?: string }) => {
      const rawUrl = String(args.url || '').trim();
      if (!rawUrl) return;
      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        return;
      }

      const segments = parsed.pathname.split('/').filter(Boolean);
      const isPdpPath = segments.length === 2 && segments[0] === 'products' && Boolean(segments[1]);
      const isBrowseRoute = String(parsed.searchParams.get('open') || '').trim().toLowerCase() === 'browse';
      if (!isPdpPath || isBrowseRoute) {
        if (debug) {
          console.warn('[PDP Guard] blocked non-PDP route', { url: rawUrl });
        }
        return;
      }
      shop.openShop({ url: parsed.toString(), title: args.title });
    },
    [debug, shop],
  );

  const openRecommendationAlternativesSheet = useCallback(
    (
      tracks: ProductAlternativeTrack[],
      opts?: {
        source?: string;
        anchorKey?: string | null;
      },
    ) => {
      const normalizedTracks = Array.isArray(tracks) ? tracks.filter((track) => Array.isArray(track.items) && track.items.length > 0) : [];
      if (!normalizedTracks.length) return;
      setAlternativesSheetTracks(normalizedTracks);
      setAlternativesSheetOpen(true);
      emitRecommendationDetailsSheetOpened(
        {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: agentState,
        },
        {
          source: String(opts?.source || 'recommendation_card'),
          anchor_key: opts?.anchorKey || null,
          track_count: normalizedTracks.length,
          item_count: normalizedTracks.reduce((sum, track) => sum + (Array.isArray(track.items) ? track.items.length : 0), 0),
        },
      );
    },
    [agentState, headers.aurora_uid, headers.brief_id, headers.trace_id, language],
  );

  const loadRecommendationAlternatives = useCallback(
    async ({
      anchorProductId,
      productInput,
      product,
    }: {
      anchorProductId?: string | null;
      productInput?: string | null;
      product?: Record<string, unknown> | null;
    }): Promise<{ alternatives: Array<Record<string, unknown>>; llmTrace?: Record<string, unknown> | null } | null> => {
      const requestHeaders = { ...headers, lang: language };
      const body = {
        ...(String(productInput || '').trim() ? { product_input: String(productInput || '').trim().slice(0, 240) } : {}),
        ...(String(anchorProductId || '').trim() ? { anchor_product_id: String(anchorProductId || '').trim().slice(0, 180) } : {}),
        ...(product && typeof product === 'object' ? { product } : {}),
        max_total: 6,
        include_debug: Boolean(debug),
      };
      if (!body.product_input && !body.anchor_product_id && !body.product) return null;
      try {
        const resp = await fetchRecoAlternatives(requestHeaders, body, { timeoutMs: RECO_ALTERNATIVES_LAZY_TIMEOUT_MS });
        const alternatives = asArray(resp && resp.alternatives).map((row) => asObject(row)).filter(Boolean) as Array<Record<string, unknown>>;
        const llmTrace = asObject(resp && resp.llm_trace) || null;
        return { alternatives, ...(llmTrace ? { llmTrace } : {}) };
      } catch (err) {
        if (debug) {
          console.warn('[RecoAlternatives] lazy load failed', err);
        }
        return null;
      }
    },
    [debug, headers, language],
  );

  const loadRecommendationCompatibility = useCallback(
    async (
      routine: {
        am: Array<Record<string, unknown>>;
        pm: Array<Record<string, unknown>>;
      },
    ): Promise<{ analysisReady: boolean; safe: boolean; summary: string | null; conflicts: string[] } | null> => {
      if (!Array.isArray(routine.am) && !Array.isArray(routine.pm)) return null;
      const requestHeaders = { ...headers, lang: language };
      try {
        const env = await fetchRoutineSimulation(
          requestHeaders,
          {
            routine: {
              am: Array.isArray(routine.am) ? routine.am : [],
              pm: Array.isArray(routine.pm) ? routine.pm : [],
            },
          },
          { timeoutMs: RECO_COMPATIBILITY_LAZY_TIMEOUT_MS },
        );
        const cards = Array.isArray(env?.cards) ? env.cards : [];
        const simCard = cards.find((entry) => String((entry as any)?.type || '').trim().toLowerCase() === 'routine_simulation');
        const payload = asObject((simCard as any)?.payload) || null;
        if (!payload || payload.analysis_ready !== true) return null;
        const conflicts = asArray(payload.conflicts)
          .map((row) => (asObject(row) ? asString((row as any).message) || asString((row as any).title) || asString((row as any).summary) : asString(row)))
          .filter(Boolean) as string[];
        return {
          analysisReady: true,
          safe: payload.safe === true,
          summary: asString(payload.summary) || null,
          conflicts,
        };
      } catch (err) {
        if (debug) {
          console.warn('[RecoCompatibility] lazy simulate failed', err);
        }
        return null;
      }
    },
    [debug, headers, language],
  );

  const applyEnvelope = useCallback((env: V1Envelope) => {
    const enhancedEnv = augmentEnvelopeWithIngredientReport(env);
    setError(null);

    if (enhancedEnv.session_patch && typeof enhancedEnv.session_patch === 'object') {
      const patch = enhancedEnv.session_patch as Record<string, unknown>;
      const next = (enhancedEnv.session_patch as Record<string, unknown>)['next_state'];
      if (typeof next === 'string' && next.trim()) setSessionState(next.trim());
      const nextMeta = asObject(patch.meta);
      if (nextMeta) setSessionMeta(nextMeta);

      const profilePatch = asObject(patch.profile);
      if (profilePatch) setProfileSnapshot(profilePatch);

      setBootstrapInfo((prev) => {
        const merged: BootstrapInfo = prev
          ? { ...prev }
          : { profile: null, recent_logs: [], checkin_due: null, is_returning: null, db_ready: null };

        if (profilePatch) merged.profile = profilePatch;

        const recentLogs = asArray(patch.recent_logs).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
        if (recentLogs.length) merged.recent_logs = recentLogs;

        if (typeof patch.checkin_due === 'boolean') merged.checkin_due = patch.checkin_due;
        if (typeof patch.is_returning === 'boolean') merged.is_returning = patch.is_returning;
        if (typeof patch.db_ready === 'boolean') merged.db_ready = patch.db_ready;

        return merged;
      });
    }

    const rawCards = Array.isArray(enhancedEnv.cards) ? enhancedEnv.cards : [];
    const hasEnvelopeCards = rawCards.length > 0;

    const nextItems: ChatItem[] = [];
    if (enhancedEnv.assistant_message?.content && !hasEnvelopeCards) {
      const raw = String(enhancedEnv.assistant_message.content || '');
      const cleaned = debug ? raw : stripInternalKbRefsFromText(raw);
      if (cleaned.trim()) nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: cleaned });
    }
    const gatedCards = filterRecommendationCardsForState(rawCards, agentStateRef.current);
    const passiveFilteredCards = filterPassiveAdvisoryCards(gatedCards, FF_SHOW_PASSIVE_GATES);
    const cards = collapseAnalysisSummaryCards(collapsePhotoConfirmWhenAnalysisPresent(passiveFilteredCards));
    const hasAnalysisSummaryCard = cards.some((card) => String(card?.type || '').trim().toLowerCase() === 'analysis_summary');
    const cardTypes = new Set(cards.map((card) => String(card?.type || '').trim().toLowerCase()).filter(Boolean));
    if (cardTypes.has('ingredient_goal_match') || cardTypes.has('aurora_ingredient_report') || cardTypes.has('ingredient_hub')) {
      const analyticsCtx: AnalyticsContext = {
        brief_id: headers.brief_id,
        trace_id: headers.trace_id,
        aurora_uid: headers.aurora_uid,
        lang: toLangPref(language),
        state: agentStateRef.current,
      };
      const answerType = cardTypes.has('ingredient_goal_match')
        ? 'ingredient_goal_match'
        : cardTypes.has('aurora_ingredient_report')
          ? 'ingredient_report'
          : 'ingredient_hub';
      emitIngredientsAnswerServed(analyticsCtx, { answer_type: answerType, card_count: cards.length });
    }

    if (cards.length) {
      nextItems.push({
        id: nextId(),
        role: 'assistant',
        kind: 'cards',
        cards,
        meta: { request_id: enhancedEnv.request_id, trace_id: enhancedEnv.trace_id, events: enhancedEnv.events },
      });
    }

    const suppressChips = cards.length
      ? cards.some((c) => {
          const t = String((c as any)?.type || '').toLowerCase();
          return t === 'analysis_summary' || t === 'profile' || t === 'diagnosis_gate';
        })
      : false;

    const visibleChips = dedupeSuggestedChips(
      filterPassiveAdvisoryChips(
        Array.isArray(enhancedEnv.suggested_chips) ? enhancedEnv.suggested_chips : [],
        FF_SHOW_PASSIVE_GATES,
      ),
      12,
    );
    if (!suppressChips && visibleChips.length) {
      nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: visibleChips });
    }

    if (nextItems.length) {
      setItems((prev) => {
        const base = hasAnalysisSummaryCard
          ? removeAnalysisSummaryCardsFromHistory(removePhotoConfirmCardsFromHistory(prev))
          : prev;
        return [...base, ...nextItems];
      });
    }
  }, [debug, headers.aurora_uid, headers.brief_id, headers.trace_id, language]);

  const applyChatResponseV1 = useCallback(
    (response: ChatResponseV1) => {
      const analyticsCtx: AnalyticsContext = {
        brief_id: headers.brief_id,
        trace_id: headers.trace_id,
        aurora_uid: headers.aurora_uid,
        lang: toLangPref(language),
        state: agentStateRef.current,
      };

      emitIntentDetected(analyticsCtx, {
        intent_id: response.telemetry.intent,
        confidence: response.telemetry.intent_confidence,
      });
      emitAuroraToolCalled(analyticsCtx, {
        tool_name: response.telemetry.intent || 'unknown',
        success: true,
      });
      response.cards.forEach((card, idx) => {
        emitCardImpression(analyticsCtx, {
          card_type: card.type,
          card_id: card.id,
          card_position: idx,
        });
        const adapterPayload: Record<string, unknown> = {
          title: card.title,
          ...(card.subtitle ? { subtitle: card.subtitle } : {}),
          priority: card.priority,
          tags: card.tags,
          sections: card.sections,
          actions: card.actions,
        };
        const adapterHit = adaptChatCardForRichRender({
          cardType: card.type,
          payload: adapterPayload,
          language,
        });
        if (adapterHit?.kind === 'triage') {
          emitTriageStageShown(analyticsCtx, {
            card_id: card.id,
            card_position: idx,
            risk_level: adapterHit.data.riskLevel,
            recovery_window_hours:
              typeof adapterHit.data.recoveryWindowHours === 'number'
                ? adapterHit.data.recoveryWindowHours
                : null,
            red_flag_count: adapterHit.data.redFlags.length,
            action_point_count: adapterHit.data.actionPoints.length,
          });
        }
      });
      response.ops.thread_ops.forEach((op) => {
        emitThreadOp(analyticsCtx, {
          op: op.op,
          topic_id: op.topic_id,
          ...(op.summary ? { summary: op.summary } : {}),
          ...(typeof op.timestamp_ms === 'number' ? { timestamp_ms: op.timestamp_ms } : {}),
        });
      });
      if (
        response.ops.profile_patch.length > 0 ||
        response.ops.routine_patch.length > 0 ||
        response.ops.experiment_events.length > 0
      ) {
        emitMemoryWritten(analyticsCtx, {
          profile_written: response.ops.profile_patch.length,
          routine_written: response.ops.routine_patch.length,
          experiment_written: response.ops.experiment_events.length,
        });
      }

      setError(null);

      const profilePatch = asObject(response.ops.profile_patch[0]) || null;
      const routinePatch = asObject(response.ops.routine_patch[0]) || null;
      const legacySessionPatch = asObject(response.legacy_session_patch) || null;
      const legacyProfilePatch = asObject((legacySessionPatch as any)?.profile) || null;
      const legacyMetaPatch = (() => {
        if (!legacySessionPatch) return null;
        const explicitMeta = asObject((legacySessionPatch as any).meta) || null;
        const extraEntries = Object.entries(legacySessionPatch).filter(([key]) => key !== 'profile' && key !== 'meta' && key !== 'next_state');
        if (!explicitMeta && extraEntries.length === 0) return null;
        return {
          ...(explicitMeta || {}),
          ...Object.fromEntries(extraEntries),
        };
      })();
      const nextSessionState = asString((legacySessionPatch as any)?.next_state);

      if (nextSessionState) setSessionState(nextSessionState);
      if (legacyMetaPatch) {
        setSessionMeta((prev) => ({
          ...(asObject(prev) || {}),
          ...legacyMetaPatch,
        }));
      }

      if (profilePatch || routinePatch || legacyProfilePatch) {
        setProfileSnapshot((prev) => {
          const base = asObject(prev) || {};
          return {
            ...base,
            ...(legacyProfilePatch || {}),
            ...(profilePatch || {}),
            ...(routinePatch || {}),
          };
        });

        setBootstrapInfo((prev) => {
          const merged: BootstrapInfo = prev
            ? { ...prev }
            : { profile: null, recent_logs: [], checkin_due: null, is_returning: null, db_ready: null };
          const baseProfile = asObject(merged.profile) || {};
          merged.profile = {
            ...baseProfile,
            ...(legacyProfilePatch || {}),
            ...(profilePatch || {}),
            ...(routinePatch || {}),
          };
          return merged;
        });
      }

      const assistantTextRaw = String(response.assistant_text || '');
      const assistantText = debug ? assistantTextRaw : stripInternalKbRefsFromText(assistantTextRaw);
      const telemetryUiLang = parseUiLanguageToken(response.telemetry.ui_language);
      const telemetryMatchLang = parseUiLanguageToken(response.telemetry.matching_language);
      const hasLanguageMismatch =
        response.telemetry.language_mismatch === true &&
        Boolean(telemetryUiLang) &&
        Boolean(telemetryMatchLang) &&
        telemetryUiLang !== telemetryMatchLang;
      const nowMs = Date.now();
      const shouldShowLanguageMismatchHint =
        hasLanguageMismatch &&
        langReplyMode !== 'auto_follow_input' &&
        nowMs >= langMismatchHintMutedUntilRef.current;
      const mismatchTargetUiLanguage = telemetryMatchLang || null;

      let autoFollowNotice = '';
      if (
        hasLanguageMismatch &&
        langReplyMode === 'auto_follow_input' &&
        mismatchTargetUiLanguage &&
        mismatchTargetUiLanguage !== language
      ) {
        const ctx: AnalyticsContext = {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: agentStateRef.current,
        };
        emitUiLanguageSwitched(ctx, {
          from_lang: toLangPref(language),
          to_lang: toLangPref(mismatchTargetUiLanguage),
        });
        setAppLanguage(toLangPref(mismatchTargetUiLanguage));
        autoFollowNotice =
          language === 'CN'
            ? `已按你的输入切换为${toUiLanguageName(mismatchTargetUiLanguage, 'CN')}回复。`
            : `Reply language switched to ${toUiLanguageName(mismatchTargetUiLanguage, 'EN')} to match your input.`;
      }

      let languageMismatchHintText = '';
      let languageMismatchHintChips: SuggestedChip[] = [];
      if (shouldShowLanguageMismatchHint && telemetryUiLang && telemetryMatchLang && mismatchTargetUiLanguage) {
        const nextMutedUntil = nowMs + LANGUAGE_MISMATCH_HINT_SNOOZE_MS;
        langMismatchHintMutedUntilRef.current = nextMutedUntil;
        setLangMismatchHintMutedUntil(nextMutedUntil);
        languageMismatchHintText =
          language === 'CN'
            ? `支持中英文混合对话。检测到本轮输入为${toUiLanguageName(telemetryMatchLang, 'CN')}，当前界面为${toUiLanguageName(telemetryUiLang, 'CN')}。请选择回复方式：`
            : `Mixed-language chat is supported. This turn looks ${toUiLanguageName(telemetryMatchLang, 'EN')} while UI is ${toUiLanguageName(telemetryUiLang, 'EN')}. Choose reply behavior:`;
        languageMismatchHintChips = buildLanguageMismatchStrategyChips({
          copyLanguage: language,
          currentUiLanguage: language,
          targetUiLanguage: mismatchTargetUiLanguage,
          telemetryUiLanguage: telemetryUiLang,
          telemetryMatchingLanguage: telemetryMatchLang,
        });
      }

      const toLegacyCard = (card: ChatCardV1): Card => ({
        card_id: card.id,
        type: card.type,
        title: card.title,
        payload: {
          ...(asObject((card as any).payload) || {}),
          title: card.title,
          ...(card.subtitle ? { subtitle: card.subtitle } : {}),
          priority: card.priority,
          tags: card.tags,
          sections: card.sections,
          actions: card.actions,
          safety: response.safety,
          telemetry: response.telemetry,
        },
      });

      const quickReplyToChip = (reply: QuickReplyV1): SuggestedChip => ({
        chip_id: reply.id,
        label: reply.label,
        kind: 'quick_reply',
        data: {
          action_id: reply.id,
          ...(reply.metadata || {}),
          reply_text: reply.value || reply.label,
          trigger_source: 'chip',
        },
      });

      const followUpToChips = (followUp: ChatResponseV1['follow_up_questions'][number]): SuggestedChip[] => {
        if (!Array.isArray(followUp.options) || followUp.options.length === 0) return [];
        return followUp.options.slice(0, 3).map((option) => ({
          chip_id: option.id,
          label: option.label,
          kind: 'quick_reply',
          data: {
            action_id: option.id,
            ...(option.metadata || {}),
            follow_up_id: followUp.id,
            follow_up_option_id: option.id,
            follow_up_question: followUp.question,
            follow_up_required: followUp.required,
            reply_text: option.value || option.label,
            trigger_source: 'chip',
          },
        }));
      };

      const suggestedChips = dedupeSuggestedChips(
        [
          ...response.suggested_quick_replies.map(quickReplyToChip),
          ...response.follow_up_questions.flatMap(followUpToChips),
        ],
        12,
      );

      const introHint = resolveIntroHintForLanguage(response.intro_hint, language);
      const hasStructuredCards = response.cards.length > 0;

      const nextItems: ChatItem[] = [];
      if (assistantText.trim() && !hasStructuredCards) {
        nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: assistantText });
      }
      if (introHint) {
        nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: introHint });
      }
      if (autoFollowNotice) {
        nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: autoFollowNotice });
      }
      if (languageMismatchHintText) {
        nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: languageMismatchHintText });
      }
      if (languageMismatchHintChips.length) {
        nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: languageMismatchHintChips });
      }

      const rawCards = response.cards.map(toLegacyCard);
      const gatedCards = filterRecommendationCardsForState(rawCards, agentStateRef.current);
      const cards = collapseAnalysisSummaryCards(collapsePhotoConfirmWhenAnalysisPresent(gatedCards));
      const hasAnalysisSummaryCard = cards.some((card) => String(card?.type || '').trim().toLowerCase() === 'analysis_summary');

      if (cards.length) {
        nextItems.push({
          id: nextId(),
          role: 'assistant',
          kind: 'cards',
          cards,
          meta: {
            request_id: response.request_id,
            trace_id: response.trace_id,
            events: [
              {
                event_name: 'intent_detected',
                data: {
                  intent: response.telemetry.intent,
                  confidence: response.telemetry.intent_confidence,
                },
              },
              ...response.ops.thread_ops.map((op) => ({
                event_name: op.op,
                data: {
                  topic_id: op.topic_id,
                  ...(op.summary ? { summary: op.summary } : {}),
                  ...(typeof op.timestamp_ms === 'number' ? { timestamp_ms: op.timestamp_ms } : {}),
                },
              })),
            ],
          },
        });
      }

      const suppressChips = cards.length
        ? cards.some((c) => {
            const t = String((c as any)?.type || '').toLowerCase();
            return t === 'analysis_summary' || t === 'profile' || t === 'diagnosis_gate';
          })
        : false;

      if (!suppressChips && suggestedChips.length) {
        nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: suggestedChips });
      }

      if (nextItems.length) {
        setItems((prev) => {
          const base = hasAnalysisSummaryCard
            ? removeAnalysisSummaryCardsFromHistory(removePhotoConfirmCardsFromHistory(prev))
            : prev;
          return [...base, ...nextItems];
        });
      }
    },
    [debug, headers.aurora_uid, headers.brief_id, headers.trace_id, langReplyMode, language],
  );

  const applyV2Response = useCallback(
    (response: { cards: Array<Record<string, unknown>>; ops?: Record<string, unknown>; next_actions?: unknown[] }) => {
      setError(null);
      const lang = language;
      if (response.ops && Array.isArray((response.ops as any).thread_ops)) {
        applyThreadOps((response.ops as any).thread_ops);
      }
      const nextItems: ChatItem[] = [];

      const resolveLocalizedString = (value: unknown): string => {
        if (typeof value === 'string') return value.trim();
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const obj = value as Record<string, unknown>;
          const localized = lang === 'CN' ? (obj.zh || obj.cn || obj.en) : (obj.en || obj.zh || obj.cn);
          return typeof localized === 'string' ? localized.trim() : '';
        }
        return '';
      };

      for (const card of response.cards) {
        const cardType = String((card as any).card_type || '').toLowerCase();

        if (cardType === 'text_response') {
          const sections = Array.isArray(card.sections) ? card.sections : [];
          const textParts: string[] = [];
          for (const sec of sections) {
            const section = sec && typeof sec === 'object' ? (sec as Record<string, unknown>) : null;
            if (!section) continue;
            const sectionType = String(section.type || '').toLowerCase();
            if (sectionType === 'text_answer') {
              const text = lang === 'CN'
                ? String(section.text_zh || section.text_en || section.text || '').trim()
                : String(section.text_en || section.text_zh || section.text || '').trim();
              if (text) textParts.push(text);
            } else if (sectionType === 'safety_notes') {
              const notes = Array.isArray(section.notes) ? section.notes : [];
              const safetyText = notes
                .map((n: unknown) => typeof n === 'string' ? n.trim() : '')
                .filter(Boolean)
                .map((n: string) => `⚠️ ${n}`)
                .join('\n');
              if (safetyText) textParts.push(safetyText);
            }
          }
          if (textParts.length) {
            nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: textParts.join('\n\n') });
          }
          continue;
        }

        if (cardType === 'aurora_ingredient_report') {
          const sections = Array.isArray(card.sections) ? card.sections : [];
          const sectionTypes = new Set(
            sections
              .filter((s: unknown) => s && typeof s === 'object')
              .map((s: unknown) => String((s as Record<string, unknown>).type || '')),
          );

          if (sectionTypes.has('ingredient_list')) {
            const ingredientLines: string[] = [];
            for (const sec of sections) {
              const section = sec && typeof sec === 'object' ? (sec as Record<string, unknown>) : null;
              if (!section || section.type !== 'ingredient_list') continue;
              const ingredients = Array.isArray(section.ingredients) ? section.ingredients : [];
              for (const ing of ingredients) {
                if (!ing || typeof ing !== 'object') continue;
                const i = ing as Record<string, unknown>;
                const name = String(i.name || '').trim();
                if (!name) continue;
                const pros = Array.isArray(i.pros) ? i.pros.filter((p: unknown) => typeof p === 'string' && p.trim()).slice(0, 2) : [];
                const cons = Array.isArray(i.cons) ? i.cons.filter((c: unknown) => typeof c === 'string' && c.trim()).slice(0, 2) : [];
                const evidence = String(i.evidence_level || '').trim();
                let line = `**${name}**`;
                if (pros.length) line += ` — ${(pros as string[]).join('; ')}`;
                if (cons.length) line += ` ⚠️ ${(cons as string[]).join('; ')}`;
                if (evidence && evidence !== 'uncertain') line += ` (${evidence})`;
                ingredientLines.push(line);
              }
            }
            if (ingredientLines.length) {
              const header = lang === 'CN' ? '**提到的成分：**' : '**Ingredients mentioned:**';
              nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: `${header}\n${ingredientLines.join('\n')}` });
            }
            continue;
          }

          if (sectionTypes.has('ingredient_overview')) {
            const parts: string[] = [];
            for (const sec of sections) {
              const s = sec && typeof sec === 'object' ? (sec as Record<string, unknown>) : null;
              if (!s) continue;
              const t = String(s.type || '');

              if (t === 'ingredient_overview') {
                const name = String(s.ingredient_name || '').trim();
                const inci = String(s.inci_name || '').trim();
                const desc = lang === 'CN'
                  ? String(s.description_zh || s.description_en || '').trim()
                  : String(s.description_en || s.description_zh || '').trim();
                const category = String(s.category || '').trim();
                let header = name ? `**${name}**` : '';
                if (inci && inci !== name) header += ` (${inci})`;
                if (category && category !== 'other') header += ` — ${category}`;
                if (header) parts.push(header);
                if (desc) parts.push(desc);
              }

              if (t === 'ingredient_benefits') {
                const benefits = Array.isArray(s.benefits) ? s.benefits : [];
                const lines = benefits
                  .map((b: unknown) => {
                    if (typeof b === 'string') return b.trim();
                    if (b && typeof b === 'object') {
                      const obj = b as Record<string, unknown>;
                      const text = lang === 'CN'
                        ? String(obj.benefit_zh || obj.benefit_en || '').trim()
                        : String(obj.benefit_en || obj.benefit_zh || '').trim();
                      const evidence = String(obj.evidence_level || '').trim();
                      return text ? (evidence && evidence !== 'uncertain' ? `${text} (${evidence})` : text) : '';
                    }
                    return '';
                  })
                  .filter(Boolean)
                  .slice(0, 5);
                if (lines.length) {
                  parts.push(`**${lang === 'CN' ? '功效' : 'Benefits'}:** ${lines.join('; ')}`);
                }
              }

              if (t === 'ingredient_claims') {
                const claims = Array.isArray(s.claims) ? s.claims : [];
                const lines = claims
                  .map((c: unknown) => {
                    if (!c || typeof c !== 'object') return '';
                    const obj = c as Record<string, unknown>;
                    const claim = lang === 'CN'
                      ? String(obj.text_zh || obj.text_en || '').trim()
                      : String(obj.text_en || obj.text_zh || '').trim();
                    const badge = String(obj.evidence_badge || '').trim();
                    return claim ? (badge ? `${claim} (${badge})` : claim) : '';
                  })
                  .filter(Boolean)
                  .slice(0, 4);
                if (lines.length) {
                  parts.push(`**${lang === 'CN' ? '证据' : 'Evidence'}:**\n${lines.map((l: string) => `- ${l}`).join('\n')}`);
                }
              }

              if (t === 'ingredient_usage') {
                const howTo = s.how_to_use;
                if (howTo && typeof howTo === 'object') {
                  const u = howTo as Record<string, unknown>;
                  const freq = String(u.frequency || '').trim();
                  const step = String(u.step || '').trim();
                  const tips = lang === 'CN'
                    ? (Array.isArray(u.tips_zh) && u.tips_zh.length ? u.tips_zh : Array.isArray(u.tips_en) ? u.tips_en : [])
                    : (Array.isArray(u.tips_en) && u.tips_en.length ? u.tips_en : Array.isArray(u.tips_zh) ? u.tips_zh : []);
                  const tipText = tips.filter((t: unknown) => typeof t === 'string' && t.trim()).slice(0, 3).join('; ');
                  const usageParts = [step, freq, tipText].filter(Boolean);
                  if (usageParts.length) {
                    parts.push(`**${lang === 'CN' ? '用法' : 'How to use'}:** ${usageParts.join(' · ')}`);
                  }
                }
              }

              if (t === 'ingredient_watchouts') {
                const watchouts = Array.isArray(s.watchouts) ? s.watchouts : [];
                const lines = watchouts
                  .map((w: unknown) => {
                    if (typeof w === 'string') return w.trim();
                    if (w && typeof w === 'object') {
                      const obj = w as Record<string, unknown>;
                      const text = lang === 'CN'
                        ? String(obj.text_zh || obj.text_en || '').trim()
                        : String(obj.text_en || obj.text_zh || '').trim();
                      const severity = String(obj.severity || '').trim();
                      return text ? (severity ? `${text} [${severity}]` : text) : '';
                    }
                    return '';
                  })
                  .filter(Boolean)
                  .slice(0, 3);
                if (lines.length) {
                  parts.push(`⚠️ **${lang === 'CN' ? '注意' : 'Watchouts'}:** ${lines.join('; ')}`);
                }
              }
            }

            if (parts.length) {
              nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: parts.join('\n\n') });
            }
            continue;
          }
        }

        const legacyCard: Card = {
          card_id: String((card as any).card_id || (card as any).id || `v2_${nextId()}`),
          type: cardType || 'unknown',
          title: String((card as any).title || ''),
          payload: {
            ...(card.metadata && typeof card.metadata === 'object' ? (card.metadata as Record<string, unknown>) : {}),
            sections: Array.isArray(card.sections) ? card.sections : [],
          },
        };
        nextItems.push({
          id: nextId(),
          role: 'assistant',
          kind: 'cards',
          cards: [legacyCard],
        });
      }

      const SKILL_TO_CHIP: Record<string, string> = {
        'ingredient.report': 'chip.start.ingredients.entry',
        'reco.step_based': 'chip.start.reco_products',
        'routine.apply_blueprint': 'chip.start.routine',
        'routine.intake_products': 'chip.start.routine',
        'routine.audit_optimize': 'chip.start.routine',
        'product.analyze': 'chip.start.evaluate',
        'dupe.suggest': 'chip.start.dupes',
        'dupe.compare': 'chip.start.dupes',
        'diagnosis_v2.start': 'chip.start.diagnosis',
        'tracker.checkin_log': 'chip_checkin_now',
        'explore.add_to_routine': 'chip.action.add_to_routine',
      };

      const nextActions = Array.isArray(response.next_actions) ? response.next_actions : [];
      const chips: SuggestedChip[] = [];
      for (const action of nextActions) {
        if (!action || typeof action !== 'object') continue;
        const a = action as Record<string, unknown>;
        const actionType = String(a.action_type || '').trim().toLowerCase();
        const label = resolveLocalizedString(a.label) || resolveLocalizedString(a.text);
        if (!label) continue;
        const targetSkillId = typeof a.target_skill_id === 'string' ? a.target_skill_id.trim() : '';
        const params = a.params && typeof a.params === 'object' ? (a.params as Record<string, unknown>) : undefined;
        const hasProductAnchor =
          Boolean(params && typeof params.product_anchor === 'object' && !Array.isArray(params.product_anchor));

        if (actionType === 'trigger_photo') {
          chips.push({
            chip_id: 'chip.intake.upload_photos',
            label,
            kind: 'quick_reply',
            data: { client_action: 'open_camera', reply_text: label, trigger_source: 'chip' },
          });
          continue;
        }

        const chipId =
          targetSkillId === 'explore.add_to_routine' && !hasProductAnchor
            ? undefined
            : (targetSkillId && SKILL_TO_CHIP[targetSkillId]) || undefined;
        if (chipId) {
          chips.push({
            chip_id: chipId,
            label,
            kind: 'quick_reply',
            data: {
              action_id: chipId,
              ...(params ? { ...params } : {}),
              reply_text: label,
              trigger_source: 'chip',
            },
          });
          continue;
        }

        chips.push({
          chip_id: `v2_chip_${nextId()}`,
          label,
          kind: 'quick_reply',
          data: {
            ...(params ? { ...params } : {}),
            reply_text: label,
            trigger_source: 'chip',
            v2_freeform_fallback: true,
          },
        });
      }
      if (chips.length) {
        nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: chips.slice(0, 12) });
      }

      if (nextItems.length) {
        setItems((prev) => [...prev, ...nextItems]);
      }
    },
    [applyThreadOps, language],
  );

  const tryApplyEnvelopeFromBffError = useCallback(
    (err: unknown) => {
      if (!(err instanceof PivotaAgentBffError)) return false;
      const body = err.responseBody;
      if (!body || typeof body !== 'object') return false;
      const parsedV1 = parseChatResponseV1(body);
      if (parsedV1) {
        applyChatResponseV1(parsedV1);
        return true;
      }
      const env = body as any;
      if (typeof env.request_id !== 'string' || !Array.isArray(env.cards)) return false;
      applyEnvelope(env as V1Envelope);
      return true;
    },
    [applyChatResponseV1, applyEnvelope],
  );

  const bootstrap = useCallback(async () => {
    setChatBusy(true);
    try {
      const requestHeaders = { ...headers, lang: language };
      const langPref = toLangPref(language);
      const env = await bffJson<V1Envelope>('/v1/session/bootstrap', requestHeaders, { method: 'GET' });
      const info = readBootstrapInfo(env);
      setBootstrapInfo(info);
      const profile = info?.profile;
      if (profile) setProfileSnapshot(profile);
      const isReturning = Boolean(info?.is_returning);
      const returnWelcomeSummary = buildReturnWelcomeSummary({
        profile,
        recent_logs: info?.recent_logs ?? [],
        checkin_due: info?.checkin_due,
        language,
      });

      const analyticsCtx: AnalyticsContext = {
        brief_id: headers.brief_id,
        trace_id: headers.trace_id,
        aurora_uid: headers.aurora_uid,
        lang: langPref,
        state: agentState,
      };

      if (!sessionStartedEmittedRef.current) {
        sessionStartedEmittedRef.current = true;
        emitUiSessionStarted(analyticsCtx, {
          referrer: (() => {
            try {
              return document.referrer || undefined;
            } catch {
              return undefined;
            }
          })(),
          device: (() => {
            try {
              return navigator.userAgent || undefined;
            } catch {
              return undefined;
            }
          })(),
          is_returning: isReturning,
        });
      }

      if (isReturning && !returnVisitEmittedRef.current) {
        returnVisitEmittedRef.current = true;
        const currentRoutine = profile ? (profile as any).currentRoutine : null;
        emitUiReturnVisit(analyticsCtx, {
          days_since_last: returnWelcomeSummary.days_since_last ?? 0,
          has_active_plan:
            typeof currentRoutine === 'string' ? Boolean(currentRoutine.trim()) : Boolean(currentRoutine),
          has_checkin_due: Boolean(info?.checkin_due),
        });
      }

      const lang = language === 'CN' ? 'CN' : 'EN';
      const intro =
        lang === 'CN'
          ? `你好，我是你的护肤搭子。${isReturning ? '欢迎回来！' : ''}你想先做什么？`
          : `Hi — I’m your skincare partner. ${isReturning ? 'Welcome back! ' : ''}What would you like to do?`;

      const startChips: SuggestedChip[] = [
        {
          chip_id: 'chip_quick_profile',
          label: lang === 'CN' ? '30秒快速画像' : '30-sec quick profile',
          kind: 'quick_reply',
          data: { trigger_source: 'chip' },
        },
        {
          chip_id: 'chip.start.diagnosis',
          label: lang === 'CN' ? '开始皮肤诊断' : 'Start skin diagnosis',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '开始皮肤诊断' : 'Start skin diagnosis' },
        },
        {
          chip_id: 'chip.start.reco_products',
          label: lang === 'CN' ? '推荐一些产品（例如：提亮精华）' : 'Recommend a few products (e.g., brightening serum)',
          kind: 'quick_reply',
          data: {
            reply_text: lang === 'CN' ? '推荐一些产品（例如：提亮精华）' : 'Recommend a few products (e.g., brightening serum)',
            include_alternatives: true,
          },
        },
        {
          chip_id: 'chip.start.routine',
          label: lang === 'CN' ? '生成早晚护肤 routine' : 'Build an AM/PM routine',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '生成一套早晚护肤 routine' : 'Build an AM/PM skincare routine', include_alternatives: true },
        },
        {
          chip_id: 'chip.start.evaluate',
          label: lang === 'CN' ? '评估某个产品适合吗' : 'Evaluate a specific product for me',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '评估这款产品是否适合我' : 'Evaluate a specific product for me' },
        },
        {
          chip_id: 'chip.start.dupes',
          label: lang === 'CN' ? '找平替/更便宜替代品' : 'Find dupes / cheaper alternatives',
          kind: 'quick_reply',
          data: { reply_text: lang === 'CN' ? '帮我找平替并比较 tradeoffs' : 'Find dupes/cheaper alternatives' },
        },
        {
          chip_id: 'chip.start.ingredients.entry',
          label: lang === 'CN' ? '成分机理/证据链' : 'Ingredient science (evidence)',
          kind: 'quick_reply',
          data: {
            reply_text:
              lang === 'CN'
                ? '我想聊成分科学（证据/机制），先不做产品推荐。'
                : 'I want ingredient science (evidence/mechanism), not product recommendations yet.',
          },
        },
      ];

      if (!hasBootstrapped) {
        if (FF_RETURN_WELCOME && isReturning) {
          setItems([
            { id: nextId(), role: 'assistant', kind: 'text', content: intro },
            { id: nextId(), role: 'assistant', kind: 'return_welcome', summary: returnWelcomeSummary },
          ]);
        } else {
          setItems([
            { id: nextId(), role: 'assistant', kind: 'text', content: intro },
            {
              id: nextId(),
              role: 'assistant',
              kind: 'text',
              content: formatProfileLine(profile, language),
            },
            { id: nextId(), role: 'assistant', kind: 'chips', chips: startChips },
          ]);
        }
        setHasBootstrapped(true);
      }
    } catch (err) {
      if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatBusy(false);
    }
  }, [agentState, hasBootstrapped, headers, language, tryApplyEnvelopeFromBffError]);

  const startNewChat = useCallback(() => {
    setError(null);
    setSessionState('idle');
    setAgentStateSafe('IDLE_CHAT');
    setQuickProfileStep('skin_feel');
    setQuickProfileDraft({});
    setQuickProfileBusy(false);
    setChatBusy(false);
    setAnalysisBusy(false);
    setRoutineFormBusy(false);
    setItems([]);
    setAnalysisPhotoRefs([]);
    setSessionPhotos({});
    setBootstrapInfo(null);
    setIngredientQuestionBusy(false);
    pendingActionAfterDiagnosisRef.current = null;
    sessionStartedEmittedRef.current = false;
    returnVisitEmittedRef.current = false;
    openIntentConsumedRef.current = null;
    actionIntentConsumedRef.current = null;
    setHasBootstrapped(false);
  }, [setAgentStateSafe]);

  useEffect(() => {
    if (!hasBootstrapped) return;
    // If the user toggles language before interacting, restart so the intro/chips match.
    const hasUserInteracted = items.some((it) => it.role === 'user');
    if (!hasUserInteracted) startNewChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const bootstrappingRef = useRef(false);
  useEffect(() => {
    if (hasBootstrapped) return;
    if (bootstrappingRef.current) return;
    bootstrappingRef.current = true;
    bootstrap().finally(() => {
      bootstrappingRef.current = false;
    });
  }, [bootstrap, hasBootstrapped]);

  useEffect(() => {
    if (!profileSheetOpen) return;
    const p = profileSnapshot ?? bootstrapInfo?.profile;
    const meds = asArray((p as any)?.high_risk_medications)
      .map((item) => asString(item))
      .filter(Boolean) as string[];
    setProfileDraft({
      region: asString(p?.region) ?? '',
      budgetTier: asString(p?.budgetTier) ?? '',
      age_band: asString((p as any)?.age_band) ?? 'unknown',
      high_risk_medications_text: meds.join(', '),
    });
  }, [profileSheetOpen, bootstrapInfo, profileSnapshot]);

  const saveProfile = useCallback(async () => {
    setChatBusy(true);
    try {
      const patch = buildProfileUpdatePatch(profileDraft);

      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
        method: 'POST',
        body: JSON.stringify(patch),
        timeoutMs: PROFILE_UPDATE_TIMEOUT_MS,
      });

      const info = readBootstrapInfo(env);
      const nextProfile = info?.profile ?? asObject((env.session_patch as Record<string, unknown> | undefined)?.profile) ?? null;
      if (nextProfile) {
        setProfileSnapshot(nextProfile);
        setBootstrapInfo((prev) => {
          const merged: BootstrapInfo = prev
            ? { ...prev }
            : { profile: null, recent_logs: [], checkin_due: null, is_returning: null, db_ready: null };
          merged.profile = nextProfile;
          return merged;
        });
      }
      setProfileSheetOpen(false);
      toast({
        title: language === 'CN' ? '资料已更新' : 'Profile updated',
      });
    } catch (err) {
      if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatBusy(false);
    }
  }, [headers, language, profileDraft, tryApplyEnvelopeFromBffError]);

  const updateProfileWithTimeout = useCallback(
    async (patch: Record<string, unknown>): Promise<void> => {
      const requestHeaders = { ...headers, lang: language };
      await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
        method: 'POST',
        body: JSON.stringify(patch),
        timeoutMs: PROFILE_UPDATE_TIMEOUT_MS,
      });
    },
    [headers, language],
  );

  const onIngredientQuestionSelect = useCallback(
    async (selection: IngredientReportQuestionSelection) => {
      const questionId = asString(selection.questionId);
      const chip = asString(selection.chip);
      if (!questionId || !chip) return;

      const patch: Record<string, unknown> = {};
      const fitProfile = profileSnapshot ?? bootstrapInfo?.profile ?? null;
      if (questionId === 'goal') {
        const mapped = mapIngredientGoalChipToProfileGoal(chip);
        if (!mapped) return;
        const existingGoals = normalizeProfileGoals(asObject(fitProfile)?.goals ?? (fitProfile as any)?.goals);
        patch.goals = normalizeProfileGoals([mapped, ...existingGoals]).slice(0, 3);
      } else if (questionId === 'sensitivity') {
        const mapped = mapIngredientSensitivityChipToProfileSensitivity(chip);
        if (!mapped) return;
        patch.sensitivity = mapped;
      } else {
        return;
      }

      const profileSnapshotBeforeUpdate = profileSnapshot;
      const hadBootstrapInfo = Boolean(bootstrapInfo);
      const bootstrapProfileBeforeUpdate = hadBootstrapInfo ? asObject(bootstrapInfo?.profile) ?? null : null;
      setIngredientQuestionBusy(true);

      // Optimistic profile update so "Next questions" can auto-hide immediately after required fields are filled.
      setProfileSnapshot((prev) => {
        const base = asObject(prev) ?? {};
        return { ...base, ...patch };
      });
      setBootstrapInfo((prev) => {
        const merged: BootstrapInfo = prev
          ? { ...prev }
          : { profile: null, recent_logs: [], checkin_due: null, is_returning: null, db_ready: null };
        const baseProfile = asObject(merged.profile) ?? {};
        merged.profile = { ...baseProfile, ...patch };
        return merged;
      });

      try {
        await updateProfileWithTimeout(patch);

        toast({
          title: language === 'CN' ? '已记录偏好' : 'Preference saved',
          description:
            language === 'CN'
              ? '已用于后续成分适配度分析。'
              : 'This will be used for ingredient skin-fit analysis.',
        });
      } catch {
        setProfileSnapshot(profileSnapshotBeforeUpdate);
        setBootstrapInfo((prev) => {
          if (!hadBootstrapInfo) return null;
          const merged: BootstrapInfo = prev
            ? { ...prev }
            : { profile: null, recent_logs: [], checkin_due: null, is_returning: null, db_ready: null };
          merged.profile = bootstrapProfileBeforeUpdate;
          return merged;
        });

        const failureMessage =
          language === 'CN'
            ? '保存超时/失败，请重试；暂未应用到你的画像。'
            : 'Save timed out/failed. Please retry; profile was not updated.';
        setError(failureMessage);
        toast({
          title: language === 'CN' ? '保存失败' : 'Save failed',
          description: failureMessage,
        });
      } finally {
        setIngredientQuestionBusy(false);
      }
    },
    [bootstrapInfo, language, profileSnapshot, updateProfileWithTimeout],
  );

  const saveCheckin = useCallback(async () => {
    setChatBusy(true);
    try {
      const payload: Record<string, unknown> = {
        redness: Math.max(0, Math.min(5, Math.trunc(checkinDraft.redness))),
        acne: Math.max(0, Math.min(5, Math.trunc(checkinDraft.acne))),
        hydration: Math.max(0, Math.min(5, Math.trunc(checkinDraft.hydration))),
      };
      if (checkinDraft.notes.trim()) payload.notes = checkinDraft.notes.trim();

      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/tracker/log', requestHeaders, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const refreshHint = asObject(env.reco_refresh_hint);
      const shouldRefreshReco = (refreshHint as any)?.should_refresh === true;
      const refreshReason = asString((refreshHint as any)?.reason) || 'checkin_logged';

      setItems((prev) => [
        ...prev,
        { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '今日打卡' : 'Daily check-in' },
      ]);
      applyEnvelope(env);
      if (shouldRefreshReco) {
        const refreshChip: SuggestedChip = {
          chip_id: 'chip.start.reco_products',
          label: language === 'CN' ? '按最新打卡刷新推荐' : 'Refresh recommendations',
          kind: 'quick_reply',
          data: {
            reply_text:
              language === 'CN'
                ? '根据我最新打卡刷新推荐，并说明你参考了哪些变化。'
                : 'Refresh recommendations based on my latest check-in and show what changed.',
            reco_refresh_reason: refreshReason,
            include_alternatives: true,
          },
        };
        setItems((prev) => [...prev, { id: nextId(), role: 'assistant', kind: 'chips', chips: [refreshChip] }]);
      }
      setCheckinSheetOpen(false);
    } catch (err) {
      if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatBusy(false);
    }
  }, [applyEnvelope, checkinDraft, headers, language, tryApplyEnvelopeFromBffError]);

  const refreshBootstrapInfo = useCallback(async () => {
    try {
      const latestAuthToken = loadAuroraAuthSession()?.token || undefined;
      const requestHeaders = {
        ...headers,
        lang: language,
        auth_token: latestAuthToken,
      };
      const env = await bffJson<V1Envelope>('/v1/session/bootstrap', requestHeaders, { method: 'GET' });
      const info = readBootstrapInfo(env);
      if (info) setBootstrapInfo(info);
      if (info?.profile) setProfileSnapshot(info.profile);
    } catch {
      // ignore
    }
  }, [headers, language]);

  useEffect(() => {
    const handleAuthSessionChanged = () => {
      const nextSession = loadAuroraAuthSession();
      setAuthSession(nextSession);
      setAuthMode('code');
      setAuthStage('email');
      setAuthError(null);
      setAuthNotice(null);
      setAuthDraft({
        email: nextSession?.email ?? '',
        code: '',
        password: '',
        newPassword: '',
        newPasswordConfirm: '',
      });
      void refreshBootstrapInfo();
    };

    window.addEventListener(AURORA_AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
    return () => window.removeEventListener(AURORA_AUTH_SESSION_CHANGED_EVENT, handleAuthSessionChanged);
  }, [refreshBootstrapInfo]);

  const persistQuickProfilePatch = useCallback(
    async (profilePatch: QuickProfileProfilePatch, auroraProfilePatch: Record<string, unknown> | null) => {
      if (auroraProfilePatch) {
        try {
          const requestHeaders = { ...headers, lang: language };
          await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
            method: 'POST',
            body: JSON.stringify(auroraProfilePatch),
            timeoutMs: PROFILE_UPDATE_TIMEOUT_MS,
          });
        } catch (err) {
          if (debug) {
            console.warn('[QuickProfile] /v1/profile/update failed', err);
          }
          toast({
            title: language === 'CN' ? '已继续流程' : 'Progress saved locally',
            description:
              language === 'CN'
                ? '画像已临时保存在当前会话。云端同步失败，可稍后登录后刷新。'
                : 'Quick profile continued in this session. Cloud sync failed; sign in and refresh later.',
          });
        }
      }

      try {
        await patchGlowSessionProfile(
          { brief_id: headers.brief_id, trace_id: headers.trace_id },
          profilePatch,
        );
      } catch (err) {
        if (debug) {
          console.warn('[QuickProfile] legacy /session/profile/patch failed', err);
        }
      }
    },
    [debug, headers, language],
  );

  const startAuth = useCallback(async () => {
    const email = authDraft.email.trim();
    if (!email) {
      setAuthError(language === 'CN' ? '请输入邮箱。' : 'Please enter your email.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      await bffJson<V1Envelope>('/v1/auth/start', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setAuthStage('code');
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.email, headers, language]);

  const verifyAuth = useCallback(async () => {
    const email = authDraft.email.trim();
    const code = authDraft.code.trim();
    if (!email || !code) {
      setAuthError(language === 'CN' ? '请输入邮箱和验证码。' : 'Please enter email + code.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/auth/verify', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });

      const sessionCard = Array.isArray(env.cards) ? env.cards.find((c) => c && c.type === 'auth_session') : null;
      const token = asString(sessionCard && (sessionCard.payload as any)?.token) || '';
      const userEmail = asString(sessionCard && (sessionCard.payload as any)?.user?.email) || email;
      const expiresAt = asString(sessionCard && (sessionCard.payload as any)?.expires_at) || null;
      if (!token) throw new Error('Missing auth token from server.');

      const nextSession = { token, email: userEmail, expires_at: expiresAt };
      saveAuroraAuthSession(nextSession);
      setAuthSession(nextSession);
      setAuthDraft((prev) => ({ ...prev, code: '' }));
      setAuthSheetOpen(false);
      await refreshBootstrapInfo();
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.code, authDraft.email, headers, language, refreshBootstrapInfo]);

  const passwordLogin = useCallback(async () => {
    const email = authDraft.email.trim();
    const password = authDraft.password;
    if (!email || !password) {
      setAuthError(language === 'CN' ? '请输入邮箱和密码。' : 'Please enter email + password.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/auth/password/login', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const sessionCard = Array.isArray(env.cards) ? env.cards.find((c) => c && c.type === 'auth_session') : null;
      const token = asString(sessionCard && (sessionCard.payload as any)?.token) || '';
      const userEmail = asString(sessionCard && (sessionCard.payload as any)?.user?.email) || email;
      const expiresAt = asString(sessionCard && (sessionCard.payload as any)?.expires_at) || null;
      if (!token) throw new Error('Missing auth token from server.');

      const nextSession = { token, email: userEmail, expires_at: expiresAt };
      saveAuroraAuthSession(nextSession);
      setAuthSession(nextSession);
      setAuthDraft((prev) => ({ ...prev, password: '' }));
      setAuthSheetOpen(false);
      await refreshBootstrapInfo();
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.email, authDraft.password, headers, language, refreshBootstrapInfo]);

  const savePassword = useCallback(async () => {
    const password = authDraft.newPassword;
    const confirm = authDraft.newPasswordConfirm;
    if (!password || password.length < 8) {
      setAuthError(language === 'CN' ? '密码至少 8 位。' : 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setAuthError(language === 'CN' ? '两次输入的密码不一致。' : "Passwords don't match.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/auth/password/set', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      const passwordCard = Array.isArray(env?.cards)
        ? env.cards.find((c) => c && typeof c === 'object' && (c as any).type === 'auth_password_set')
        : null;
      const passwordSetOk = Boolean((passwordCard as any)?.payload?.ok);
      if (!passwordSetOk) {
        throw new Error(language === 'CN' ? '服务器未确认密码已更新，请重试。' : 'Server did not confirm password update. Please retry.');
      }

      const serverMessageRaw = asString(env?.assistant_message?.content);
      const serverMessageTrimmed = serverMessageRaw ? serverMessageRaw.trim() : '';
      const serverMessage = serverMessageTrimmed.length >= MIN_ACTIONABLE_NOTICE_LEN ? serverMessageTrimmed : '';
      const notice =
        serverMessage ||
        (language === 'CN'
          ? '密码已设置成功。下次可用邮箱 + 密码直接登录（验证码仍可用）。'
          : 'Password updated successfully. Next time you can sign in with email + password (OTP still works).');
      setAuthDraft((prev) => ({ ...prev, newPassword: '', newPasswordConfirm: '' }));
      setAuthNotice(notice);
      toast({
        title: language === 'CN' ? '密码已设置' : 'Password updated',
        description: notice,
      });
    } catch (err) {
      setAuthError(toBffErrorMessage(err));
    } finally {
      setAuthLoading(false);
    }
  }, [authDraft.newPassword, authDraft.newPasswordConfirm, headers, language]);

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const requestHeaders = { ...headers, lang: language };
      await bffJson<V1Envelope>('/v1/auth/logout', requestHeaders, { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearAuroraAuthSession();
      setAuthSession(null);
      setAuthStage('email');
      setAuthDraft({ email: '', code: '', password: '', newPassword: '', newPasswordConfirm: '' });
      setAuthSheetOpen(false);
      setAuthLoading(false);
      await refreshBootstrapInfo();
    }
  }, [headers, language, refreshBootstrapInfo]);

  const handlePickPhoto = useCallback(() => {
    setPromptRoutineAfterPhoto(false);
    setPhotoSheetAutoOpenSlot(null);
    setPhotoSheetOpen(true);
  }, [setPhotoSheetOpen]);

  const uploadPhotoViaProxy = useCallback(
    async ({ file, slotId, consent }: { file: File; slotId: string; consent: boolean }) => {
      setPhotoUploading(true);
      let result: AnalysisPhotoRef | null = null;
      try {
        const requestHeaders = { ...headers, lang: language };
        const form = new FormData();
        form.append('slot_id', slotId);
        form.append('consent', consent ? 'true' : 'false');
        form.append('photo', file, file.name || `photo_${slotId}.jpg`);

        const confirmEnv = await bffJson<V1Envelope>('/v1/photos/upload', requestHeaders, {
          method: 'POST',
          body: form,
        });
        applyEnvelope(confirmEnv);

        const confirmCard = confirmEnv.cards.find((c) => c && c.type === 'photo_confirm');
        const qcStatus = normalizePhotoQcStatus(asString(confirmCard && (confirmCard.payload as any)?.qc_status));
        const photoId = asString(confirmCard && (confirmCard.payload as any)?.photo_id);

        if (isPhotoUsableForDiagnosis(qcStatus) && photoId) {
          result = { slot_id: slotId, photo_id: photoId, qc_status: qcStatus };
          setAnalysisPhotoRefs((prev) => {
            const next = prev.filter((p) => p.slot_id !== slotId);
            next.push({ slot_id: slotId, photo_id: photoId, qc_status: qcStatus });
            return next.slice(0, 4);
          });
        }
        return result;
      } catch (err) {
        if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
        return result;
      } finally {
        setPhotoUploading(false);
      }
    },
    [applyEnvelope, headers, language, tryApplyEnvelopeFromBffError],
  );

  const onPhotoAction = useCallback(
    async (actionId: string, data?: Record<string, any>) => {
      if (actionId === 'photo_skip') {
        setPhotoSheetOpen(false);
        const shouldPrompt = promptRoutineAfterPhoto;
        setPromptRoutineAfterPhoto(false);
        if (shouldPrompt) {
          setItems((prev) => [
            ...prev,
            { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '跳过照片' : 'Skip photos' },
          ]);
          const prompt =
            language === 'CN'
              ? '没关系 ✅ 为了把分析做得更准，我强烈建议你把最近在用的产品/步骤也补充一下（AM/PM：洁面/活性/保湿/SPF，名字或链接都行）。你也可以先跳过，我会给低置信度的通用 7 天基线（不做评分/不推推荐）。'
              : "No worries ✅ To make this accurate, I strongly recommend sharing your current products/steps (AM/PM: cleanser/actives/moisturizer/SPF — names or links). Or you can skip and I’ll give a low-confidence 7‑day baseline (no scoring, no recommendations).";
          const chips: SuggestedChip[] = [
            {
              chip_id: 'chip.intake.paste_routine',
              label: language === 'CN' ? '填写 AM/PM 产品（更准）' : 'Add AM/PM products (more accurate)',
              kind: 'quick_reply',
              data: {},
            },
            {
              chip_id: 'chip.intake.skip_analysis',
              label: language === 'CN' ? '直接分析（低置信度）' : 'Skip and analyze (low confidence)',
              kind: 'quick_reply',
              data: {},
            },
          ];
          setItems((prev) => [
            ...prev,
            { id: nextId(), role: 'assistant', kind: 'text', content: prompt },
            { id: nextId(), role: 'assistant', kind: 'chips', chips },
          ]);
        }
        return;
      }
      if (actionId !== 'photo_upload') {
        setError(language === 'CN' ? '暂不支持该照片操作。' : 'That photo action is not supported yet.');
        return;
      }

      const consent = Boolean(data?.consent);
      if (!consent) {
        setError(language === 'CN' ? '需要勾选同意后才能上传。' : 'Please consent before uploading.');
        return;
      }

      const photos = (data?.photos && typeof data.photos === 'object' ? data.photos : {}) as Record<string, any>;
      const entries: Array<{ slotId: string; file: File }> = [];
      if (photos.daylight?.file instanceof File) entries.push({ slotId: 'daylight', file: photos.daylight.file });
      if (photos.indoor_white?.file instanceof File) entries.push({ slotId: 'indoor_white', file: photos.indoor_white.file });

      if (!entries.length) return;
      setSessionPhotos({ daylight: photos.daylight, indoor_white: photos.indoor_white });

      const uploadedPassedRefs: AnalysisPhotoRef[] = [];
      for (const entry of entries) {
        const slotLabel =
          entry.slotId === 'daylight'
            ? language === 'CN'
              ? '自然光'
              : 'daylight'
            : language === 'CN'
              ? '室内白光'
              : 'indoor white';
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: language === 'CN' ? `上传照片（${slotLabel}）` : `Upload photo (${slotLabel})`,
          },
        ]);
        const uploaded = await uploadPhotoViaProxy({ file: entry.file, slotId: entry.slotId, consent });
        if (uploaded && isPhotoUsableForDiagnosis(uploaded.qc_status) && uploaded.photo_id) uploadedPassedRefs.push(uploaded);
      }

      setPhotoSheetOpen(false);
      const existingPhotos: AnalysisPhotoRef[] = analysisPhotoRefs
        .map((p) => ({
          slot_id: String(p?.slot_id || '').trim(),
          photo_id: String(p?.photo_id || '').trim(),
          qc_status: normalizePhotoQcStatus(p?.qc_status),
        }))
        .filter((p) => p.slot_id && p.photo_id)
        .slice(0, 4);
      const photosForAnalysis = mergeAnalysisPhotoRefs(existingPhotos, uploadedPassedRefs);
      if (photosForAnalysis.length > 0) {
        setPromptRoutineAfterPhoto(false);
        const profileCurrentRoutine = (profileSnapshot ?? bootstrapInfo?.profile)?.currentRoutine;
        const hasCurrentRoutine =
          typeof profileCurrentRoutine === 'string'
            ? Boolean(profileCurrentRoutine.trim())
            : Boolean(profileCurrentRoutine && typeof profileCurrentRoutine === 'object');
        setAnalysisBusy(true);
        setThinkingSteps([{
          step: 'sim_0',
          message: language === 'CN' ? '正在上传照片并分析肤况...' : 'Uploading photos and analyzing skin...',
          completed: false,
        }]);
        setError(null);
        const stopPhotoSim = startSimulatedThinking(ANALYSIS_SIM_STEPS[language] || ANALYSIS_SIM_STEPS.EN, setThinkingSteps);
        try {
          setSessionState('S4_ANALYSIS_LOADING');
          const requestHeaders = { ...headers, lang: language };
          const body: Record<string, unknown> = {
            use_photo: true,
            photos: photosForAnalysis,
            ...(hasCurrentRoutine ? { currentRoutine: profileCurrentRoutine } : {}),
          };
          const env = await retryWithBackoff(
            () => bffJson<V1Envelope>('/v1/analysis/skin', requestHeaders, {
              method: 'POST',
              body: JSON.stringify(body),
              timeoutMs: ANALYSIS_REQUEST_TIMEOUT_MS,
            }),
            { maxRetries: 1, baseDelayMs: 1500 },
          );
          applyEnvelope(env);
        } catch (err) {
          if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
        } finally {
          stopPhotoSim();
          setAnalysisBusy(false);
          setThinkingSteps([]);
        }
        return;
      }

      if (promptRoutineAfterPhoto) {
        setPromptRoutineAfterPhoto(false);
        const prompt =
          language === 'CN'
            ? '照片已收到 ✅ 为了把分析做得更准，我强烈建议你把最近在用的产品/步骤也补充一下（AM/PM：洁面/活性/保湿/SPF，名字或链接都行）。你也可以先跳过，我会给低置信度的通用 7 天基线（不做评分/不推推荐）。'
            : "Photo received ✅ To make this accurate, I strongly recommend sharing your current products/steps (AM/PM: cleanser/actives/moisturizer/SPF — names or links). Or you can skip and I’ll give a low-confidence 7‑day baseline (no scoring, no recommendations).";
        const chips: SuggestedChip[] = [
          {
            chip_id: 'chip.intake.paste_routine',
            label: language === 'CN' ? '填写 AM/PM 产品（更准）' : 'Add AM/PM products (more accurate)',
            kind: 'quick_reply',
            data: {},
          },
          {
            chip_id: 'chip.intake.skip_analysis',
            label: language === 'CN' ? '直接分析（低置信度）' : 'Skip and analyze (low confidence)',
            kind: 'quick_reply',
            data: {},
          },
        ];
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', kind: 'text', content: prompt },
          { id: nextId(), role: 'assistant', kind: 'chips', chips },
        ]);
      }
    },
    [
      analysisPhotoRefs,
      applyEnvelope,
      bootstrapInfo?.profile,
      profileSnapshot,
      headers,
      language,
      promptRoutineAfterPhoto,
      tryApplyEnvelopeFromBffError,
      uploadPhotoViaProxy,
    ],
  );

  const getSanitizedAnalysisPhotos = useCallback(() => {
    return analysisPhotoRefs
      .map((p) => ({
        slot_id: String(p?.slot_id || '').trim(),
        photo_id: String(p?.photo_id || '').trim(),
        qc_status: normalizePhotoQcStatus(p?.qc_status),
      }))
      .filter((p) => p.slot_id && p.photo_id)
      .slice(0, 4);
  }, [analysisPhotoRefs]);

  const getLatestAnalysisStorySnapshot = useCallback((): Record<string, unknown> | null => {
    for (let index = itemsRef.current.length - 1; index >= 0; index -= 1) {
      const item = itemsRef.current[index];
      if (!item || item.kind !== 'cards') continue;
      const storyCard = item.cards.find((card) => card && card.type === 'analysis_story_v2');
      if (!storyCard || !storyCard.payload || typeof storyCard.payload !== 'object' || Array.isArray(storyCard.payload)) {
        continue;
      }
      try {
        return JSON.parse(JSON.stringify(storyCard.payload)) as Record<string, unknown>;
      } catch {
        return storyCard.payload as Record<string, unknown>;
      }
    }
    return null;
  }, []);
  const sendChat = useCallback(
    async (
      message?: string,
      action?: V1Action,
      opts?: {
        client_state?: AgentState;
        requested_transition?: RequestedTransition | null;
        thread_state?: Record<string, unknown> | null;
        analysisContext?: ChatSessionAnalysisContext | null;
      },
    ) => {
      setLoadingIntent(inferAuroraLoadingIntent(message, action));
      setChatBusy(true);
      setThinkingSteps([{
        step: 'sim_0',
        message: language === 'CN' ? '正在读取你的档案...' : 'Reading your profile...',
        completed: false,
      }]);
      setStreamedText('');
      const timeoutMs = isRoutineChatAction(action) ? ROUTINE_CHAT_TIMEOUT_MS : CHAT_TIMEOUT_MS;
      try {
        const requestHeaders = { ...headers, lang: language };
        const session = buildChatSession({
          state: sessionState,
          profileSnapshot,
          bootstrapProfile: bootstrapInfo?.profile ?? null,
          sessionProfilePatch: pendingLocationSessionProfilePatchRef.current,
          sessionMeta,
          analysisContext: opts?.analysisContext ?? null,
        });
        const priorMessages = buildChatRequestMessages(itemsRef.current);
        const body: Record<string, unknown> = {
          session,
          ...(message ? { message } : {}),
          ...(action ? { action } : {}),
          language,
          client_state: normalizeAgentState(opts?.client_state ?? agentState),
          ...(priorMessages.length ? { messages: priorMessages } : {}),
          ...(opts?.requested_transition ? { requested_transition: opts.requested_transition } : {}),
          ...(opts?.thread_state && Object.keys(opts.thread_state).length > 0
            ? { thread_state: opts.thread_state }
            : Object.keys(threadStateRef.current).length > 0
              ? { thread_state: threadStateRef.current }
              : {}),
          ...(debug ? { debug: true } : {}),
          ...(anchorProductId ? { anchor_product_id: anchorProductId } : {}),
          ...(anchorProductUrl ? { anchor_product_url: anchorProductUrl } : {}),
        };

        let parsedStreamResponse: ChatResponseV1 | null = null;
        let parsedStreamV2: { cards: Array<Record<string, unknown>>; ops: Record<string, unknown>; next_actions: unknown[] } | null = null;
        let usedStream = false;

        if (!streamEndpointDisabledRef.current) {
          try {
            await bffChatStream(requestHeaders, body, {
              onThinking: (event) => {
                setThinkingSteps((prev) => {
                  const updated = prev.map((s) => ({ ...s, completed: true }));
                  return [...updated, { step: event.step, message: event.message, completed: false }];
                });
              },
              onChunk: (event) => {
                setStreamedText((prev) => prev + event.text);
              },
              onResult: (event) => {
                parsedStreamResponse = parseChatResponseV1(event);
                if (!parsedStreamResponse) {
                  const obj = asObject(event);
                  if (obj && Array.isArray(obj.cards)) {
                    const hasV2Cards = (obj.cards as unknown[]).some(
                      (c) => c && typeof c === 'object' && typeof (c as Record<string, unknown>).card_type === 'string',
                    );
                    if (hasV2Cards || (obj.cards as unknown[]).length === 0) {
                      parsedStreamV2 = {
                        cards: obj.cards as Array<Record<string, unknown>>,
                        ops: asObject(obj.ops) || {},
                        next_actions: Array.isArray(obj.next_actions) ? obj.next_actions : [],
                      };
                    }
                  }
                }
              },
            }, { timeoutMs });
            if (!parsedStreamResponse && !parsedStreamV2) {
              throw new Error('Invalid /v1/chat/stream result: expected ChatCards v1 or v2 schema.');
            }
            usedStream = true;
          } catch {
            streamEndpointDisabledRef.current = true;
          }
        }

        if (!usedStream) {
          const simSteps = language === 'CN'
            ? ['正在读取你的档案...', '搜索知识库...', '运行安全检查...', '生成回复中...']
            : ['Reading your profile...', 'Searching knowledge base...', 'Running safety checks...', 'Generating response...'];
          const stopSim = startSimulatedThinking(simSteps, setThinkingSteps);
          try {
            const bodyRaw = await bffJson<unknown>('/v1/chat', requestHeaders, {
              method: 'POST',
              body: JSON.stringify(body),
              timeoutMs,
            });
            const parsedV1 = parseChatResponseV1(bodyRaw);
            const legacyEnvelope =
              !parsedV1
              && bodyRaw
              && typeof bodyRaw === 'object'
              && !Array.isArray(bodyRaw)
              && asString((bodyRaw as Record<string, unknown>).request_id)
              && asString((bodyRaw as Record<string, unknown>).trace_id)
                ? (bodyRaw as V1Envelope)
                : null;
            const v2Response = (() => {
              if (parsedV1 || legacyEnvelope) return null;
              const obj = asObject(bodyRaw);
              if (!obj || !Array.isArray(obj.cards)) return null;
              const hasV2Cards = (obj.cards as unknown[]).some(
                (c) => c && typeof c === 'object' && typeof (c as Record<string, unknown>).card_type === 'string',
              );
              if (!hasV2Cards && (obj.cards as unknown[]).length > 0) return null;
              return {
                cards: obj.cards as Array<Record<string, unknown>>,
                ops: asObject(obj.ops) || {},
                next_actions: Array.isArray(obj.next_actions) ? obj.next_actions : [],
              };
            })();
            if (!parsedV1 && !legacyEnvelope && !v2Response) {
              throw new Error('Invalid /v1/chat response: expected ChatCards v1 or v2 schema.');
            }
            if (parsedV1) applyChatResponseV1(parsedV1);
            else if (legacyEnvelope) applyEnvelope(legacyEnvelope);
            else if (v2Response) applyV2Response(v2Response);
          } finally {
            stopSim();
          }
          return;
        }

        if (parsedStreamResponse) {
          applyChatResponseV1(parsedStreamResponse);
        } else if (parsedStreamV2) {
          applyV2Response(parsedStreamV2);
        }
        pendingLocationSessionProfilePatchRef.current = null;
      } catch (err) {
        if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
      } finally {
        setChatBusy(false);
        setLoadingIntent('default');
        setThinkingSteps([]);
        setStreamedText('');
      }
    },
    [
      agentState,
      anchorProductId,
      anchorProductUrl,
      applyEnvelope,
      applyChatResponseV1,
      applyV2Response,
      bootstrapInfo?.profile,
      debug,
      headers,
      language,
      profileSnapshot,
      sessionMeta,
      sessionState,
      tryApplyEnvelopeFromBffError,
    ]
  );

  const runProductDeepScan = useCallback(
    async (rawInput: string) => {
      const inputText = String(rawInput || '').trim();
      if (!inputText) return;

      setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: inputText }]);
      setChatBusy(true);
      setError(null);

      try {
        setSessionState('P1_PRODUCT_ANALYZING');

        const requestHeaders = { ...headers, lang: language };
        const asUrl = parseMaybeUrl(inputText);

        const parseEnv = await bffJson<V1Envelope>('/v1/product/parse', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(asUrl ? { url: asUrl } : { text: inputText }),
        });
        const parseCard = Array.isArray(parseEnv.cards) ? parseEnv.cards.find((c) => c && c.type === 'product_parse') : null;
        const parsePayload = parseCard && parseCard.payload && typeof parseCard.payload === 'object'
          ? parseCard.payload as Record<string, unknown>
          : null;
        const parsedProduct = parsePayload && typeof parsePayload.product === 'object' && !Array.isArray(parsePayload.product)
          ? parsePayload.product
          : null;
        const parseMissingReasons = uniqueStrings([
          ...asArray(parsePayload?.missing_info).map((item) => asString(item)).filter(Boolean),
          ...asArray(parseCard?.field_missing)
            .map((item) => asObject(item))
            .filter(Boolean)
            .map((item) => asString((item as any).reason))
            .filter(Boolean),
        ]);
        if (!parsedProduct) {
          const analyticsCtx: AnalyticsContext = {
            brief_id: headers.brief_id,
            trace_id: headers.trace_id,
            aurora_uid: headers.aurora_uid,
            lang: toLangPref(language),
            state: agentState,
          };
          emitAuroraProductParseMissing(analyticsCtx, {
            request_id: asString(parseEnv?.request_id) || null,
            bff_trace_id: asString(parseEnv?.trace_id) || null,
            reason: parseMissingReasons[0] || 'upstream_missing_or_unstructured',
            reasons: parseMissingReasons.slice(0, 6),
          });
        }
        let parseEnvelopeApplied = false;
        const analyzeBody = parsedProduct
          ? asUrl
            ? { product: parsedProduct, url: asUrl }
            : { product: parsedProduct }
          : asUrl
            ? { url: asUrl }
            : { name: inputText };

        let analyzeEnv: V1Envelope;
        try {
          analyzeEnv = await bffJson<V1Envelope>('/v1/product/analyze', requestHeaders, {
            method: 'POST',
            body: JSON.stringify(analyzeBody),
          });
        } catch (err) {
          if (!parseEnvelopeApplied) {
            applyEnvelope(parseEnv);
            parseEnvelopeApplied = true;
          }
          throw err;
        }
        const analyzeCard = Array.isArray(analyzeEnv.cards) ? analyzeEnv.cards.find((c) => c && c.type === 'product_analysis') : null;
        const analyzeAssessment =
          analyzeCard && analyzeCard.payload && typeof analyzeCard.payload === 'object'
            ? asObject((analyzeCard.payload as any).assessment)
            : null;
        const analyzePayload =
          analyzeCard && analyzeCard.payload && typeof analyzeCard.payload === 'object'
            ? (analyzeCard.payload as Record<string, unknown>)
            : null;
        const verdict = (asString((analyzeAssessment as any)?.verdict) || '').trim().toLowerCase();
        const hasEffectiveVerdict = Boolean(verdict && verdict !== 'unknown' && verdict !== '未知');
        const analyzeMissingReasons = uniqueStrings([
          ...asArray((analyzePayload as any)?.missing_info).map((item) => asString(item)).filter(Boolean),
          ...asArray((analyzePayload as any)?.user_facing_gaps).map((item) => asString(item)).filter(Boolean),
          ...asArray((analyzePayload as any)?.internal_debug_codes).map((item) => asString(item)).filter(Boolean),
        ]);
        const analyzeProvenance = asObject((analyzePayload as any)?.provenance) || null;
        const sourceChain = uniqueStrings(asArray((analyzeProvenance as any)?.source_chain).map((item) => asString(item)).filter(Boolean));
        const kbWrite = asObject((analyzeProvenance as any)?.kb_write || (analyzeProvenance as any)?.kbWrite) || null;
        const blockedReason = asString((kbWrite as any)?.blocked_reason || (kbWrite as any)?.blockedReason) || null;
        const looksDegraded =
          !hasEffectiveVerdict ||
          analyzeMissingReasons.some((code) =>
            /(analysis_limited|evidence_missing|upstream_missing_or_unstructured|url_fetch_|on_page_fetch_blocked|incidecoder_|catalog_)/i.test(
              String(code || ''),
            ),
          );
        if (looksDegraded) {
          const analyticsCtx: AnalyticsContext = {
            brief_id: headers.brief_id,
            trace_id: headers.trace_id,
            aurora_uid: headers.aurora_uid,
            lang: toLangPref(language),
            state: agentState,
          };
          emitAuroraProductAnalysisDegraded(analyticsCtx, {
            request_id: asString(analyzeEnv?.request_id) || null,
            bff_trace_id: asString(analyzeEnv?.trace_id) || null,
            reason: analyzeMissingReasons[0] || (!hasEffectiveVerdict ? 'unknown_verdict' : null),
            reasons: analyzeMissingReasons.slice(0, 8),
            source_chain: sourceChain.slice(0, 6),
            blocked_reason: blockedReason,
          });
        }
        if (!parseEnvelopeApplied && !hasEffectiveVerdict) {
          applyEnvelope(parseEnv);
          parseEnvelopeApplied = true;
        }
        applyEnvelope(analyzeEnv);
        setSessionState('P2_PRODUCT_RESULT');
      } catch (err) {
        if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
      } finally {
        setChatBusy(false);
      }
    },
    [agentState, applyEnvelope, headers, language, tryApplyEnvelopeFromBffError],
  );

  const runDupeSearch = useCallback(
    async (rawOriginal: string) => {
      const originalText = String(rawOriginal || '').trim();
      if (!originalText) {
        setError(language === 'CN' ? '请先填写「目标商品」。' : 'Please provide a target product.');
        return;
      }

      setItems((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'user',
          kind: 'text',
          content: language === 'CN' ? `找平替：${originalText}` : `Find dupes: ${originalText}`,
        },
      ]);
      setChatBusy(true);
      setLoadingIntent('default');
      setError(null);

      try {
        const requestHeaders = { ...headers, lang: language };
        const asUrl = parseMaybeUrl(originalText);
        const env = await bffJson<V1Envelope>('/v1/dupe/suggest', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(asUrl ? { original_url: asUrl } : { original_text: originalText }),
        });
        applyEnvelope(env);
      } catch (err) {
        if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
      } finally {
        setChatBusy(false);
        setLoadingIntent('default');
      }
    },
    [applyEnvelope, headers, language, tryApplyEnvelopeFromBffError],
  );

  const onCardAction = useCallback(
    async (actionId: string, data?: Record<string, any>) => {
      if (actionId === 'diagnosis_skip') {
        pendingActionAfterDiagnosisRef.current = null;
        clearDiagnosisThreadState();
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '跳过诊断' : 'Skip diagnosis' },
        ]);
        setSessionState('idle');
        return;
      }

      if (actionId === 'diagnosis_v2_skip') {
        pendingActionAfterDiagnosisRef.current = null;
        clearDiagnosisThreadState();
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '跳过诊断' : 'Skip diagnosis' },
        ]);
        setSessionState('idle');
        return;
      }

      if (actionId === 'diagnosis_v2_submit') {
        const goals = Array.isArray(data?.goals) ? (data.goals as string[]).filter(Boolean) : [];
        const customInput = typeof data?.customInput === 'string' ? data.customInput.trim() : '';
        const followupAnswers = (data?.followupAnswers && typeof data.followupAnswers === 'object')
          ? data.followupAnswers as Record<string, string>
          : {};

        if (goals.length === 0) {
          setError(language === 'CN' ? '请至少选择一个护肤目标。' : 'Please select at least one skincare goal.');
          return;
        }

        const nextThreadState: Record<string, unknown> = {
          ...(threadStateRef.current || {}),
          diagnosis_goals: goals,
          diagnosis_state: 'goals_selected',
          ...(Object.keys(followupAnswers).length ? { diagnosis_followup_answers: followupAnswers } : {}),
          ...(customInput ? { diagnosis_custom_input: customInput } : {}),
        };
        threadStateRef.current = nextThreadState;

        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: language === 'CN' ? '开始皮肤分析' : 'Start skin analysis',
          },
          {
            id: nextId(),
            role: 'assistant',
            kind: 'cards',
            cards: [{
              card_id: `local_diag_photo_prompt_${Date.now()}`,
              type: 'diagnosis_v2_photo_prompt',
              payload: {
                has_existing_artifact: false,
                prompt_text:
                  language === 'CN'
                    ? '先拍一张自拍可以显著提升分析准确度；你也可以跳过，继续低置信度基础分析。'
                    : 'Take a selfie for better analysis. You can also skip and continue with a lower-confidence baseline.',
                photo_action: {
                  label: language === 'CN' ? '拍照提升准确度' : 'Take a selfie for better analysis',
                },
                skip_action: {
                  label: language === 'CN' ? '跳过并继续' : 'Skip and continue',
                },
              },
            }],
          },
        ]);
        setAgentStateSafe('DIAG_PHOTO_OPTIN');
        return;
      }

      if (actionId === 'take_photo') {
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '我来上传照片' : 'I will add photos' },
        ]);
        setAgentStateSafe('DIAG_PHOTO_OPTIN');
        handlePickPhoto();
        return;
      }

      if (actionId === 'skip_photo') {
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '跳过照片，继续分析' : 'Skip photo and continue' },
        ]);
        setAgentStateSafe('DIAG_ANALYSIS_SUMMARY');
        await runLowConfidenceSkinAnalysis();
        return;
      }

      if (actionId === 'diagnosis_submit') {
        const skinType = typeof data?.skinType === 'string' ? data.skinType.trim() : '';
        const barrierStatus = typeof data?.barrierStatus === 'string' ? data.barrierStatus.trim() : '';
        const sensitivity = typeof data?.sensitivity === 'string' ? data.sensitivity.trim() : '';
        const concerns = Array.isArray(data?.concerns) ? (data?.concerns as unknown[]).map((c) => String(c || '').trim()).filter(Boolean) : [];

        if (!skinType || !barrierStatus || !sensitivity || concerns.length === 0) {
          setError(language === 'CN' ? '请先完成诊断信息。' : 'Please complete the diagnosis first.');
          return;
        }

        const pending = pendingActionAfterDiagnosisRef.current;
        pendingActionAfterDiagnosisRef.current = null;

        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: pending
              ? language === 'CN'
                ? '已填写肤况信息（继续推荐）'
                : 'Saved skin profile (continue recommendations)'
              : language === 'CN'
                ? '分析我的皮肤'
                : 'Analyze my skin',
          },
        ]);

        await sendChat(undefined, {
          action_id: 'profile.patch',
          kind: 'action',
          data: {
            profile_patch: {
              skinType,
              barrierStatus,
              sensitivity,
              goals: concerns.slice(0, 3),
            },
          },
        });

        if (pending) {
          await sendChat(undefined, pending);
        }
        return;
      }

      if (actionId === 'ingredient.lookup') {
        const ingredientQuery =
          typeof data?.ingredient_query === 'string'
            ? data.ingredient_query.trim()
            : typeof data?.query === 'string'
              ? data.query.trim()
              : '';

        const analyticsCtx: AnalyticsContext = {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: agentState,
        };
        emitIngredientsModeSelected(analyticsCtx, {
          mode: 'lookup',
          entry_source: typeof data?.entry_source === 'string' ? data.entry_source : null,
        });

        if (!ingredientQuery) {
          setItems((prev) => [
            ...prev,
            {
              id: nextId(),
              role: 'assistant',
              kind: 'text',
              content:
                language === 'CN'
                  ? '请输入想查询的成分（INCI/别名）。例如：niacinamide、azelaic acid。'
                  : 'Please enter an ingredient to lookup (INCI/alias), for example niacinamide or azelaic acid.',
            },
          ]);
          return;
        }

        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: language === 'CN' ? `查成分：${ingredientQuery}` : `Lookup ingredient: ${ingredientQuery}`,
          },
        ]);
        await sendChat(undefined, {
          action_id: 'ingredient.lookup',
          kind: 'action',
          data: {
            ...(data || {}),
            ingredient_query: ingredientQuery,
          },
        });
        return;
      }

      if (actionId === 'ingredient.research.poll') {
        const ingredientQuery =
          typeof data?.ingredient_query === 'string'
            ? data.ingredient_query.trim()
            : typeof data?.normalized_query === 'string'
              ? data.normalized_query.trim()
              : '';
        if (!ingredientQuery) {
          setError(language === 'CN' ? '请先输入要查询的成分。' : 'Please enter an ingredient first.');
          return;
        }
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: language === 'CN' ? `刷新增强结果：${ingredientQuery}` : `Refresh enhanced result: ${ingredientQuery}`,
          },
        ]);
        await sendChat(undefined, {
          action_id: 'ingredient.research.poll',
          kind: 'action',
          data: {
            ...(data || {}),
            ingredient_query: ingredientQuery,
            normalized_query: ingredientQuery,
          },
        });
        return;
      }

      if (actionId === 'ingredient.by_goal') {
        const goal = typeof data?.goal === 'string' ? data.goal.trim() : '';
        const sensitivity = typeof data?.sensitivity === 'string' ? data.sensitivity.trim() : 'unknown';
        const analyticsCtx: AnalyticsContext = {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: agentState,
        };
        emitIngredientsModeSelected(analyticsCtx, {
          mode: 'by_goal',
          entry_source: typeof data?.entry_source === 'string' ? data.entry_source : null,
        });
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content:
              language === 'CN'
                ? `按功效找成分：${goal || '修护'}（敏感度：${sensitivity || 'unknown'}）`
                : `Find ingredients by goal: ${goal || 'barrier'} (sensitivity: ${sensitivity || 'unknown'})`,
          },
        ]);
        await sendChat(undefined, {
          action_id: 'ingredient.by_goal',
          kind: 'action',
          data: {
            ...(data || {}),
            goal: goal || 'barrier',
            sensitivity: sensitivity || 'unknown',
          },
        });
        return;
      }

      if (actionId === 'ingredient.optin_diagnosis') {
        const analyticsCtx: AnalyticsContext = {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: agentState,
        };
        emitIngredientsOptinDiagnosis(analyticsCtx, {
          entry_source: typeof data?.entry_source === 'string' ? data.entry_source : null,
        });
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: language === 'CN' ? '提高准确度（开始诊断）' : 'Improve accuracy (start diagnosis)',
          },
        ]);
        await sendChat(undefined, {
          action_id: 'ingredient.optin_diagnosis',
          kind: 'action',
          data: {
            ...(data || {}),
          },
        });
        return;
      }

      if (actionId === 'dupe_compare') {
        const original = unwrapProductLike(data?.original);
        const dupe = unwrapProductLike(data?.dupe);
        if (!isComparableProductLike(original)) {
          setError(
            language === 'CN'
              ? '目标商品信息不足，暂时无法对比。'
              : 'Need a clearer target product before comparing.',
          );
          return;
        }
        if (!isComparableProductLike(dupe)) {
          setError(
            language === 'CN'
              ? '候选商品信息不足，暂时无法对比。'
              : 'Candidate details are incomplete, so compare is unavailable.',
          );
          return;
        }
        if (looksLikeSelfRef(original, dupe)) {
          setError(
            language === 'CN'
              ? '这是同一款商品，无法做平替对比。'
              : 'This candidate is the same product, so compare is unavailable.',
          );
          return;
        }

        const dupeName = getComparableDisplayName(dupe);
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: language === 'CN' ? `对比：${dupeName || '平替'}` : `Compare: ${dupeName || 'dupe'}`,
          },
        ]);

        setChatBusy(true);
        setLoadingIntent('default');
        setError(null);
        try {
          const requestHeaders = { ...headers, lang: language };
          const env = await bffJson<V1Envelope>('/v1/dupe/compare', requestHeaders, {
            method: 'POST',
            body: JSON.stringify({ original, dupe }),
          });
          applyEnvelope(env);
        } catch (err) {
          if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
        } finally {
          setChatBusy(false);
          setLoadingIntent('default');
        }
        return;
      }

      if (actionId === 'affiliate_open') {
        const url = typeof data?.url === 'string' ? data.url.trim() : '';
        const offerId = typeof data?.offer_id === 'string' ? data.offer_id.trim() : undefined;
        if (!url) return;

        const outboundCtx: AnalyticsContext = {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: agentState,
        };
        const merchantDomain = (() => {
          try {
            return new URL(url).hostname || '';
          } catch {
            return '';
          }
        })();
        emitUiOutboundOpened(outboundCtx, { merchant_domain: merchantDomain, card_position: 0, sku_type: 'unknown' });

        let opened = false;
        try {
          const w = window.open(url, '_blank', 'noopener,noreferrer');
          opened = Boolean(w);
          if (!opened) setError(language === 'CN' ? '浏览器拦截了弹窗，请允许后重试。' : 'Popup blocked by browser. Please allow popups and retry.');
        } catch {
          setError(language === 'CN' ? '打开链接失败。' : 'Failed to open link.');
        }

        // Best-effort tracking (do not render the returned card).
        try {
          const requestHeaders = { ...headers, lang: language };
          await bffJson('/v1/affiliate/outcome', requestHeaders, {
            method: 'POST',
            body: JSON.stringify({ outcome: opened ? 'success' : 'failed', url, ...(offerId ? { offer_id: offerId } : {}) }),
          });
        } catch {
          // ignore tracking errors
        }
        return;
      }

      if (actionId === 'profile_upload_selfie') {
        setPromptRoutineAfterPhoto(true);
        setPhotoSheetOpen(true);
        return;
      }

      if (actionId === 'profile_confirm') {
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '先不传照片，继续' : 'Continue without photos' },
        ]);

        const prompt =
          language === 'CN'
            ? '为了把分析做得更准，我强烈建议你把最近在用的产品/步骤也发我（AM/PM：洁面/活性/保湿/SPF，名字或链接都行）。你也可以直接跳过，我会先给低置信度的通用 7 天建议。'
            : 'To make this analysis accurate, I strongly recommend sharing your current products/steps (AM/PM: cleanser/actives/moisturizer/SPF — names or links). You can also skip; I’ll give a low-confidence 7‑day baseline.';
        const chips: SuggestedChip[] = [
          {
            chip_id: 'chip.intake.paste_routine',
            label: language === 'CN' ? '填写 AM/PM 产品（更准）' : 'Add AM/PM products (more accurate)',
            kind: 'quick_reply',
            data: {},
          },
          {
            chip_id: 'chip.intake.skip_analysis',
            label: language === 'CN' ? '直接分析（低置信度）' : 'Skip and analyze (low confidence)',
            kind: 'quick_reply',
            data: {},
          },
        ];
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', kind: 'text', content: prompt },
          { id: nextId(), role: 'assistant', kind: 'chips', chips },
        ]);
        return;
      }

      if (actionId === 'profile_update_concerns') {
        const concernsRaw = Array.isArray(data?.concerns) ? (data?.concerns as unknown[]) : [];
        const concerns = concernsRaw.map((c) => String(c || '').trim()).filter(Boolean);
        const requestHeaders = { ...headers, lang: language };

        setChatBusy(true);
        try {
          const env = await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
            method: 'POST',
            body: JSON.stringify({ goals: concerns }),
            timeoutMs: PROFILE_UPDATE_TIMEOUT_MS,
          });
          applyEnvelope(env);
        } catch (err) {
          if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
        } finally {
          setChatBusy(false);
        }
        return;
      }

      if (actionId === 'analysis_review_products') {
        setRoutineDraft(makeEmptyRoutineDraft());
        setRoutineTab('am');
        setRoutineSheetOpen(true);
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '评估我现在用的产品' : 'Review my current products' },
          {
            id: nextId(),
            role: 'assistant',
            kind: 'text',
            content:
              language === 'CN'
                ? '把你现在正在用的产品按 AM/PM 填一下（洁面/活性/保湿/SPF，名字或链接都行），我先帮你做兼容性与刺激风险检查，再决定要不要换/加。'
                : 'Fill in your AM/PM products (cleanser/actives/moisturizer/SPF, names or links). I’ll check conflicts and irritation risk first, then decide what to keep/change.',
          },
        ]);
        return;
      }

      if (actionId === 'analysis_quick_check') {
        const value = typeof data?.value === 'string' ? data.value.trim().toLowerCase() : '';
        if (value !== 'yes' && value !== 'no') return;
        const userText =
          value === 'yes'
            ? language === 'CN'
              ? '有（最近刺痛/泛红）'
              : 'Yes — stinging/redness recently'
            : language === 'CN'
              ? '没有（最近没有刺痛/泛红）'
              : 'No — no stinging/redness recently';
        setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: userText }]);

        const immediate =
          value === 'yes'
            ? language === 'CN'
              ? '我会按“屏障优先”来给建议，先避免叠加强活性。'
              : 'I’ll keep this barrier-first and avoid stacking strong actives for now.'
            : language === 'CN'
              ? '我会更放心一些推进，但仍会从低频、单一活性开始。'
              : 'We can be a bit more proactive, but still start low-frequency with one active at a time.';
        setItems((prev) => [...prev, { id: nextId(), role: 'assistant', kind: 'text', content: immediate }]);

        // IMPORTANT: keep quick-check UI-only to avoid accidentally triggering unrelated
        // backend flows (e.g. budget gating) from a short free-text message.
        return;
      }

      if (actionId === 'ingredient_drilldown') {
        const ingredientName = typeof data?.ingredient_name === 'string' ? data.ingredient_name.trim() : '';
        if (!ingredientName) return;
        const prompt =
          language === 'CN'
            ? `请分析成分“${ingredientName}”：说明常见功效、使用注意点，并给出含该成分的主流产品例子（按平价/中端/高端各举例）。`
            : `Analyze ingredient "${ingredientName}": explain common benefits, key watchouts, and example mainstream products containing it (budget/mid/premium).`;
        setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: prompt }]);
        await sendChat(prompt);
        return;
      }

      if (actionId === 'analysis_followup_prompt') {
        const prompt = typeof data?.prompt === 'string' ? data.prompt.trim() : '';
        const goalRaw = typeof data?.goal === 'string' ? data.goal.trim().toLowerCase() : '';
        const goal =
          goalRaw === 'acne_focus' || goalRaw === 'less_drying' || goalRaw === 'pros_cons'
            ? goalRaw
            : undefined;
        const anchorFromData = data?.anchor && typeof data.anchor === 'object'
          ? (data.anchor as Record<string, unknown>)
          : null;
        const fallbackAnchor =
          anchorProductId || anchorProductUrl
            ? {
              ...(anchorProductId ? { product_id: anchorProductId } : {}),
              ...(anchorProductUrl ? { url: anchorProductUrl } : {}),
            }
            : null;
        const anchor = anchorFromData || fallbackAnchor;
        if (!prompt) return;
        setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: prompt }]);
        await sendChat(undefined, {
          action_id: 'chat.followup.alternatives',
          kind: 'action',
          data: {
            ...(goal ? { goal } : {}),
            ...(anchor ? { anchor } : {}),
            prompt,
            reply_text: prompt,
            include_alternatives: true,
          },
        });
        return;
      }

      if (actionId === 'chip.aurora.next_action.deep_dive_skin') {
        const replyText =
          asString(data?.reply_text) ||
          (language === 'CN' ? '深入了解我的皮肤状态' : 'Tell me more about my skin');
        const photoRefs = getSanitizedAnalysisPhotos();
        const analysisStorySnapshot = getLatestAnalysisStorySnapshot();
        const analysisContext: ChatSessionAnalysisContext = {
          analysis_origin: photoRefs.length > 0 ? 'photo' : 'profile',
          use_photo: photoRefs.length > 0,
          ...(photoRefs.length > 0 ? { photo_refs: photoRefs } : {}),
          source_card_type: 'analysis_story_v2',
          ...(analysisStorySnapshot ? { analysis_story_snapshot: analysisStorySnapshot } : {}),
        };
        const actionData: Record<string, unknown> = {
          ...(data && typeof data === 'object' ? data : {}),
          analysis_origin: analysisContext.analysis_origin,
          use_photo: analysisContext.use_photo === true,
          ...(Array.isArray(analysisContext.photo_refs) ? { photo_refs: analysisContext.photo_refs } : {}),
          source_card_type: 'analysis_story_v2',
          ...(analysisStorySnapshot ? { analysis_story_snapshot: analysisStorySnapshot } : {}),
          reply_text: replyText,
        };
        setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: replyText }]);
        await sendChat(
          undefined,
          {
            action_id: actionId,
            kind: 'chip',
            data: actionData,
          },
          {
            client_state: agentState,
            analysisContext,
          },
        );
        return;
      }
      const msg =
        actionId === 'analysis_continue'
          ? null
          : actionId === 'analysis_gentler'
            ? language === 'CN'
              ? '给我更温和的方案'
              : 'Make it gentler'
            : actionId === 'analysis_simple'
              ? language === 'CN'
                ? '给我更简单的方案'
                : 'Make it simpler'
              : null;

      if (actionId === 'analysis_continue') {
        // Explicitly request recommendations via a chip trigger so the backend
        // can safely allow recommendation cards (no accidental auto-push).
        const fromState = agentState;
        const ctx: AnalyticsContext = {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: fromState,
        };
        const validation = validateRequestedTransition({
          from_state: fromState,
          trigger_source: 'action',
          trigger_id: actionId,
          requested_next_state: 'RECO_GATE',
        });
        const resolvedNextState: AgentState = validation.ok ? validation.next_state : 'IDLE_CHAT';
        if (!validation.ok) {
          console.warn('[StateMachine] soft fallback on action transition', { actionId, fromState, reason: validation.reason });
        }
        if (resolvedNextState !== fromState) {
          emitAgentStateEntered(
            { ...ctx, state: resolvedNextState },
            { state_name: resolvedNextState, from_state: fromState, trigger_source: 'action', trigger_id: actionId },
          );
          setAgentStateSafe(resolvedNextState);
        }
        if (resolvedNextState === 'RECO_GATE') {
          emitUiRecosRequested({ ...ctx, state: resolvedNextState }, { entry_point: 'action', prior_value_moment: 'analysis_summary' });
        }
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: t('s5.btn.continue', language) },
        ]);
        await sendChat(undefined, {
          action_id: 'chip.action.reco_routine',
          kind: 'chip',
          data: {
            reply_text: language === 'CN' ? '生成一套早晚护肤 routine' : 'Build an AM/PM skincare routine',
            include_alternatives: true,
          },
        }, {
          client_state: fromState,
          requested_transition: { trigger_source: 'action', trigger_id: actionId, requested_next_state: resolvedNextState },
        });
        return;
      }

      if (msg) {
        setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: msg }]);
        // Make gentler / simpler are explicit *preference* messages (not silent actions).
        // We still send them as chips to keep the recommendation gate explicit.
        if (actionId === 'analysis_gentler' || actionId === 'analysis_simple') {
          const fromState = agentState;
          const ctx: AnalyticsContext = {
            brief_id: headers.brief_id,
            trace_id: headers.trace_id,
            aurora_uid: headers.aurora_uid,
            lang: toLangPref(language),
            state: fromState,
          };
          const validation = validateRequestedTransition({
            from_state: fromState,
            trigger_source: 'action',
            trigger_id: actionId,
            requested_next_state: 'RECO_GATE',
          });
          const resolvedNextState: AgentState = validation.ok ? validation.next_state : 'IDLE_CHAT';
          if (!validation.ok) {
            console.warn('[StateMachine] soft fallback on action transition', { actionId, fromState, reason: validation.reason });
          }
          if (resolvedNextState !== fromState) {
            emitAgentStateEntered(
              { ...ctx, state: resolvedNextState },
              { state_name: resolvedNextState, from_state: fromState, trigger_source: 'action', trigger_id: actionId },
            );
            setAgentStateSafe(resolvedNextState);
          }
          if (resolvedNextState === 'RECO_GATE') {
            emitUiRecosRequested({ ...ctx, state: resolvedNextState }, { entry_point: 'action', prior_value_moment: 'analysis_summary' });
          }
          const replyText =
            actionId === 'analysis_gentler'
              ? language === 'CN'
                ? '生成一套更温和的早晚护肤 routine（减少刺激，优先修护）。'
                : 'Build a gentler AM/PM routine (minimize irritation, barrier-first).'
              : language === 'CN'
                ? '生成一套更简单的早晚护肤 routine（步骤更少）。'
                : 'Build the simplest AM/PM routine (fewer steps).';
          await sendChat(undefined, {
            action_id: 'chip.action.reco_routine',
            kind: 'chip',
            data: { reply_text: replyText, include_alternatives: true },
          }, {
            client_state: fromState,
            requested_transition: { trigger_source: 'action', trigger_id: actionId, requested_next_state: resolvedNextState },
          });
          return;
        }

        await sendChat(msg);
        return;
      }

      await sendChat(undefined, { action_id: actionId, kind: 'action', data });
    },
    [
      agentState,
      anchorProductId,
      anchorProductUrl,
      applyEnvelope,
      clearDiagnosisThreadState,
      getLatestAnalysisStorySnapshot,
      getSanitizedAnalysisPhotos,
      headers,
      language,
      sendChat,
      setAgentStateSafe,
      tryApplyEnvelopeFromBffError,
    ],
  );

  const onProductPicksPrimary = useCallback(async () => {
    if (isLoading) return;
    const fromState = agentState;
    const actionId = 'product_picks_primary';
    const ctx: AnalyticsContext = {
      brief_id: headers.brief_id,
      trace_id: headers.trace_id,
      aurora_uid: headers.aurora_uid,
      lang: toLangPref(language),
      state: fromState,
    };

    const validation = validateRequestedTransition({
      from_state: fromState,
      trigger_source: 'action',
      trigger_id: actionId,
      requested_next_state: 'RECO_GATE',
    });
    const resolvedNextState: AgentState = validation.ok ? validation.next_state : 'IDLE_CHAT';
    if (!validation.ok) {
      console.warn('[StateMachine] soft fallback on action transition', { actionId, fromState, reason: validation.reason });
    }

    if (resolvedNextState !== fromState) {
      emitAgentStateEntered(
        { ...ctx, state: resolvedNextState },
        { state_name: resolvedNextState, from_state: fromState, trigger_source: 'action', trigger_id: actionId },
      );
      setAgentStateSafe(resolvedNextState);
    }

    if (resolvedNextState === 'RECO_GATE') {
      emitUiRecosRequested({ ...ctx, state: resolvedNextState }, { entry_point: 'action', prior_value_moment: 'product_picks' });
    }

    setItems((prev) => [
      ...prev,
      {
        id: nextId(),
        role: 'user',
        kind: 'text',
        content: language === 'CN' ? '查看产品推荐' : 'See product recommendations',
      },
    ]);

    const replyText =
      language === 'CN' ? '推荐一些产品（并给出可购买的链接/入口）。' : 'Recommend a few products (with purchasable links/CTAs).';

    await sendChat(
      undefined,
      {
        action_id: 'chip.start.reco_products',
        kind: 'chip',
        data: { reply_text: replyText, include_alternatives: true },
      },
      {
        client_state: fromState,
        requested_transition: { trigger_source: 'action', trigger_id: actionId, requested_next_state: resolvedNextState },
      },
    );
  }, [agentState, headers, isLoading, language, sendChat, setAgentStateSafe]);

  const runLowConfidenceSkinAnalysis = useCallback(async (opts?: { fromRoutineForm?: boolean }) => {
    const fromRoutineForm = opts?.fromRoutineForm === true;
    if (fromRoutineForm) setRoutineFormBusy(true);
    setAnalysisBusy(true);
    setThinkingSteps([{
      step: 'sim_0',
      message: language === 'CN' ? '正在快速分析肤质...' : 'Running quick skin analysis...',
      completed: false,
    }]);
    setError(null);
    const stopQuickSim = startSimulatedThinking(ANALYSIS_SIM_STEPS[language] || ANALYSIS_SIM_STEPS.EN, setThinkingSteps);
    try {
      setSessionState('S4_ANALYSIS_LOADING');
      const requestHeaders = { ...headers, lang: language };
      const env = await retryWithBackoff(
        () => bffJson<V1Envelope>('/v1/analysis/skin', requestHeaders, {
          method: 'POST',
          body: JSON.stringify({ use_photo: false }),
          timeoutMs: ANALYSIS_REQUEST_TIMEOUT_MS,
        }),
        { maxRetries: 1, baseDelayMs: 1500 },
      );
      applyEnvelope(env);
    } catch (err) {
      if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      stopQuickSim();
      setAnalysisBusy(false);
      setThinkingSteps([]);
      if (fromRoutineForm) setRoutineFormBusy(false);
    }
  }, [applyEnvelope, headers, language, tryApplyEnvelopeFromBffError]);

  const runRoutineSkinAnalysis = useCallback(
    async (
      routineInput: string | Record<string, unknown>,
      photoRefsOverride?: AnalysisPhotoRef[],
      opts?: { fromRoutineForm?: boolean },
    ) => {
      const routine =
        typeof routineInput === 'string'
          ? String(routineInput || '').trim()
          : routineInput && typeof routineInput === 'object'
            ? routineInput
            : null;
      if (!routine || (typeof routine === 'string' && !routine.trim())) return;
      const fromRoutineForm = opts?.fromRoutineForm === true;
      if (fromRoutineForm) setRoutineFormBusy(true);
      setAnalysisBusy(true);
      setThinkingSteps([{
        step: 'sim_0',
        message: language === 'CN' ? '正在结合你的护肤步骤分析...' : 'Analyzing with your routine...',
        completed: false,
      }]);
      setError(null);
      const requestHeaders = { ...headers, lang: language };
      const stopRoutineSim = startSimulatedThinking(ANALYSIS_SIM_STEPS[language] || ANALYSIS_SIM_STEPS.EN, setThinkingSteps);

      try {
        setSessionState('S4_ANALYSIS_LOADING');
        const photos = mergeAnalysisPhotoRefs(getSanitizedAnalysisPhotos(), Array.isArray(photoRefsOverride) ? photoRefsOverride : []);
        const usePhoto = photos.length > 0;
        const body: Record<string, unknown> = {
          use_photo: usePhoto,
          currentRoutine: routine,
          ...(usePhoto ? { photos } : {}),
        };
        const envAnalysis = await retryWithBackoff(
          () => bffJson<V1Envelope>('/v1/analysis/skin', requestHeaders, {
            method: 'POST',
            body: JSON.stringify(body),
            timeoutMs: ANALYSIS_REQUEST_TIMEOUT_MS,
          }),
          { maxRetries: 1, baseDelayMs: 1500 },
        );
        applyEnvelope(envAnalysis);
      } catch (err) {
        if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
      } finally {
        stopRoutineSim();
        setAnalysisBusy(false);
        setThinkingSteps([]);
        if (fromRoutineForm) setRoutineFormBusy(false);
      }
    },
    [applyEnvelope, getSanitizedAnalysisPhotos, headers, language, tryApplyEnvelopeFromBffError],
  );

  const submitText = useCallback(
    async (raw: string) => {
      const msg = String(raw || '').trim();
      if (!msg) return;
      const directUrl = parseMaybeUrl(msg);
      if (directUrl) {
        setInput('');
        await runProductDeepScan(directUrl);
        return;
      }

      if (pendingRecoGoalOther) {
        const fromState = agentState;
        const validation = validateRequestedTransition({
          from_state: fromState,
          trigger_source: 'text_explicit',
          trigger_id: 'reco_goal_other',
          requested_next_state: 'RECO_GATE',
        });
        const resolvedNextState: AgentState = validation.ok ? validation.next_state : fromState;
        const requestedTransition =
          validation.ok
            ? {
                trigger_source: 'text_explicit' as const,
                trigger_id: 'reco_goal_other',
                requested_next_state: resolvedNextState,
              }
            : null;
        const ctx: AnalyticsContext = {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: fromState,
        };

        if (resolvedNextState !== fromState) {
          emitAgentStateEntered(
            { ...ctx, state: resolvedNextState },
            { state_name: resolvedNextState, from_state: fromState, trigger_source: 'text_explicit', trigger_id: 'reco_goal_other' },
          );
          if (resolvedNextState === 'RECO_GATE') {
            emitUiRecosRequested({ ...ctx, state: resolvedNextState }, { entry_point: 'text_explicit', prior_value_moment: null });
          }
          setAgentStateSafe(resolvedNextState);
        }

        setPendingRecoGoalOther(false);
        setItems((prev) => [...prev.filter((it) => it.kind !== 'return_welcome'), { id: nextId(), role: 'user', kind: 'text', content: msg }]);
        setInput('');
        await sendChat(msg, undefined, {
          client_state: fromState,
          ...(requestedTransition ? { requested_transition: requestedTransition } : {}),
        });
        return;
      }

      const isTextExplicitQuickProfile = (() => {
        const t = msg.trim().toLowerCase();
        if (!t) return false;
        if (t.includes('quick profile') || t.includes('30-sec quick profile') || t.includes('30 sec quick profile')) return true;
        if (t.includes('快速画像')) return true;
        if (t.includes('30秒') && t.includes('画像')) return true;
        if (t.includes('30秒快速画像') || t.includes('30 秒快速画像')) return true;
        return false;
      })();

      if (isTextExplicitQuickProfile) {
        const fromState = agentState;
        const toState: AgentState = 'QUICK_PROFILE';
        const ctx: AnalyticsContext = {
          brief_id: headers.brief_id,
          trace_id: headers.trace_id,
          aurora_uid: headers.aurora_uid,
          lang: toLangPref(language),
          state: fromState,
        };
        emitAgentStateEntered({ ...ctx, state: toState }, { state_name: toState, from_state: fromState, trigger_source: 'text_explicit', trigger_id: msg.slice(0, 120) });
        setItems((prev) => [...prev.filter((it) => it.kind !== 'return_welcome'), { id: nextId(), role: 'user', kind: 'text', content: msg }]);
        setQuickProfileStep('skin_feel');
        setQuickProfileDraft({});
        setAgentStateSafe(toState);
        setInput('');
        return;
      }

      const inferred = inferTextExplicitTransition(msg, language);
      if (inferred) {
        const fromState = agentState;
        const validation = validateRequestedTransition({
          from_state: fromState,
          trigger_source: 'text_explicit',
          trigger_id: inferred.trigger_id,
          requested_next_state: inferred.requested_next_state,
        });

        if (validation.ok && validation.next_state !== fromState) {
          const toState = validation.next_state;
          const ctx: AnalyticsContext = {
            brief_id: headers.brief_id,
            trace_id: headers.trace_id,
            aurora_uid: headers.aurora_uid,
            lang: toLangPref(language),
            state: fromState,
          };
          emitAgentStateEntered(
            { ...ctx, state: toState },
            { state_name: toState, from_state: fromState, trigger_source: 'text_explicit', trigger_id: inferred.trigger_id },
          );
          if (toState === 'RECO_GATE') {
            emitUiRecosRequested({ ...ctx, state: toState }, { entry_point: 'text_explicit', prior_value_moment: null });
          }
          setAgentStateSafe(toState);
          setItems((prev) => [...prev.filter((it) => it.kind !== 'return_welcome'), { id: nextId(), role: 'user', kind: 'text', content: msg }]);
          setInput('');
          await sendChat(msg, undefined, {
            client_state: fromState,
            requested_transition: {
              trigger_source: 'text_explicit',
              trigger_id: inferred.trigger_id,
              requested_next_state: toState,
            },
          });
          return;
        }
      }

      if (agentState === 'QUICK_PROFILE') {
        setAgentStateSafe('IDLE_CHAT');
      }

      setItems((prev) => [...prev.filter((it) => it.kind !== 'return_welcome'), { id: nextId(), role: 'user', kind: 'text', content: msg }]);
      setInput('');

      await sendChat(msg);
    },
    [agentState, headers, language, pendingRecoGoalOther, runProductDeepScan, sendChat, setAgentStateSafe],
  );

  const onSubmit = useCallback(async () => {
    await submitText(input);
  }, [input, submitText]);

  const onChip = useCallback(
    async (chip: SuggestedChip) => {
      const id = String(chip.chip_id || '').trim();
      const chipData = asObject(chip.data) || {};
      const actionIdOverride = asString((chipData as any).action_id);
      const clientAction = (asString((chipData as any).client_action) || '').toLowerCase();
      const effectiveActionId = actionIdOverride || id;
      const fallbackReplyText = asString((chipData as any).reply_text) || chip.label;
      const isV2FreeformFallback = (chipData as any).v2_freeform_fallback === true;
      const qpRaw = (chip.data as any)?.quick_profile;
      const qpQuestionId = qpRaw && typeof qpRaw === 'object' ? String(qpRaw.question_id || '').trim() : '';
      const qpAnswer = qpRaw && typeof qpRaw === 'object' ? String(qpRaw.answer || '').trim() : '';

      const fromState = agentState;
      const langPref = toLangPref(language);
      const requestedToState: AgentState = (() => {
        if (qpQuestionId === 'skip') return 'IDLE_CHAT';
        if (qpQuestionId === 'opt_in_more' && qpAnswer === 'no') return 'IDLE_CHAT';
        if (qpQuestionId === 'rx_flag') return 'IDLE_CHAT';
        return nextAgentStateForChip(effectiveActionId) ?? fromState;
      })();
      const toState = requestedToState;
      const transitionTriggerId = effectiveActionId || id;

      const ctx: AnalyticsContext = {
        brief_id: headers.brief_id,
        trace_id: headers.trace_id,
        aurora_uid: headers.aurora_uid,
        lang: langPref,
        state: fromState,
      };

      emitUiChipClicked(ctx, { chip_id: id, from_state: fromState, to_state: toState });
      if (id === 'chip.start.ingredients.entry' || id === 'chip.start.ingredients') {
        emitIngredientsEntryOpened(ctx, {
          entry_source: ((chip.data as any)?.trigger_source === 'deeplink' ? 'deeplink' : 'chip'),
          action_id: id,
        });
      }

      const stripReturnWelcome = (prev: ChatItem[]) => prev.filter((it) => it.kind !== 'return_welcome');

      if (qpQuestionId && qpAnswer) {
        emitAgentProfileQuestionAnswered(ctx, { question_id: qpQuestionId, answer_type: qpAnswer });

        const finishQuickProfile = (args: { didSkip: boolean; draft: QuickProfileProfilePatch }) => {
          const shouldShowBindPrompt = !args.didSkip && !authSession;
          const bindNotice = language === 'CN'
            ? '已临时保存到当前设备；登录后可绑定并跨设备同步。'
            : 'Saved on this device; sign in to bind and sync across devices.';

          setAgentStateSafe('IDLE_CHAT');
          setQuickProfileStep('skin_feel');
          setQuickProfileDraft(args.draft);
          const content = args.didSkip
            ? (language === 'CN'
                ? '好的，先不做快速画像。你想先做什么？'
                : "No problem — we can do the quick profile later. What would you like to do?")
            : buildQuickProfileAdvice(language, args.draft);
          setItems((prev) => {
            const nextItems: ChatItem[] = [
              ...stripReturnWelcome(prev),
              { id: nextId(), role: 'assistant', kind: 'text', content },
            ];
            if (shouldShowBindPrompt) {
              nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: bindNotice });
              nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: [buildQuickProfileBindChip(language)] });
            }
            nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: buildQuickProfileExitChips(language) });
            return nextItems;
          });
        };

        if (qpQuestionId === 'skip') {
          finishQuickProfile({ didSkip: true, draft: quickProfileDraft });
          return;
        }

        if (qpQuestionId === 'opt_in_more') {
          if (qpAnswer === 'yes') setQuickProfileStep('routine_complexity');
          else finishQuickProfile({ didSkip: false, draft: quickProfileDraft });
          return;
        }

        if (quickProfileBusy) return;

        let profilePatch: QuickProfileProfilePatch | null = null;
        if (qpQuestionId === 'skin_feel' && ['oily', 'dry', 'combination', 'unsure'].includes(qpAnswer)) {
          profilePatch = { skin_feel: qpAnswer as any };
        } else if (qpQuestionId === 'goal_primary' && ['breakouts', 'brightening', 'antiaging', 'barrier', 'spf', 'other'].includes(qpAnswer)) {
          profilePatch = { goal_primary: qpAnswer as any };
        } else if (qpQuestionId === 'sensitivity_flag' && ['yes', 'no', 'unsure'].includes(qpAnswer)) {
          profilePatch = { sensitivity_flag: qpAnswer as any };
        } else if (qpQuestionId === 'routine_complexity' && ['0-2', '3-5', '6+'].includes(qpAnswer)) {
          profilePatch = { routine_complexity: qpAnswer as any };
        } else if (qpQuestionId === 'rx_flag' && ['yes', 'no', 'unsure'].includes(qpAnswer)) {
          profilePatch = { rx_flag: qpAnswer as any };
        }

        if (!profilePatch) return;

        setQuickProfileBusy(true);
        try {
          const nextDraft: QuickProfileProfilePatch = { ...quickProfileDraft, ...profilePatch };
          setQuickProfileDraft(nextDraft);

          const auroraProfilePatch = mapQuickProfileToAuroraProfilePatch(profilePatch);
          if (auroraProfilePatch) {
            // Always update local snapshot so subsequent /v1/chat calls don't re-ask for already-known fields.
            setBootstrapInfo((prev) => {
              const merged: BootstrapInfo = prev
                ? { ...prev }
                : { profile: null, recent_logs: [], checkin_due: null, is_returning: null, db_ready: null };
              const baseProfile = asObject(merged.profile) ?? {};
              merged.profile = { ...baseProfile, ...auroraProfilePatch };
              return merged;
            });
          }
          await persistQuickProfilePatch(profilePatch, auroraProfilePatch);

          if (qpQuestionId === 'skin_feel') setQuickProfileStep('goal_primary');
          else if (qpQuestionId === 'goal_primary') setQuickProfileStep('sensitivity_flag');
          else if (qpQuestionId === 'sensitivity_flag') setQuickProfileStep('opt_in_more');
          else if (qpQuestionId === 'routine_complexity') setQuickProfileStep('rx_flag');
          else if (qpQuestionId === 'rx_flag') finishQuickProfile({ didSkip: false, draft: nextDraft });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setQuickProfileBusy(false);
        }

        return;
      }

      let requestedTransition: RequestedTransition | null = null;
      if (toState !== fromState) {
        const validation = validateRequestedTransition({
          from_state: fromState,
          trigger_source: 'chip',
          trigger_id: transitionTriggerId,
          requested_next_state: toState,
        });
        const resolvedNextState: AgentState = validation.ok ? validation.next_state : 'IDLE_CHAT';
        if (!validation.ok) {
          console.warn('[StateMachine] soft fallback on chip transition', { chipId: transitionTriggerId, fromState, reason: validation.reason });
        }
        requestedTransition = { trigger_source: 'chip', trigger_id: transitionTriggerId, requested_next_state: resolvedNextState };
        emitAgentStateEntered(
          { ...ctx, state: resolvedNextState },
          { state_name: resolvedNextState, from_state: fromState, trigger_source: 'chip', trigger_id: transitionTriggerId },
        );
        if (resolvedNextState === 'RECO_GATE') {
          emitUiRecosRequested({ ...ctx, state: resolvedNextState }, { entry_point: 'chip', prior_value_moment: null });
        }
        setAgentStateSafe(resolvedNextState);
      }

      const userItem: ChatItem = { id: nextId(), role: 'user', kind: 'text', content: chip.label };

      if (id === 'chip.lang.keep_ui' || id === 'chip.lang.switch_ui' || id === 'chip.lang.auto_follow') {
        const targetUiLang = parseUiLanguageToken((chip.data as any)?.target_ui_lang);
        const muteUntil = Date.now() + LANGUAGE_MISMATCH_HINT_SNOOZE_MS;
        langMismatchHintMutedUntilRef.current = muteUntil;
        setLangMismatchHintMutedUntil(muteUntil);

        let assistantAck =
          language === 'CN'
            ? `已保持${toUiLanguageName(language, 'CN')}回复。`
            : `Staying with ${toUiLanguageName(language, 'EN')} replies.`;

        if (id === 'chip.lang.keep_ui') {
          setLangReplyMode('ui_lock');
          setLangReplyModeState('ui_lock');
        } else if (id === 'chip.lang.switch_ui') {
          setLangReplyMode('ui_lock');
          setLangReplyModeState('ui_lock');
          if (targetUiLang && targetUiLang !== language) {
            emitUiLanguageSwitched(ctx, {
              from_lang: toLangPref(language),
              to_lang: toLangPref(targetUiLang),
            });
            setAppLanguage(toLangPref(targetUiLang));
          }
          if (targetUiLang) {
            assistantAck =
              language === 'CN'
                ? `已切换为${toUiLanguageName(targetUiLang, 'CN')}回复。`
                : `Switched to ${toUiLanguageName(targetUiLang, 'EN')} replies.`;
          }
        } else {
          setLangReplyMode('auto_follow_input');
          setLangReplyModeState('auto_follow_input');
          if (targetUiLang && targetUiLang !== language) {
            emitUiLanguageSwitched(ctx, {
              from_lang: toLangPref(language),
              to_lang: toLangPref(targetUiLang),
            });
            setAppLanguage(toLangPref(targetUiLang));
          }
          assistantAck =
            language === 'CN'
              ? '已开启自动跟随输入语言。后续会按你每轮输入自动切换回复语言。'
              : 'Auto-follow is enabled. Reply language will follow your input each turn.';
        }

        setItems((prev) => [
          ...stripReturnWelcome(prev),
          userItem,
          { id: nextId(), role: 'assistant', kind: 'text', content: assistantAck },
        ]);
        return;
      }

      if (id === 'chip_keep_chatting') {
        setItems((prev) => [...stripReturnWelcome(prev), userItem]);
        return;
      }

      if (id === 'chip_login_sync_profile') {
        setItems((prev) => [...stripReturnWelcome(prev), userItem]);
        setAuthError(null);
        setAuthNotice(null);
        setAuthStage('email');
        setAuthDraft((prev) => ({ ...prev, code: '', password: '', newPassword: '', newPasswordConfirm: '' }));
        setAuthSheetOpen(true);
        return;
      }

      if (id === 'chip_quick_profile') {
        setQuickProfileStep('skin_feel');
        setQuickProfileDraft({});
        setItems((prev) => [...stripReturnWelcome(prev), userItem]);
        return;
      }

      if (id === 'chip_start_diagnosis' || id === 'chip.start.diagnosis') {
        pendingActionAfterDiagnosisRef.current = null;
        clearDiagnosisThreadState();
        setSessionState('S2_DIAGNOSIS');
        setItems((prev) => [...stripReturnWelcome(prev), userItem]);
        await sendChat(
          undefined,
          {
            action_id: 'chip.start.diagnosis',
            kind: 'chip',
            data: { reply_text: language === 'CN' ? '开始皮肤诊断' : 'Start skin diagnosis' },
          },
        );
        return;
      }

      const shouldDeferImmediateUserEcho = effectiveActionId === 'chip.aurora.next_action.deep_dive_skin';
      if (!shouldDeferImmediateUserEcho) {
        setItems((prev) => [...stripReturnWelcome(prev), userItem]);
      }
      const activeProfile = profileSnapshot ?? bootstrapInfo?.profile ?? null;
      const existingRecoGoal = getPrimaryResolvedRecoGoal(activeProfile);
      const isGenericRecoAction = effectiveActionId === 'chip.start.reco_products' || effectiveActionId === 'chip_get_recos';
      const isRecoGoalOtherSelection = String((chipData as any).reco_goal || '').trim().toLowerCase() === 'other';
      let outgoingActionId = actionIdOverride || chip.chip_id;
      let outgoingChipData: Record<string, unknown> = chipData;

      if (isRecoGoalOtherSelection) {
        pendingActionAfterDiagnosisRef.current = null;
        setPendingRecoGoalOther(true);
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'assistant', kind: 'text', content: buildRecoGoalOtherPrompt(language) },
        ]);
        return;
      }

      if (isGenericRecoAction && !hasResolvedRecoGoalInChipData(chipData)) {
        if (existingRecoGoal) {
          outgoingActionId = 'chip.start.reco_products';
          outgoingChipData = buildGoalfulRecoActionData({
            language,
            baseData: chipData,
            goal: existingRecoGoal,
            triggerSource: 'reco_goal_profile',
          });
          setPendingRecoGoalOther(false);
        } else {
          pendingActionAfterDiagnosisRef.current = null;
          setPendingRecoGoalOther(false);
          setItems((prev) => [
            ...prev,
            { id: nextId(), role: 'assistant', kind: 'text', content: buildRecoGoalClarificationText(language) },
            { id: nextId(), role: 'assistant', kind: 'chips', chips: buildRecoGoalClarificationChips(language) },
          ]);
          return;
        }
      } else {
        setPendingRecoGoalOther(false);
      }

      const actionPayloadData =
        outgoingActionId !== chip.chip_id
          ? { ...outgoingChipData, chip_id: chip.chip_id }
          : outgoingChipData;

      // If the user explicitly requests product recommendations but lacks a minimal profile,
      // the backend will gate. Remember this intent so we can resume recommendations
      // immediately after the user completes the diagnosis card.
      if (outgoingActionId === 'chip.start.reco_products' || outgoingActionId === 'chip_get_recos') {
        const outgoingProfilePatch = asObject((outgoingChipData as any).profile_patch) || asObject((outgoingChipData as any).profilePatch);
        const recoProfileForCompleteness =
          outgoingProfilePatch
            ? { ...(activeProfile || {}), ...outgoingProfilePatch }
            : activeProfile;
        const { score } = profileRecoCompleteness(recoProfileForCompleteness);
        if (score < 3) {
          pendingActionAfterDiagnosisRef.current = {
            action_id: outgoingActionId,
            kind: 'chip',
            data: actionPayloadData,
          };
        } else {
          pendingActionAfterDiagnosisRef.current = null;
        }
      }

      if (id === 'chip_update_products') {
        setRoutineDraft(makeEmptyRoutineDraft());
        setRoutineTab('am');
        setRoutineSheetOpen(true);
        return;
      }

      if (id === 'chip_eval_routine') {
        setRoutineDraft(makeEmptyRoutineDraft());
        setRoutineTab('am');
        setRoutineSheetOpen(true);
        return;
      }

      if (id === 'chip.start.routine' || id === 'chip.action.reco_routine') {
        setRoutineDraft(makeEmptyRoutineDraft());
        setRoutineTab('am');
        setRoutineSheetOpen(true);
        return;
      }

      if (id === 'chip_checkin_now') {
        setCheckinSheetOpen(true);
        return;
      }

      if (id === 'chip_eval_single_product') {
        setProductDraft('');
        setProductSheetOpen(true);
        return;
      }

      const isCameraClientAction =
        clientAction === 'open_camera' ||
        effectiveActionId === 'diag.upload_photo' ||
        effectiveActionId === 'chip.intake.upload_photos' ||
        id === 'chip.intake.upload_photos';
      if (isCameraClientAction) {
        setPromptRoutineAfterPhoto(true);
        setPhotoSheetAutoOpenSlot('daylight');
        setPhotoSheetAutoOpenNonce((prev) => prev + 1);
        setPhotoSheetOpen(true);
        return;
      }
      if (id === 'chip.intake.paste_routine') {
        setRoutineDraft(makeEmptyRoutineDraft());
        setRoutineTab('am');
        setRoutineSheetOpen(true);
        return;
      }
      if (id === 'chip.intake.skip_analysis') {
        setRoutineSheetOpen(false);
        await runLowConfidenceSkinAnalysis();
        return;
      }
      if (id === 'chip.start.evaluate') {
        setProductDraft('');
        setProductSheetOpen(true);
        return;
      }
      if (id === 'chip.start.dupes') {
        setDupeDraft({ original: '' });
        setDupeSheetOpen(true);
        return;
      }

      if (effectiveActionId === 'chip.aurora.next_action.deep_dive_skin') {
        const replyText =
          fallbackReplyText ||
          (language === 'CN' ? '基于我保存的 skin analysis 继续。' : 'Continue from my saved skin analysis.');
        const photoRefs = getSanitizedAnalysisPhotos();
        const analysisStorySnapshot = getLatestAnalysisStorySnapshot();
        const analysisContext: ChatSessionAnalysisContext = {
          analysis_origin: photoRefs.length > 0 ? 'photo' : 'profile',
          use_photo: photoRefs.length > 0,
          ...(photoRefs.length > 0 ? { photo_refs: photoRefs } : {}),
          source_card_type: 'analysis_story_v2',
          ...(analysisStorySnapshot ? { analysis_story_snapshot: analysisStorySnapshot } : {}),
        };
        const actionPayloadDataWithAnalysis: Record<string, unknown> = {
          ...(actionPayloadData && typeof actionPayloadData === 'object' ? actionPayloadData : {}),
          analysis_origin: analysisContext.analysis_origin,
          use_photo: analysisContext.use_photo === true,
          ...(Array.isArray(analysisContext.photo_refs) ? { photo_refs: analysisContext.photo_refs } : {}),
          source_card_type: 'analysis_story_v2',
          ...(analysisStorySnapshot ? { analysis_story_snapshot: analysisStorySnapshot } : {}),
          reply_text: replyText,
        };
        setItems((prev) => [...stripReturnWelcome(prev), { id: nextId(), role: 'user', kind: 'text', content: replyText }]);
        await sendChat(
          undefined,
          {
            action_id: effectiveActionId,
            kind: 'chip',
            data: actionPayloadDataWithAnalysis,
          },
          {
            client_state: fromState,
            requested_transition: requestedTransition,
            analysisContext,
          },
        );
        return;
      }

      if (isV2FreeformFallback) {
        await sendChat(fallbackReplyText, undefined, {
          client_state: fromState,
          requested_transition: requestedTransition,
        });
        return;
      }

      await sendChat(
        undefined,
        {
          action_id: outgoingActionId,
          kind: 'chip',
          data: actionPayloadData,
        },
        { client_state: fromState, requested_transition: requestedTransition },
      );
    },
    [
      agentState,
      bootstrapInfo?.profile,
      headers,
      language,
      profileSnapshot,
      quickProfileBusy,
      quickProfileDraft,
      runLowConfidenceSkinAnalysis,
      sendChat,
      authSession,
      getLatestAnalysisStorySnapshot,
      getSanitizedAnalysisPhotos,
      persistQuickProfilePatch,
      setAgentStateSafe,
    ]
  );

  const deepLinkChip = useCallback(
    (chipId: string, replyTextOverride?: string): SuggestedChip => {
      const id = String(chipId || '').trim();
      const isCN = language === 'CN';
      const labelMap: Record<string, { EN: string; CN: string }> = {
        chip_quick_profile: { EN: '30-sec quick profile', CN: '30秒快速画像' },
        chip_checkin_now: { EN: 'Check-in', CN: '打卡' },
        'chip.start.diagnosis': { EN: 'Start skin diagnosis', CN: '开始皮肤诊断' },
        chip_start_diagnosis: { EN: 'Start skin diagnosis', CN: '开始皮肤诊断' },
        'chip.start.evaluate': { EN: 'Evaluate a product', CN: '评估某个产品' },
        chip_eval_single_product: { EN: 'Evaluate a product', CN: '评估某个产品' },
        'chip.start.reco_products': { EN: 'Recommend products', CN: '产品推荐' },
        chip_get_recos: { EN: 'Recommend products', CN: '产品推荐' },
        'chip.start.routine': { EN: 'Build an AM/PM routine', CN: '生成早晚护肤 routine' },
        'chip.start.dupes': { EN: 'Find dupes / alternatives', CN: '找平替/替代品' },
        'chip.aurora.next_action.deep_dive_skin': { EN: 'Continue from my saved analysis', CN: '继续这次分析结果' },
        'chip.start.ingredients.entry': { EN: 'Ingredient science (evidence)', CN: '成分机理/证据链' },
        'chip.start.ingredients': { EN: 'Ingredient science (evidence)', CN: '成分机理/证据链' },
      };

      const label = (labelMap[id]?.[isCN ? 'CN' : 'EN'] ?? id).slice(0, 80);
      const replyTextMap: Record<string, { EN: string; CN: string }> = {
        'chip.start.ingredients.entry': {
          EN: 'I want ingredient science (evidence/mechanism), not product recommendations yet.',
          CN: '我想聊成分科学（证据/机制），先不做产品推荐。',
        },
        'chip.start.ingredients': {
          EN: 'I want ingredient science (evidence/mechanism), not product recommendations yet.',
          CN: '我想聊成分科学（证据/机制），先不做产品推荐。',
        },
        'chip.aurora.next_action.deep_dive_skin': {
          EN: 'Continue from my saved skin analysis. Do not ask me to restate my goals. Tell me the next best steps.',
          CN: '基于我保存的 skin analysis 继续，不要让我重复目标，直接告诉我下一步该怎么做。',
        },
      };
      const reply_text = (asString(replyTextOverride) || (replyTextMap[id]?.[isCN ? 'CN' : 'EN'] ?? label)).slice(0, 220);
      return {
        chip_id: id,
        label,
        kind: 'quick_reply',
        data: { reply_text, trigger_source: 'deeplink' },
      };
    },
    [language],
  );

  useEffect(() => {
    const nextBriefId = String(searchParams.brief_id || '').trim();
    if (!nextBriefId) return;
    if (nextBriefId === headers.brief_id) return;

    const nextTraceId = String(searchParams.trace_id || '').trim() || makeDefaultHeaders(language).trace_id;

    setError(null);
    setSessionState('idle');
    setAgentStateSafe('IDLE_CHAT');
    setQuickProfileStep('skin_feel');
    setQuickProfileDraft({});
    setQuickProfileBusy(false);
    setChatBusy(false);
    setAnalysisBusy(false);
    setRoutineFormBusy(false);
    setIngredientQuestionBusy(false);
    setItems([]);
    setAnalysisPhotoRefs([]);
    setSessionPhotos({});
    setBootstrapInfo(null);
    setPendingRecoGoalOther(false);
    pendingActionAfterDiagnosisRef.current = null;
    sessionStartedEmittedRef.current = false;
    returnVisitEmittedRef.current = false;
    openIntentConsumedRef.current = null;
    actionIntentConsumedRef.current = null;

    setProfileSheetOpen(false);
    setCheckinSheetOpen(false);
    setPhotoSheetOpen(false);
    setPhotoSheetAutoOpenSlot(null);
    setRoutineSheetOpen(false);
    setProductSheetOpen(false);
    setDupeSheetOpen(false);
    setAuthSheetOpen(false);

    setHasBootstrapped(false);
    setHeaders((prev) => ({
      ...prev,
      brief_id: nextBriefId.slice(0, 128),
      trace_id: nextTraceId.slice(0, 128),
    }));
  }, [headers.brief_id, language, searchParams.brief_id, searchParams.trace_id, setAgentStateSafe]);

  useEffect(() => {
    if (searchParams.brief_id && searchParams.brief_id !== headers.brief_id) return;
    if (!searchParams.open) {
      openIntentConsumedRef.current = null;
      return;
    }

    const sig = [searchParams.brief_id, searchParams.trace_id, searchParams.open].map((v) => String(v || '')).join('|');
    if (openIntentConsumedRef.current === sig) return;
    openIntentConsumedRef.current = sig;

    if (searchParams.open === 'photo') {
      setPromptRoutineAfterPhoto(false);
      setPhotoSheetAutoOpenSlot(null);
      setPhotoSheetOpen(true);
    }
    if (searchParams.open === 'routine') {
      setRoutineDraft(makeEmptyRoutineDraft());
      setRoutineTab('am');
      setRoutineSheetOpen(true);
    }
    if (searchParams.open === 'checkin') {
      setCheckinSheetOpen(true);
    }
    if (searchParams.open === 'profile') {
      setProfileSheetOpen(true);
    }
    if (searchParams.open === 'auth') {
      setAuthError(null);
      setAuthNotice(null);
      setAuthStage('email');
      setAuthDraft((prev) => ({ ...prev, code: '', password: '', newPassword: '', newPasswordConfirm: '' }));
      setAuthSheetOpen(true);
    }
    const suppressRoutineAutoChip = searchParams.open === 'routine' && searchParams.chip_id === 'chip.start.routine';

    try {
      const sp = new URLSearchParams(window.location.search);
      let changed = false;
      if (sp.has('open')) {
        sp.delete('open');
        changed = true;
      }
      if (suppressRoutineAutoChip && sp.get('chip_id') === 'chip.start.routine') {
        sp.delete('chip_id');
        changed = true;
      }
      if (!sp.get('brief_id') && headers.brief_id) {
        sp.set('brief_id', headers.brief_id);
        changed = true;
      }
      if (!sp.get('trace_id') && headers.trace_id) {
        sp.set('trace_id', headers.trace_id);
        changed = true;
      }
      if (changed) {
        const next = sp.toString();
        navigate({ pathname: '/chat', search: next ? `?${next}` : '' }, { replace: true });
      }
    } catch {
      // ignore
    }
  }, [headers.brief_id, headers.trace_id, navigate, searchParams]);

  useEffect(() => {
    if (!hasBootstrapped) return;
    if (searchParams.brief_id && searchParams.brief_id !== headers.brief_id) return;
    const suppressRoutineAutoChip = searchParams.open === 'routine' && searchParams.chip_id === 'chip.start.routine';
    const hasActionIntent = Boolean(searchParams.q || searchParams.chip_id) && !suppressRoutineAutoChip;
    if (!hasActionIntent) {
      actionIntentConsumedRef.current = null;
      return;
    }

    const sig = [searchParams.brief_id, searchParams.trace_id, searchParams.q, searchParams.chip_id]
      .map((v) => String(v || ''))
      .join('|');
    if (actionIntentConsumedRef.current === sig) return;
    actionIntentConsumedRef.current = sig;

    const clearActionIntentParams = () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        let changed = false;
        for (const k of ['q', 'chip_id']) {
          if (!sp.has(k)) continue;
          sp.delete(k);
          changed = true;
        }
        if (!sp.get('brief_id') && headers.brief_id) {
          sp.set('brief_id', headers.brief_id);
          changed = true;
        }
        if (!sp.get('trace_id') && headers.trace_id) {
          sp.set('trace_id', headers.trace_id);
          changed = true;
        }
        if (changed) {
          const next = sp.toString();
          navigate({ pathname: '/chat', search: next ? `?${next}` : '' }, { replace: true });
        }
      } catch {
        // ignore
      }
    };

    // Clear deeplink action params immediately to avoid stale chip_id replay during rapid rerenders.
    clearActionIntentParams();

    const run = async () => {
      if (searchParams.chip_id) {
        await onChip(deepLinkChip(searchParams.chip_id, searchParams.q));
        return;
      }
      if (searchParams.q) {
        await submitText(searchParams.q);
      }
    };
    void run().finally(() => clearActionIntentParams());
  }, [deepLinkChip, hasBootstrapped, headers.brief_id, headers.trace_id, navigate, onChip, searchParams, submitText]);

  const canSend = useMemo(() => !isLoading && input.trim().length > 0, [isLoading, input]);
  const flowState = useMemo(() => {
    const s = String(sessionState || '').trim();
    return ((s && s.startsWith('S')) ? s : 'S0_LANDING') as FlowState;
  }, [sessionState]);
  const sessionForCards = useMemo<Session>(() => {
    return {
      brief_id: headers.brief_id,
      trace_id: headers.trace_id,
      mode: 'live',
      state: flowState,
      clarification_count: 0,
      photos: sessionPhotos,
      selected_offers: {},
    };
  }, [headers.brief_id, headers.trace_id, flowState, sessionPhotos]);

  const resolveOffers = useCallback(
    async (args: { sku_id?: string | null; product_id?: string | null; merchant_id?: string | null }) => {
      const skuId = String(args.sku_id || '').trim();
      const productId = String(args.product_id || '').trim();
      const merchantId = String(args.merchant_id || '').trim();
      const product: Record<string, string> = {
        ...(skuId ? { sku_id: skuId } : {}),
        ...(productId ? { product_id: productId } : {}),
        ...(merchantId ? { merchant_id: merchantId } : {}),
      };
      if (!Object.keys(product).length) {
        throw new Error('offers.resolve requires sku_id or product_id');
      }
      const requestHeaders = { ...headers, lang: language };
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), VIEW_DETAILS_REQUEST_TIMEOUT_MS);
      try {
        return await bffJson<any>('/agent/shop/v1/invoke', requestHeaders, {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            operation: 'offers.resolve',
            payload: { offers: { product, market: 'US', tool: '*', limit: 5 } },
            metadata: { source: 'chatbox' },
          }),
        });
      } finally {
        window.clearTimeout(timer);
      }
    },
    [headers, language],
  );

  const resolveProductRef = useCallback(
    async ({
      query,
      lang,
      hints,
      signal,
    }: {
      query: string;
      lang: 'en' | 'cn';
      hints?: {
        product_ref?: { product_id?: string | null; merchant_id?: string | null } | null;
        product_id?: string | null;
        sku_id?: string | null;
        aliases?: Array<string | null | undefined>;
        brand?: string | null;
        title?: string | null;
      };
      signal?: AbortSignal;
    }) => {
      const q = String(query || '').trim();
      if (!q) throw new Error('products.resolve requires query');
      const requestHeaders = { ...headers, lang: language };
      const hintObject = hints && typeof hints === 'object' ? hints : undefined;
      return await bffJson<any>('/agent/v1/products/resolve', requestHeaders, {
        method: 'POST',
        ...(signal ? { signal } : {}),
        body: JSON.stringify({
          query: q,
          lang,
          caller: 'aurora_chatbox',
          session_id: headers.brief_id,
          ...(hintObject ? { hints: hintObject } : {}),
          options: {
            timeout_ms: VIEW_DETAILS_RESOLVE_TIMEOUT_MS,
            search_all_merchants: true,
            upstream_retries: 0,
            candidates_limit: 12,
            allow_external_seed: false,
          },
        }),
      });
    },
    [headers, language],
  );

  const resolveProductsSearch = useCallback(
    async ({
      query,
      limit,
      preferBrand,
      uiSurface,
      clarificationSlot,
      clarificationAnswer,
      slotState,
    }: {
      query: string;
      limit?: number;
      preferBrand?: string | null;
      uiSurface?: string | null;
      clarificationSlot?: string | null;
      clarificationAnswer?: string | null;
      slotState?: ProductSearchSlotState | null;
    }) => {
      const q = String(query || '').trim();
      if (!q) throw new Error('products.search requires query');
      const brand = String(preferBrand || '').trim();
      const requestHeaders = { ...headers, lang: language };
      const requestedLimit = Math.max(1, Math.min(12, Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 8));
      const queryWithHint =
        brand && !q.toLowerCase().includes(brand.toLowerCase())
          ? `${brand} ${q}`.trim()
          : q;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), TRAVEL_PRODUCT_LOOKUP_TIMEOUT_MS);
      const params = new URLSearchParams({
        query: queryWithHint,
        limit: String(requestedLimit),
        offset: '0',
        search_all_merchants: 'true',
        in_stock_only: 'false',
        lang: language === 'CN' ? 'cn' : 'en',
        source: 'aurora_chatbox',
        catalog_surface: 'beauty',
        ...(uiSurface ? { ui_surface: uiSurface } : {}),
        ...(uiSurface === 'travel_lookup'
          ? {
              allow_external_seed: 'true',
              external_seed_strategy: 'unified_relevance',
              fast_mode: 'true',
            }
          : {}),
        ...(clarificationSlot ? { clarification_slot: clarificationSlot } : {}),
        ...(clarificationAnswer ? { clarification_answer: clarificationAnswer } : {}),
        ...(slotState &&
        ((Array.isArray(slotState.asked_slots) && slotState.asked_slots.length > 0) ||
          Object.keys(slotState.resolved_slots || {}).length > 0)
          ? { slot_state: JSON.stringify(slotState) }
          : {}),
      });
      try {
        return await bffJson<any>(`/agent/v1/products/search?${params.toString()}`, requestHeaders, {
          method: 'GET',
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timer);
      }
    },
    [headers, language],
  );

  return (
    <div className="chat-container">
      <header className="chat-header">
        <button type="button" className="ios-nav-button ml-1" onClick={() => setSidebarOpen(true)} aria-label={t('common.open_menu', language)}>
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <div className="flex-1 text-center leading-tight">
          <div className="font-semibold tracking-[-0.02em] text-foreground" style={{ fontSize: 'calc(var(--aurora-chat-text-size) + 1px)' }}>
            Aurora
          </div>
          <div className="text-muted-foreground" style={{ fontSize: 'calc(var(--aurora-chat-text-size) - 3px)' }}>
            {language === 'CN' ? '你的 AI 护肤助手' : 'Your AI skincare assistant'}
          </div>
        </div>

        <div className="ios-header-spacer" aria-hidden />
      </header>

      <main className="chat-messages scrollbar-hide">
        <div className="mx-auto max-w-lg space-y-[var(--aurora-chat-stack-gap)]">
          <Sheet
            open={authSheetOpen}
            title={language === 'CN' ? '登录 / 账户' : 'Sign in / Account'}
            onClose={() => setAuthSheetOpen(false)}
            onOpenMenu={() => {
              setAuthSheetOpen(false);
              setSidebarOpen(true);
            }}
          >
            <div className="space-y-3">
              {authSession ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                    <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '已登录' : 'Signed in'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{authSession.email}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                    <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '密码登录' : 'Password sign-in'}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {language === 'CN'
                        ? '可选：设置/更新密码，下次可直接用邮箱 + 密码登录（验证码仍可用）。'
                        : 'Optional: set/update a password so you can sign in with email + password next time (OTP still works).'}
                    </div>
                    <div className="mt-3 space-y-3">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '新密码（至少 8 位）' : 'New password (min 8 chars)'}
                        <input
                          className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={authDraft.newPassword}
                          onChange={(e) => setAuthDraft((p) => ({ ...p, newPassword: e.target.value }))}
                          placeholder={language === 'CN' ? '输入新密码' : 'Enter new password'}
                          disabled={authLoading}
                          type="password"
                          autoComplete="new-password"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '确认密码' : 'Confirm password'}
                        <input
                          className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={authDraft.newPasswordConfirm}
                          onChange={(e) => setAuthDraft((p) => ({ ...p, newPasswordConfirm: e.target.value }))}
                          placeholder={language === 'CN' ? '再次输入' : 'Re-enter'}
                          disabled={authLoading}
                          type="password"
                          autoComplete="new-password"
                        />
                      </label>
                      <button
                        type="button"
                        className="chip-button chip-button-primary"
                        onClick={() => void savePassword()}
                        disabled={authLoading || !authDraft.newPassword || !authDraft.newPasswordConfirm}
                      >
                        {authLoading ? (language === 'CN' ? '保存中…' : 'Saving…') : language === 'CN' ? '保存密码' : 'Save password'}
                      </button>
                      {authNotice ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                          {authNotice}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <button type="button" className="chip-button chip-button-primary" onClick={() => void refreshBootstrapInfo()} disabled={authLoading}>
                    {language === 'CN' ? '刷新资料' : 'Refresh profile'}
                  </button>
                  <button type="button" className="chip-button" onClick={() => void signOut()} disabled={authLoading}>
                    {language === 'CN' ? '退出登录' : 'Sign out'}
                  </button>
                  {authError ? <div className="text-xs text-red-600">{authError}</div> : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`chip-button ${authMode === 'code' ? 'chip-button-primary' : ''}`}
                      onClick={() => {
                        setAuthMode('code');
                        setAuthStage('email');
                        setAuthError(null);
                        setAuthNotice(null);
                        setAuthDraft((p) => ({ ...p, code: '', password: '' }));
                      }}
                      disabled={authLoading}
                    >
                      {language === 'CN' ? '验证码' : 'Email code'}
                    </button>
                    <button
                      type="button"
                      className={`chip-button ${authMode === 'password' ? 'chip-button-primary' : ''}`}
                      onClick={() => {
                        setAuthMode('password');
                        setAuthError(null);
                        setAuthNotice(null);
                        setAuthDraft((p) => ({ ...p, code: '' }));
                      }}
                      disabled={authLoading}
                    >
                      {language === 'CN' ? '密码' : 'Password'}
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {authMode === 'password'
                      ? language === 'CN'
                        ? '用邮箱 + 密码登录。如果还没设置密码，请先用验证码登录后在账户里设置。'
                        : "Sign in with email + password. If you haven't set a password, use email code first, then set one in Account."
                      : language === 'CN'
                        ? '输入邮箱获取验证码（用于跨设备保存你的皮肤档案）。'
                        : 'Enter your email to get a sign-in code (for cross-device profile).'}
                  </div>

                  <label className="space-y-1 text-xs text-muted-foreground">
                    {language === 'CN' ? '邮箱' : 'Email'}
                    <input
                      className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                      value={authDraft.email}
                      onChange={(e) => setAuthDraft((p) => ({ ...p, email: e.target.value }))}
                      placeholder="name@email.com"
                      disabled={authLoading}
                      inputMode="email"
                      autoComplete="email"
                    />
                  </label>

                  {authMode === 'password' ? (
                    <div className="space-y-3">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '密码' : 'Password'}
                        <input
                          className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={authDraft.password}
                          onChange={(e) => setAuthDraft((p) => ({ ...p, password: e.target.value }))}
                          placeholder={language === 'CN' ? '输入密码' : 'Enter password'}
                          disabled={authLoading}
                          type="password"
                          autoComplete="current-password"
                        />
                      </label>
                      <button
                        type="button"
                        className="chip-button chip-button-primary"
                        onClick={() => void passwordLogin()}
                        disabled={authLoading || !authDraft.email.trim() || !authDraft.password}
                      >
                        {authLoading ? (language === 'CN' ? '登录中…' : 'Signing in…') : language === 'CN' ? '密码登录' : 'Sign in'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {authStage === 'email' ? (
                        <button type="button" className="chip-button chip-button-primary" onClick={() => void startAuth()} disabled={authLoading}>
                          {authLoading ? (language === 'CN' ? '发送中…' : 'Sending…') : language === 'CN' ? '发送验证码' : 'Send code'}
                        </button>
                      ) : null}

                      {authStage === 'code' ? (
                        <div className="space-y-3">
                          <label className="space-y-1 text-xs text-muted-foreground">
                            {language === 'CN' ? '验证码' : 'Code'}
                            <input
                              className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                              value={authDraft.code}
                              onChange={(e) => setAuthDraft((p) => ({ ...p, code: e.target.value }))}
                              placeholder={language === 'CN' ? '6 位数字' : '6-digit code'}
                              disabled={authLoading}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                            />
                          </label>
                          <div className="dialog-choice-row">
                            <button type="button" className="chip-button" onClick={() => setAuthStage('email')} disabled={authLoading}>
                              {language === 'CN' ? '返回' : 'Back'}
                            </button>
                            <button
                              type="button"
                              className="chip-button chip-button-primary"
                              onClick={() => void verifyAuth()}
                              disabled={authLoading || !authDraft.code.trim()}
                            >
                              {authLoading ? (language === 'CN' ? '验证中…' : 'Verifying…') : language === 'CN' ? '验证登录' : 'Verify'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}

                  {authError ? <div className="text-xs text-red-600">{authError}</div> : null}
                  {authNotice ? <div className="text-xs text-emerald-700">{authNotice}</div> : null}
                </div>
              )}
            </div>
          </Sheet>
          <Sheet
            open={photoSheetOpen}
            title={language === 'CN' ? '上传照片（推荐）' : 'Upload photo (recommended)'}
            onClose={() => {
              if (isLoading || photoUploading) return;
              setPhotoSheetOpen(false);
              setPhotoSheetAutoOpenSlot(null);
              setPromptRoutineAfterPhoto(false);
            }}
            onOpenMenu={() => {
              if (isLoading || photoUploading) return;
              setPhotoSheetOpen(false);
              setPhotoSheetAutoOpenSlot(null);
              setPromptRoutineAfterPhoto(false);
              setSidebarOpen(true);
            }}
          >
            <PhotoUploadCard
              language={language}
              onAction={onPhotoAction}
              uploading={photoUploading}
              autoOpenSlot={photoSheetAutoOpenSlot}
              autoOpenNonce={photoSheetAutoOpenNonce}
            />
          </Sheet>
          <Sheet
            open={routineSheetOpen}
            title={language === 'CN' ? '填写你在用的 AM/PM 产品（更准）' : 'Add your AM/PM products (more accurate)'}
            onClose={() => setRoutineSheetOpen(false)}
            onOpenMenu={() => {
              setRoutineSheetOpen(false);
              setSidebarOpen(true);
            }}
          >
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {language === 'CN'
                  ? '如果你愿意，补充最近在用的 AM/PM 产品/步骤会更准；也可以直接跳过，我会先给低置信度 7 天安全基线（不评分/不推推荐）。'
                  : 'If you want, add your current AM/PM products for higher accuracy. You can also skip and I will give a low-confidence 7-day safe baseline first (no scoring, no recommendations).'}
              </div>

              <div
                className="inline-flex w-full items-center justify-between gap-2 rounded-2xl border border-border/50 bg-background/40 p-1"
                role="tablist"
                aria-label={language === 'CN' ? '选择早晚' : 'Choose AM/PM'}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={routineTab === 'am'}
                  className={`flex-1 rounded-2xl px-3 py-2 text-xs font-semibold transition-colors ${
                    routineTab === 'am' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60'
                  }`}
                  onClick={() => setRoutineTab('am')}
                  disabled={routineFormBusy}
                >
                  {language === 'CN' ? '早上（AM）' : 'Morning (AM)'}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={routineTab === 'pm'}
                  className={`flex-1 rounded-2xl px-3 py-2 text-xs font-semibold transition-colors ${
                    routineTab === 'pm' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60'
                  }`}
                  onClick={() => setRoutineTab('pm')}
                  disabled={routineFormBusy}
                >
                  {language === 'CN' ? '晚上（PM）' : 'Evening (PM)'}
                </button>
              </div>

              <div className="space-y-3 pb-20">
                {routineTab === 'am' ? (
                  <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                    <div className="grid gap-2">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '洁面' : 'Cleanser'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.am.cleanser}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, cleanser: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：CeraVe Foaming Cleanser / 链接' : 'e.g., CeraVe Foaming Cleanser / link'}
                          disabled={routineFormBusy}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '活性/精华（可选）' : 'Treatment/active (optional)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.am.treatment}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, treatment: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：烟酰胺 / VC / 无' : 'e.g., niacinamide / vitamin C / none'}
                          disabled={routineFormBusy}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '保湿（可选）' : 'Moisturizer (optional)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.am.moisturizer}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, moisturizer: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：CeraVe PM / 无' : 'e.g., CeraVe PM / none'}
                          disabled={routineFormBusy}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '防晒 SPF（可选但推荐）' : 'SPF (optional but recommended)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.am.spf}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, spf: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：EltaMD UV Clear / 无' : 'e.g., EltaMD UV Clear / none'}
                          disabled={routineFormBusy}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-muted-foreground">
                        {language === 'CN' ? '如果晚上用法和早上一样，可一键复制。' : 'If PM is the same as AM, copy in one tap.'}
                      </div>
                      <button
                        type="button"
                        className="chip-button !px-3 !py-1.5 text-[11px] whitespace-nowrap"
                        onClick={() => setRoutineDraft((prev) => copyRoutineAmToPm(prev))}
                        disabled={routineFormBusy || !hasAnyRoutineAmInput(routineDraft)}
                      >
                        {language === 'CN' ? '同 AM' : 'Same as AM'}
                      </button>
                    </div>
                    <div className="grid gap-2">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '洁面' : 'Cleanser'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.pm.cleanser}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, cleanser: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：同 AM / 或不同产品' : 'e.g., same as AM / or different'}
                          disabled={routineFormBusy}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '活性/精华（可选）' : 'Treatment/active (optional)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.pm.treatment}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, treatment: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：Retinol / AHA/BHA / 无' : 'e.g., retinol / AHA/BHA / none'}
                          disabled={routineFormBusy}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '保湿（可选）' : 'Moisturizer (optional)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.pm.moisturizer}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, moisturizer: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：CeraVe PM / 无' : 'e.g., CeraVe PM / none'}
                          disabled={routineFormBusy}
                        />
                      </label>
                    </div>
                  </div>
                )}

                <details className="rounded-2xl border border-border/50 bg-background/40 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-foreground">
                    {language === 'CN' ? '备注（可选）' : 'Notes (optional)'}
                  </summary>
                  <div className="mt-2">
                    <textarea
                      className="min-h-[68px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground"
                      value={routineDraft.notes}
                      onChange={(e) => setRoutineDraft((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder={
                        language === 'CN'
                          ? '例如：用了 retinol 会刺痛；最近泛红…'
                          : 'e.g., stings after retinol; recent redness…'
                      }
                      disabled={routineFormBusy}
                    />
                  </div>
                </details>
              </div>

              <div className="sticky bottom-0 -mx-[var(--aurora-page-x)] border-t border-border/40 bg-card/95 px-[var(--aurora-page-x)] pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
                <div className="flex gap-2">
                  <button type="button" className="chip-button" onClick={() => setRoutineSheetOpen(false)} disabled={routineFormBusy}>
                    {language === 'CN' ? '取消' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className="chip-button"
                    onClick={() => {
                      setRoutineSheetOpen(false);
                      setRoutineDraft(makeEmptyRoutineDraft());
                      setItems((prev) => [
                        ...prev,
                        {
                          id: nextId(),
                          role: 'user',
                          kind: 'text',
                          content: language === 'CN' ? '直接分析（低置信度）' : 'Skip and analyze (low confidence)',
                        },
                      ]);
                      void runLowConfidenceSkinAnalysis({ fromRoutineForm: true });
                    }}
                    disabled={routineFormBusy}
                  >
                    {language === 'CN' ? '先给基线' : 'Baseline only'}
                  </button>
                  <button
                    type="button"
                    className="chip-button chip-button-primary flex-1"
                    disabled={routineFormBusy || !hasAnyRoutineDraftInput(routineDraft)}
                    onClick={() => {
                      const payload = buildCurrentRoutinePayloadFromDraft(routineDraft);
                      const text = routineDraftToDisplayText(routineDraft, language);
                      setRoutineSheetOpen(false);
                      setRoutineDraft(makeEmptyRoutineDraft());
                      setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: text }]);
                      void runRoutineSkinAnalysis(payload, undefined, { fromRoutineForm: true });
                    }}
                  >
                    {language === 'CN' ? '保存并分析' : 'Save & analyze'}
                  </button>
                </div>
              </div>
            </div>
          </Sheet>
          <Sheet
            open={productSheetOpen}
            title={language === 'CN' ? '单品评估（Deep Scan）' : 'Product deep scan'}
            onClose={() => setProductSheetOpen(false)}
            onOpenMenu={() => {
              setProductSheetOpen(false);
              setSidebarOpen(true);
            }}
          >
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {language === 'CN'
                  ? '把产品名或链接发我，我会先帮你解析，再做单品评估。'
                  : 'Share a product name or link, and I will parse it first, then run a product deep scan.'}
              </div>
              <input
                className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                value={productDraft}
                onChange={(e) => setProductDraft(e.target.value)}
                placeholder={language === 'CN' ? '例如：Nivea Creme / https://…' : 'e.g., Nivea Creme / https://…'}
                disabled={isLoading}
              />
              <div className="dialog-choice-row">
                <button type="button" className="chip-button" onClick={() => setProductSheetOpen(false)} disabled={isLoading}>
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="chip-button chip-button-primary"
                  disabled={isLoading || !productDraft.trim()}
                  onClick={() => {
                    const text = productDraft.trim();
                    setProductSheetOpen(false);
                    setProductDraft('');
                    void runProductDeepScan(text);
                  }}
                >
                  {language === 'CN' ? '开始评估' : 'Analyze'}
                </button>
              </div>
            </div>
          </Sheet>

          <Sheet
            open={dupeSheetOpen}
            title={language === 'CN' ? '找平替 / 同类对标' : 'Find dupes'}
            onClose={() => setDupeSheetOpen(false)}
            onOpenMenu={() => {
              setDupeSheetOpen(false);
              setSidebarOpen(true);
            }}
          >
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {language === 'CN'
                  ? '把目标商品名或链接发我，我会自动匹配平替和同类对标，并给你清晰的 tradeoffs。'
                  : 'Share the target product name or link, and I will match dupes/comparables and summarize clear tradeoffs.'}
              </div>

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '目标商品' : 'Target product'}
                <input
                  className="h-11 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                  value={dupeDraft.original}
                  onChange={(e) => setDupeDraft((p) => ({ ...p, original: e.target.value }))}
                  placeholder={language === 'CN' ? '例如：Nivea Creme / https://…' : 'e.g., Nivea Creme / https://…'}
                  disabled={isLoading}
                />
              </label>

              <div className="dialog-choice-row">
                <button type="button" className="chip-button" onClick={() => setDupeSheetOpen(false)} disabled={isLoading}>
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  className="chip-button chip-button-primary"
                  disabled={isLoading || !dupeDraft.original.trim()}
                  onClick={() => {
                    const original = dupeDraft.original.trim();
                    if (!original) {
                      setError(language === 'CN' ? '请先填写「目标商品」。' : 'Please provide a target product.');
                      return;
                    }
                    setDupeSheetOpen(false);
                    setDupeDraft({ original: '' });
                    void runDupeSearch(original);
                  }}
                >
                  {language === 'CN' ? '开始匹配' : 'Find'}
                </button>
              </div>
            </div>
          </Sheet>
          <Sheet
            open={profileSheetOpen}
            title={language === 'CN' ? '补充信息' : 'Additional info'}
            onClose={() => setProfileSheetOpen(false)}
            onOpenMenu={() => {
              setProfileSheetOpen(false);
              setSidebarOpen(true);
            }}
          >
            <div className="profile-sheet-compact space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[11px] text-muted-foreground">
                  {language === 'CN' ? '年龄段' : 'Age band'}
                  <select
                    className="h-9 w-full rounded-xl border border-border/60 bg-background/60 px-2.5 text-[13px] text-foreground"
                    value={profileDraft.age_band}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, age_band: e.target.value }))}
                  >
                    <option value="unknown">{language === 'CN' ? '未知/不填' : 'Unknown'}</option>
                    <option value="under_13">&lt;13</option>
                    <option value="13_17">13-17</option>
                    <option value="18_24">18-24</option>
                    <option value="25_34">25-34</option>
                    <option value="35_44">35-44</option>
                    <option value="45_54">45-54</option>
                    <option value="55_plus">55+</option>
                  </select>
                </label>

                <label className="space-y-1 text-[11px] text-muted-foreground">
                  {language === 'CN' ? '预算' : 'Budget'}
                  <select
                    className="h-9 w-full rounded-xl border border-border/60 bg-background/60 px-2.5 text-[13px] text-foreground"
                    value={profileDraft.budgetTier}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, budgetTier: e.target.value }))}
                  >
                    <option value="">{language === 'CN' ? '未选择' : '—'}</option>
                    <option value="¥200">¥200</option>
                    <option value="¥500">¥500</option>
                    <option value="¥1000+">¥1000+</option>
                    <option value="不确定">{language === 'CN' ? '不确定' : 'Not sure'}</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-[11px] text-muted-foreground">
                {language === 'CN' ? '常驻地/地区' : 'Home region'}
                <input
                  className="h-9 w-full rounded-xl border border-border/60 bg-background/60 px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                  value={profileDraft.region}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, region: e.target.value }))}
                  placeholder={language === 'CN' ? '例如 San Francisco, CA' : 'e.g., San Francisco, CA'}
                />
              </label>

              <label className="space-y-1 text-[11px] text-muted-foreground">
                {language === 'CN' ? '高风险用药（可选）' : 'High-risk meds (optional)'}
                <input
                  className="h-9 w-full rounded-xl border border-border/60 bg-background/60 px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70"
                  value={profileDraft.high_risk_medications_text}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, high_risk_medications_text: e.target.value }))}
                  placeholder={language === 'CN' ? '如 isotretinoin，逗号分隔' : 'e.g., isotretinoin, comma-separated'}
                />
              </label>

              <div className="dialog-choice-row">
                <button
                  type="button"
                  className="chip-button"
                  onClick={() => setProfileSheetOpen(false)}
                  disabled={isLoading}
                >
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button type="button" className="chip-button chip-button-primary" onClick={saveProfile} disabled={isLoading}>
                  {language === 'CN' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </Sheet>

          <Sheet
            open={checkinSheetOpen}
            title={language === 'CN' ? '今日打卡' : 'Daily check-in'}
            onClose={() => setCheckinSheetOpen(false)}
            onOpenMenu={() => {
              setCheckinSheetOpen(false);
              setSidebarOpen(true);
            }}
          >
            <div className="space-y-4">
              {(
                [
                  ['redness', language === 'CN' ? '泛红' : 'Redness'],
                  ['acne', language === 'CN' ? '痘痘' : 'Acne'],
                  ['hydration', language === 'CN' ? '干燥/紧绷' : 'Dryness'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span className="font-medium text-foreground">{(checkinDraft as any)[key]}/5</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={(checkinDraft as any)[key]}
                    onChange={(e) => {
                      const n = asNumber(e.target.value) ?? 0;
                      setCheckinDraft((p) => ({ ...p, [key]: Math.max(0, Math.min(5, Math.trunc(n))) } as any));
                    }}
                    className="w-full accent-[hsl(var(--primary))]"
                  />
                </div>
              ))}

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '备注（可选）' : 'Notes (optional)'}
                <textarea
                  className="min-h-[84px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground"
                  value={checkinDraft.notes}
                  onChange={(e) => setCheckinDraft((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={language === 'CN' ? '例如：今天有点刺痛/爆痘…' : 'e.g., stinging / breakout today…'}
                />
              </label>

              <div className="dialog-choice-row">
                <button type="button" className="chip-button" onClick={() => setCheckinSheetOpen(false)} disabled={isLoading}>
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button type="button" className="chip-button chip-button-primary" onClick={saveCheckin} disabled={isLoading}>
                  {language === 'CN' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </Sheet>

          <Sheet
            open={alternativesSheetOpen}
            title={language === 'CN' ? '更多替代与搭配建议' : 'More alternatives & pairing ideas'}
            onClose={() => setAlternativesSheetOpen(false)}
            onOpenMenu={() => {
              setAlternativesSheetOpen(false);
              setSidebarOpen(true);
            }}
          >
            <div className="space-y-3">
              {alternativesSheetTracks.map((track) => (
                <div key={`sheet_${track.key}`} className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="text-sm font-semibold text-foreground">{track.title}</div>
                  <div className="text-xs text-muted-foreground">{track.subtitle}</div>
                  <div className="mt-2 space-y-2">
                    {track.items.slice(0, 8).map((entry, idx) => {
                      const display = entry.display || normalizeAlternativeDisplayCandidate(entry.candidate);
                      if (!display) return null;
                      const title = display.brand ? `${idx + 1}. ${display.brand} - ${display.name}` : `${idx + 1}. ${display.name}`;
                      return (
                        <div key={`${track.key}_${display.brand || 'no_brand'}_${display.name}_${idx}`} className="rounded-lg border border-border/50 bg-muted/30 p-2">
                          <div className="text-sm font-medium text-foreground">{title}</div>
                          {display.why ? <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Why this: </span>{display.why}</div> : null}
                          {display.bestUse ? <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Best use: </span>{display.bestUse}</div> : null}
                          {display.tradeoff ? <div className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Tradeoff: </span>{display.tradeoff}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Sheet>

          {error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {items.map((item) => {
            if (item.kind === 'text') {
              const isUser = item.role === 'user';
              const isProductPicks = !isUser && looksLikeProductPicksRawText(item.content);
              if (isProductPicks) {
                return (
                  <div key={item.id} className="chat-card">
                    <ProductPicksCard
                      rawContent={item.content}
                      onPrimaryClick={() => void onProductPicksPrimary()}
                      onMakeGentler={() => void onCardAction('analysis_gentler')}
                      onKeepSimple={() => void onCardAction('analysis_simple')}
                    />
                  </div>
                );
              }

              return (
                <div key={item.id} className={cn('chat-message-row', isUser ? 'chat-message-row-user' : 'chat-message-row-assistant')}>
                  <div className={cn('chat-message-stack', isUser ? 'chat-message-stack-user' : 'chat-message-stack-assistant')}>
                    <div className={cn('chat-message-meta', isUser ? 'chat-message-meta-user' : 'chat-message-meta-assistant')}>
                      {isUser ? (language === 'CN' ? '你' : 'You') : 'Aurora'}
                    </div>
                    <div className={cn('message-bubble', isUser ? 'message-bubble-user' : 'message-bubble-assistant')}>
                      <ChatRichText text={item.content} role={isUser ? 'user' : 'assistant'} />
                    </div>
                  </div>
                </div>
              );
            }

            if (item.kind === 'return_welcome') {
              return (
                <div key={item.id} className="chat-card">
                  <ReturnWelcomeCard
                    language={language}
                    summary={item.summary}
                    chips={buildReturnWelcomeChips(language)}
                    onChip={(chip) => onChip(chip)}
                    disabled={isLoading}
                  />
                </div>
              );
            }

            if (item.kind === 'chips') {
              const chipRoles = getChipVisualRoles(item.chips);
              return (
                <div key={item.id} className="chat-card">
                  <div className="flex flex-wrap gap-2">
                    {item.chips.map((chip, chipIndex) => {
                      const Icon = iconForChip(chip.chip_id);
                      const visualRole = chipRoles[chipIndex] ?? 'default';
                      return (
                        <button
                          key={`${item.id}_${chip.chip_id}_${chipIndex}`}
                          className={cn(
                            'chip-button',
                            visualRole === 'primary' ? 'chip-button-primary' : '',
                            visualRole === 'skip' ? 'chip-button-outline chip-button-skip' : '',
                          )}
                          onClick={() => onChip(chip)}
                          disabled={isLoading}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{chip.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

              if (item.kind === 'cards') {
                const cards = Array.isArray(item.cards) ? item.cards : [];
                const simIndex = cards.findIndex((c) => isRoutineSimulationCard(c));
                const heatmapIndex = cards.findIndex((c) => isConflictHeatmapCard(c));
                const hasPair = simIndex >= 0 && heatmapIndex >= 0;
                const insertAt = hasPair ? Math.min(simIndex, heatmapIndex) : -1;

                return (
                  <div key={item.id} className="space-y-[var(--aurora-chat-stack-gap)]">
                    {cards.flatMap((card, idx) => {
                      if (hasPair && (idx === simIndex || idx === heatmapIndex)) {
                        if (idx !== insertAt) return [];
                        const simCard = cards[simIndex];
                        const heatmapCard = cards[heatmapIndex];
                        return [
                          <div key={`compat_${simCard.card_id}_${heatmapCard.card_id}`} className="chat-card">
                            <CompatibilityInsightsCard
                              routineSimulationPayload={simCard.payload}
                              conflictHeatmapPayload={heatmapCard.payload}
                              language={language}
                              debug={debug}
                              meta={item.meta}
                              analyticsCtx={{
                                brief_id: headers.brief_id,
                                trace_id: headers.trace_id,
                                aurora_uid: headers.aurora_uid,
                                lang: toLangPref(language),
                                state: agentState,
                              }}
                            />
                          </div>,
                        ];
                      }

                      return [
                        <CardRenderBoundary
                          key={card.card_id}
                          language={language}
                          cardType={String(card.type || '')}
                          cardId={card.card_id}
                        >
                          <BffCardView
                            card={card}
                            language={language}
                            debug={debug}
                            meta={item.meta}
                            requestHeaders={headers}
                            session={sessionForCards}
                            onAction={onCardAction}
                            resolveOffers={resolveOffers}
                            resolveProductRef={resolveProductRef}
                            resolveProductsSearch={resolveProductsSearch}
                            onDeepScanProduct={runProductDeepScan}
                            bootstrapInfo={bootstrapInfo}
                            profileSnapshot={profileSnapshot}
                            onOpenCheckin={() => setCheckinSheetOpen(true)}
                            onOpenProfile={() => setProfileSheetOpen(true)}
                            onIngredientQuestionSelect={onIngredientQuestionSelect}
                            ingredientQuestionBusy={ingredientQuestionBusy}
                            onOpenPdp={openPdpDrawer}
                            onOpenRecommendationAlternatives={(tracks) =>
                              openRecommendationAlternativesSheet(tracks, { source: 'card_button' })}
                            loadRecommendationAlternatives={loadRecommendationAlternatives}
                            loadRecommendationCompatibility={loadRecommendationCompatibility}
                            analysisPhotoRefs={analysisPhotoRefs}
                            sessionPhotos={sessionPhotos}
                            analyticsCtx={{
                              brief_id: headers.brief_id,
                              trace_id: headers.trace_id,
                              aurora_uid: headers.aurora_uid,
                              lang: toLangPref(language),
                              state: agentState,
                            }}
                          />
                        </CardRenderBoundary>,
                      ];
                    })}
                  </div>
                );
              }

              return null;
	          })}

	          {agentState === 'QUICK_PROFILE' ? (
	            <div className="chat-card">
	              <QuickProfileFlow
	                language={language}
	                step={quickProfileStep}
	                disabled={isLoading || quickProfileBusy}
	                onChip={(chip) => onChip(chip)}
	              />
	            </div>
	          ) : null}

	          {isLoading ? <AuroraLoadingCard language={language} intent={loadingIntent} thinkingSteps={thinkingSteps} streamedText={streamedText || undefined} /> : null}
	          <div ref={bottomRef} />
	        </div>
	      </main>

      <footer className="chat-input-container">
        <form
          className="mx-auto flex max-w-lg items-center gap-2 border border-border/60 bg-card/90 shadow-card"
          style={{
            borderRadius: 'var(--aurora-chat-composer-radius)',
            padding: 'var(--aurora-chat-composer-pad)',
          }}
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-2xl border border-border/60 bg-muted/75 text-foreground/80"
            style={{ height: 'var(--aurora-chat-control-size)', width: 'var(--aurora-chat-control-size)' }}
            onClick={handlePickPhoto}
            disabled={isLoading}
            title={t('bffchat.composer.upload_photo', language)}
          >
            <Camera className="h-[var(--aurora-chat-control-icon-size)] w-[var(--aurora-chat-control-icon-size)]" />
          </button>
          <input
            className="flex-1 bg-transparent px-2 text-foreground outline-none placeholder:text-muted-foreground/70"
            style={{ height: 'var(--aurora-chat-control-size)', fontSize: 'var(--aurora-chat-input-font-size)' }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('bffchat.composer.placeholder', language)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className={cn(
              'inline-flex items-center justify-center rounded-full transition active:scale-[0.97]',
              canSend ? 'bg-primary text-primary-foreground shadow-card' : 'bg-muted text-muted-foreground',
            )}
            style={{ height: 'var(--aurora-chat-control-size)', width: 'var(--aurora-chat-control-size)' }}
            disabled={!canSend}
          >
            <ArrowRight className="h-[var(--aurora-chat-send-icon-size)] w-[var(--aurora-chat-send-icon-size)]" />
          </button>
        </form>
      </footer>

      <AuroraSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} history={history} onOpenChat={openChatByBriefId} />
    </div>
  );
}
