import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { BffHeaders, Card, RecoBlockType, RecoEmployeeFeedbackType, SuggestedChip, V1Action, V1Envelope } from '@/lib/pivotaAgentBff';
import { bffJson, makeDefaultHeaders, PivotaAgentBffError, sendRecoEmployeeFeedback } from '@/lib/pivotaAgentBff';
import { AnalysisSummaryCard } from '@/components/chat/cards/AnalysisSummaryCard';
import { ChatRichText } from '@/components/chat/ChatRichText';
import { DiagnosisCard } from '@/components/chat/cards/DiagnosisCard';
import { PhotoUploadCard } from '@/components/chat/cards/PhotoUploadCard';
import { QuickProfileFlow } from '@/components/chat/cards/QuickProfileFlow';
import { ReturnWelcomeCard } from '@/components/chat/cards/ReturnWelcomeCard';
import { looksLikeProductPicksRawText, ProductPicksCard } from '@/components/chat/cards/ProductPicksCard';
import { AuroraAnchorCard } from '@/components/aurora/cards/AuroraAnchorCard';
import { AuroraLoadingCard, type AuroraLoadingIntent } from '@/components/aurora/cards/AuroraLoadingCard';
import { AuroraReferencesCard } from '@/components/aurora/cards/AuroraReferencesCard';
import { ConflictHeatmapCard } from '@/components/aurora/cards/ConflictHeatmapCard';
import { DupeComparisonCard } from '@/components/aurora/cards/DupeComparisonCard';
import { DupeSuggestCard } from '@/components/aurora/cards/DupeSuggestCard';
import { EnvStressCard } from '@/components/aurora/cards/EnvStressCard';
import { PhotoModulesCard } from '@/components/aurora/cards/PhotoModulesCard';
import { CompatibilityInsightsCard } from '@/components/aurora/cards/CompatibilityInsightsCard';
import { AuroraRoutineCard } from '@/components/aurora/cards/AuroraRoutineCard';
import { SkinIdentityCard } from '@/components/aurora/cards/SkinIdentityCard';
import { extractExternalVerificationCitations } from '@/lib/auroraExternalVerification';
import { humanizeKbNote } from '@/lib/auroraKbHumanize';
import { normalizePhotoModulesUiModelV1 } from '@/lib/photoModulesContract';
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
  emitUiChipClicked,
  emitUiLanguageSwitched,
  emitUiOutboundOpened,
  emitUiPdpOpened,
  emitAuroraPhotoModulesSchemaFail,
  emitUiRecosRequested,
  emitUiReturnVisit,
  emitUiSessionStarted,
  type AnalyticsContext,
} from '@/lib/auroraAnalytics';
import { buildChatSession } from '@/lib/chatSession';
import { buildReturnWelcomeSummary, type ReturnWelcomeSummary } from '@/lib/returnWelcomeSummary';
import { patchGlowSessionProfile, type QuickProfileProfilePatch } from '@/lib/glowSessionProfile';
import type { DiagnosisResult, FlowState, Language as UiLanguage, Offer, Product, Session, SkinConcern, SkinType } from '@/lib/types';
import { t } from '@/lib/i18n';
import { clearAuroraAuthSession, loadAuroraAuthSession, saveAuroraAuthSession } from '@/lib/auth';
import { getLangPref, setLangPref, type LangPref } from '@/lib/persistence';
import { isPhotoUsableForDiagnosis, normalizePhotoQcStatus } from '@/lib/photoQc';
import { buildGoogleSearchFallbackUrl, normalizeOutboundFallbackUrl } from '@/lib/externalSearchFallback';
import { toast } from '@/components/ui/use-toast';
import {
  buildPdpUrl,
  extractPdpTargetFromProductGroupId,
  extractStablePdpTargetFromProductsResolveResponse,
} from '@/lib/pivotaShop';
import { filterRecommendationCardsForState } from '@/lib/recoGate';
import { useShop } from '@/contexts/shop';
import { cn } from '@/lib/utils';
import { AuroraSidebar } from '@/components/mobile/AuroraSidebar';
import { loadChatHistory, type ChatHistoryItem } from '@/lib/chatHistory';
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

type RoutineDraft = {
  am: { cleanser: string; treatment: string; moisturizer: string; spf: string };
  pm: { cleanser: string; treatment: string; moisturizer: string };
  notes: string;
};

const makeEmptyRoutineDraft = (): RoutineDraft => ({
  am: { cleanser: '', treatment: '', moisturizer: '', spf: '' },
  pm: { cleanser: '', treatment: '', moisturizer: '' },
  notes: '',
});

const hasAnyRoutineDraftInput = (draft: RoutineDraft): boolean => {
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
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
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

const toLangPref = (language: UiLanguage): LangPref => (language === 'CN' ? 'cn' : 'en');

const getInitialLanguage = (): UiLanguage => (getLangPref() === 'cn' ? 'CN' : 'EN');

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
      chip_id: 'chip_start_diagnosis',
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
      chip_id: 'chip_start_diagnosis',
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
      return 'RECO_GATE';
    case 'chip.start.reco_products':
      return 'RECO_GATE';
    case 'chip.action.reco_routine':
      return 'RECO_GATE';
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

const iconForCard = (type: string): IconType => {
  const t = String(type || '').toLowerCase();
  if (t === 'diagnosis_gate') return Activity;
  if (t === 'budget_gate') return Wallet;
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
  if (key === 'diagnosis_gate') return language === 'CN' ? '先做一个极简肤况确认' : 'Quick skin profile first';
  if (key === 'budget_gate') return language === 'CN' ? '预算确认' : 'Budget';
  if (key === 'analysis_summary') return language === 'CN' ? '肤况分析（7 天策略）' : 'Skin assessment (7-day plan)';
  if (key === 'recommendations') return language === 'CN' ? '护肤方案（AM/PM）' : 'Routine (AM/PM)';
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

const stripInternalKbRefsFromText = (raw: string): string => {
  const input = String(raw || '');
  if (!input.trim()) return input;

  const withoutKb = input.replace(/\bkb:[a-z0-9_-]+\b/gi, '');
  const cleaned = withoutKb
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
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

const INTERNAL_MISSING_INFO_PATTERNS: RegExp[] = [
  /^reco_dag_/i,
  /^url_/i,
  /^upstream_/i,
  /^internal_/i,
  /^skin_fit\.profile\./i,
  /^raw\./i,
];

const isInternalMissingInfoCode = (code: string): boolean => {
  const token = String(code || '').trim();
  if (!token) return false;
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
const PDP_EXTERNAL_FALLBACK_REASON_CODES = new Set(['NO_CANDIDATES', 'DB_ERROR', 'UPSTREAM_TIMEOUT']);

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
  const name = asString(raw.name) || asString(raw.display_name ?? raw.displayName) || '';
  const categoryRaw = asString(raw.category) || asString((raw as any).category_name ?? (raw as any).categoryName) || '';
  const category = (!categoryRaw || isUnknownToken(categoryRaw)) ? inferCategoryFromName(name) : categoryRaw;
  const description = asString(raw.description) || '';
  const image_url = asString(raw.image_url ?? raw.imageUrl) || '';
  const size = asString(raw.size) || '';

  const product: Product = {
    sku_id: skuId,
    brand: brand || (language === 'CN' ? '未知品牌' : 'Unknown brand'),
    name: name || (language === 'CN' ? '未知产品' : 'Unknown product'),
    category: category || (language === 'CN' ? '未知品类' : 'Unknown'),
    description,
    image_url,
    size,
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
  const imageUrl = asString((r as any).image_url ?? (r as any).imageUrl) || undefined;

  let price: number | undefined;
  let currency: string | undefined;
  const offers = asArray((r as any).offers).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
  if (offers.length) {
    price = asNumber(offers[0].price) ?? undefined;
    currency = asString(offers[0].currency) ?? undefined;
  }

  const priceObj = asObject((r as any).price);
  if (price == null && priceObj) {
    const usd = asNumber(priceObj.usd ?? priceObj.USD);
    const cny = asNumber(priceObj.cny ?? priceObj.CNY);
    if (usd != null) {
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

const readBootstrapInfoFromSessionBootstrapCard = (env: V1Envelope): BootstrapInfoPatch | null => {
  const cards = Array.isArray(env.cards) ? env.cards : [];
  const bootstrapCard = cards.find((c) => String((c as any)?.type || '').trim() === 'session_bootstrap');
  const payload = bootstrapCard?.payload;
  const p = asObject(payload);
  if (!p) return null;

  const patch: BootstrapInfoPatch = {};
  if (Object.prototype.hasOwnProperty.call(p, 'profile')) {
    const rawProfile = (p as any).profile;
    patch.profile = asObject(rawProfile) ?? (rawProfile == null ? null : null);
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
  if (Object.prototype.hasOwnProperty.call(patch, 'profile')) out.profile = asObject(patch.profile) ?? (patch.profile == null ? null : null);
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]">
      <button
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-[var(--aurora-shell-max)] overflow-hidden rounded-t-3xl border border-border/50 bg-card/90 shadow-elevated backdrop-blur-xl">
        <div className="flex max-h-[85vh] max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between px-[var(--aurora-page-x)] pb-3 pt-4">
            <div className="flex items-center gap-2">
              {onOpenMenu ? (
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-foreground/80"
                  onClick={() => {
                    onOpenMenu();
                  }}
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
              ) : null}
              <div className="text-sm font-semibold text-foreground">{title}</div>
            </div>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-foreground/80"
              onClick={onClose}
              aria-label="Close"
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
    alternatives_partial: { CN: '部分步骤缺少平替/相似选项', EN: 'Alternatives missing for some steps' },
    social_data_limited: { CN: '跨平台讨论较少', EN: 'Cross-platform discussion is limited' },
    competitors_low_coverage: { CN: '同类对比样本较少', EN: 'Limited comparable products' },
    concentration_unknown: { CN: '成分浓度未披露', EN: 'Concentration is not disclosed' },
    analysis_in_progress: { CN: '分析进行中，结果会继续补全', EN: 'Analysis is in progress and will continue to improve' },
    upstream_analysis_missing: { CN: '分析进行中，结果会继续补全', EN: 'Analysis is in progress and will continue to improve' },
    url_ingredient_analysis_used: { CN: '已从商品页补抓成分信息', EN: 'Ingredient details were retrieved from the product page' },
    url_realtime_product_intel_used: { CN: '已启用实时分析补全结果', EN: 'Real-time analysis was used to fill missing data' },
    'skin_fit.profile.skinType': { CN: '未提供肤质信息', EN: 'Skin type was not provided' },
    'skin_fit.profile.sensitivity': { CN: '未提供敏感度信息', EN: 'Sensitivity was not provided' },
    'skin_fit.profile.barrierStatus': { CN: '未提供屏障状态', EN: 'Barrier status was not provided' },
  };
  if (map[c]?.[language]) return map[c][language];
  if (isInternalMissingInfoCode(c)) return '';
  return c;
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
  resolveProductsSearch?: (args: { query: string; limit?: number; preferBrand?: string | null }) => Promise<any>;
  onDeepScanProduct?: (inputText: string) => void;
  onOpenPdp?: (args: { url: string; title?: string }) => void;
  analyticsCtx?: AnalyticsContext;
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
    subject_product_group_id?: string | null;
    canonical_product_ref?: { product_id?: string | null; merchant_id?: string | null } | null;
    resolve_query?: string | null;
    hints?: ProductResolverHints;
    pdp_open?: {
      path?: string | null;
      external?: { query?: string | null; url?: string | null } | null;
    } | null;
  };
  const [detailsFlow, setDetailsFlow] = useState<{ key: string | null; state: PdpOpenState }>({ key: null, state: 'idle' });
  const inflightByKeyRef = useRef<Map<string, { controller: AbortController; promise: Promise<void> }>>(new Map());
  const clickLockByKeyRef = useRef<Set<string>>(new Set());

  const payload = asObject(card.payload) || {};
  const items = asArray(payload.recommendations) as RecoItem[];
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
          if (preferredPdpPath === 'external') {
            openPath = 'external';
            setDetailsFlow({ key: anchorKey, state: 'opening_external' });
            const hintedExternalQuery =
              String(card.pdp_open?.external?.query || '').trim() ||
              String(card.resolve_query || '').trim() ||
              [safeBrand, safeName]
                .map((v) => String(v || '').trim())
                .filter(Boolean)
                .join(' ')
                .trim();
            const hintedExternalUrl = normalizeOutboundFallbackUrl(String(card.pdp_open?.external?.url || '').trim());
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
            toast({
              title: language === 'CN' ? '无法打开外部页面' : 'Unable to open external page',
              description:
                language === 'CN'
                  ? '浏览器可能拦截了新标签页弹窗，请允许后重试。'
                  : 'Your browser may have blocked the popup. Please allow popups and retry.',
            });
            return;
          }

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

          let resolvedTarget: { product_id: string; merchant_id?: string | null } | null = null;
          let allowExternalFallback = false;
          const resolveQuery = String(card.resolve_query || '').trim();

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
                allowExternalFallback = failure.allowExternalFallback;
              }
              if (debug) {
                // eslint-disable-next-line no-console
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
            resolveQuery ||
            [safeBrand, safeName]
              .map((v) => String(v || '').trim())
              .filter(Boolean)
              .join(' ')
              .trim();
          const external = openExternalGoogle(externalQuery);
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

  const renderStep = (item: RecoItem, idx: number) => {
    const sku = asObject(item.sku) || asObject(item.product) || null;
    const itemRef = asObject((item as any).product_ref) || asObject((item as any).productRef) || null;
    const skuRef = asObject((sku as any)?.product_ref) || asObject((sku as any)?.productRef) || null;
    const itemCanonicalTop =
      asObject((item as any).canonical_product_ref) ||
      asObject((item as any).canonicalProductRef) ||
      null;
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
    const brand = asString(sku?.brand) || asString((sku as any)?.Brand) || null;
    const nameFromName = asString(sku?.name) || asString((sku as any)?.Name) || null;
    const nameFromDisplay = asString(sku?.display_name) || asString((sku as any)?.displayName) || null;
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
    const rawProductId =
      asString((item as any)?.product_id) ||
      asString((item as any)?.productId) ||
      asString((sku as any)?.product_id) ||
      asString((sku as any)?.productId) ||
      null;
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
    const pdpOpenHint = pdpOpen
      ? {
          path: asString((pdpOpen as any)?.path) || null,
          external: pdpOpenExternal
            ? {
                query: asString((pdpOpenExternal as any)?.query) || null,
                url: asString((pdpOpenExternal as any)?.url) || null,
              }
            : null,
        }
      : null;
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
    const anchorId = subjectProductGroupId || canonicalProductId || productId || skuId || (q ? `q:${q}` : null);
    const isResolving = detailsFlow.state === 'resolving' && detailsFlow.key === anchorId;
    const step = asString(item.step) || asString(item.category) || (language === 'CN' ? '步骤' : 'Step');
    const notes = asArray(item.notes).map((n) => asString(n)).filter(Boolean) as string[];
    const alternativesRaw = asArray((item as any).alternatives).map((v) => asObject(v)).filter(Boolean) as Array<Record<string, unknown>>;
    const evidencePack = asObject((item as any).evidence_pack) || asObject((item as any).evidencePack) || null;
    const keyActives = asArray(evidencePack?.keyActives ?? evidencePack?.key_actives)
      .map((v) => asString(v))
      .filter(Boolean) as string[];
    const comparisonNotes = asArray(evidencePack?.comparisonNotes ?? evidencePack?.comparison_notes)
      .map((v) => asString(v))
      .filter(Boolean) as string[];
    const sensitivityFlags = asArray(evidencePack?.sensitivityFlags ?? evidencePack?.sensitivity_flags)
      .map((v) => asString(v))
      .filter(Boolean)
      .filter((v) => !isInternalKbCitationId(v)) as string[];
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

    return (
      <div key={`${step}_${idx}`} className="rounded-2xl border border-border/60 bg-background/60 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-medium text-muted-foreground">{step}</div>
            <div className="text-sm font-semibold text-foreground">
              {brand ? `${brand} ` : ''}
              {name || (language === 'CN' ? '未知产品' : 'Unknown product')}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">#{idx + 1}</div>
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

        {anchorId ? (
          <div className="mt-2">
            <button
              type="button"
              className="chip-button"
              disabled={isResolving}
              onClick={() =>
                void openPdpFromCard({
                  anchor_key: anchorId,
                  position: idx + 1,
                  brand,
                  name,
                  subject_product_group_id: subjectProductGroupId,
                  canonical_product_ref: canonicalRefTarget,
                  resolve_query: resolveQuery || null,
                  hints: Object.keys(resolverHints).length ? resolverHints : undefined,
                  pdp_open: pdpOpenHint,
                })
              }
            >
              {language === 'CN' ? '查看详情' : 'View details'}
              {isResolving ? <span className="ml-2 text-xs text-muted-foreground">{language === 'CN' ? '加载中…' : 'Loading…'}</span> : null}
            </button>
          </div>
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
                const altPdpOpenHint = altPdpOpen
                  ? {
                      path: asString((altPdpOpen as any)?.path) || null,
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

  const warningCandidates = debug
    ? uniqueStrings([...rawWarnings, ...rawMissing.filter((c) => warningLike.has(String(c)))])
    : uniqueStrings(rawWarnings);
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

  const toRoutineSteps = (list: RecoItem[]) =>
    list
      .map((item, idx) => {
        const sku = asObject(item.sku) || asObject(item.product) || null;
        const brand = asString(sku?.brand) || asString((sku as any)?.Brand) || '';
        const name = asString(sku?.name) || asString(sku?.display_name) || asString((sku as any)?.displayName) || '';
        const step = asString(item.step) || asString(item.category) || '';
        const typeRaw =
          (asString((item as any).type) || asString((item as any).tier) || asString((item as any).kind) || '').toLowerCase();
        const type = typeRaw.includes('dupe') ? 'dupe' : 'premium';

        if (!brand && !name) return null;
        return {
          category: normalizeCategory(step || ''),
          product: { brand: brand || (language === 'CN' ? '未知品牌' : 'Unknown'), name: name || (language === 'CN' ? '未知产品' : 'Unknown') },
          type,
          _idx: idx,
        };
      })
      .filter(Boolean)
      .slice(0, 12) as Array<{ category: string; product: { brand: string; name: string }; type: 'premium' | 'dupe'; _idx: number }>;

  const amSteps = toRoutineSteps(groups.am);
  const pmSteps = toRoutineSteps(groups.pm);

  return (
    <div className="space-y-3">
      {(amSteps.length || pmSteps.length) ? (
        <AuroraRoutineCard
          amSteps={amSteps}
          pmSteps={pmSteps}
          compatibility="unknown"
          language={language}
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
              {hasAnyAlternatives
                ? language === 'CN'
                  ? '查看详细步骤（含相似/平替/升级选择）'
                  : 'View detailed steps (incl. alternatives)'
                : language === 'CN'
                  ? '查看详细步骤与证据'
                  : 'View detailed steps & evidence'}
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
  requestHeaders,
  session,
  onAction,
  resolveOffers,
  resolveProductRef,
  resolveProductsSearch,
  onDeepScanProduct,
  bootstrapInfo,
  onOpenCheckin,
  onOpenPdp,
  analyticsCtx,
}: {
  card: Card;
  language: UiLanguage;
  debug: boolean;
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
  resolveProductsSearch?: (args: { query: string; limit?: number; preferBrand?: string | null }) => Promise<any>;
  onDeepScanProduct?: (inputText: string) => void;
  bootstrapInfo?: BootstrapInfo | null;
  onOpenCheckin?: () => void;
  onOpenPdp?: (args: { url: string; title?: string }) => void;
  analyticsCtx?: AnalyticsContext;
}) {
  const cardType = String(card.type || '').toLowerCase();

  const payloadObj = asObject(card.payload);
  const payload = payloadObj ?? (card.payload as any);
  const [feedbackBusyByKey, setFeedbackBusyByKey] = useState<Record<string, boolean>>({});
  const [feedbackSavedByKey, setFeedbackSavedByKey] = useState<Record<string, RecoEmployeeFeedbackType>>({});
  const [feedbackErrorByKey, setFeedbackErrorByKey] = useState<Record<string, string>>({});

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

  if (
    !debug &&
    (cardType === 'gate_notice' ||
      cardType === 'session_bootstrap' ||
      cardType === 'budget_gate')
  )
    return null;

  if (!debug && cardType === 'aurora_structured' && structuredCitations.length === 0) return null;

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

  if (isEnvStressCard(card)) {
    return <EnvStressCard payload={payload} language={language} onOpenCheckin={onOpenCheckin} />;
  }

  if (isConflictHeatmapCard(card)) {
    return <ConflictHeatmapCard payload={payload} language={language} debug={debug} />;
  }

  if (cardType === 'photo_modules_v1') {
    if (!FF_PHOTO_MODULES_CARD) return null;

    const { model, errors, sanitizer_drops } = normalizePhotoModulesUiModelV1(payload);
    if (!model) {
      if (analyticsCtx) {
        emitAuroraPhotoModulesSchemaFail(analyticsCtx, {
          card_id: card.card_id ?? null,
          error_count: errors.length,
          errors: errors.slice(0, 8),
          sanitizer_drop_count: sanitizer_drops.length,
        });
      }
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
      />
    );
  }

  if (cardType === 'diagnosis_gate') {
    return <DiagnosisCard onAction={(id, data) => onAction(id, data)} language={language} />;
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
    const missing = Array.isArray(card.field_missing) ? card.field_missing : [];
    const lowConfidence =
      analysisSource === 'baseline_low_confidence' ||
      missing.some((m) => String((m as any)?.field || '').toLowerCase().includes('currentroutine'));
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
      pos >= neg + 2 ? 'positive' : neg >= pos + 2 || risk >= 2 ? 'caution' : 'mixed';

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

        return (
          <div className="space-y-3">
            {product ? (
              <AuroraAnchorCard product={product} offers={productOffers} language={language} hidePriceWhenUnknown />
            ) : (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-foreground">
                {language === 'CN' ? '未能解析出产品实体（上游缺失）。' : 'Failed to parse a product entity (upstream missing).'}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {typeof confidence === 'number' && Number.isFinite(confidence) ? (
                <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {language === 'CN' ? `置信度 ${(confidence * 100).toFixed(0)}%` : `Confidence ${(confidence * 100).toFixed(0)}%`}
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
        const rawReasons = uniqueStrings(assessment?.reasons).slice(0, 10);
        const heroRaw = asObject((assessment as any)?.hero_ingredient || (assessment as any)?.heroIngredient) || null;
        const heroName = asString(heroRaw?.name);
        const heroRole = asString(heroRaw?.role);
        const heroWhy = asString(heroRaw?.why);
        const anchorRaw = asObject((assessment as any)?.anchor_product || (assessment as any)?.anchorProduct);
        const product = anchorRaw ? toUiProduct(anchorRaw, language) : null;
        const anchorOffers = anchorRaw ? toAnchorOffers(anchorRaw, language) : [];
        const howToUse = (assessment as any)?.how_to_use ?? (assessment as any)?.howToUse ?? null;
        const competitorsObj = asObject((payload as any).competitors) || null;
        const competitorCandidates = asArray((competitorsObj as any)?.candidates)
          .map((v) => asObject(v))
          .filter(Boolean) as Array<Record<string, unknown>>;
        const originalForCompare = anchorRaw || asObject((payload as any).product) || null;
        const provenance = asObject((payload as any).provenance) || null;
        const dogfoodFeatures = asObject((provenance as any)?.dogfood_features_effective || (provenance as any)?.dogfoodFeaturesEffective) || null;
        const showEmployeeFeedbackControls = dogfoodFeatures?.show_employee_feedback_controls === true;
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

        const formulaIntent: string[] = [];
        const usageHintsFromReasons: string[] = [];
        const cautionFromReasons: string[] = [];
        const dataNotesFromReasons: string[] = [];
        const detectedIngredientsFromReasons: string[] = [];
        const normalizeIngredientName = (token: string) => String(token || '').replace(/[.;:，。；：]+$/g, '').replace(/\s+/g, ' ').trim();

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
            formulaIntent.push(line.replace(/^profile priorities:\s*/i, '').trim());
            return;
          }

          formulaIntent.push(line);
        });

        const verdictStyle = (() => {
          const v = String(verdict || '').toLowerCase();
          if (v.includes('mismatch') || v.includes('not') || v.includes('avoid') || v.includes('veto')) return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
          if (v.includes('risky') || v.includes('caution') || v.includes('warn')) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
          if (v.includes('suitable') || v.includes('good') || v.includes('yes')) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
          return 'bg-muted/60 text-muted-foreground border-border/60';
        })();
        const allDetectedIngredients = uniqueStrings([
          ...detectedIngredientsFromReasons,
          ...evidenceKeyIngredients,
          ...(heroName ? [heroName] : []),
        ].map((name) => normalizeIngredientName(name))).slice(0, 12);

        const bestForSignals = uniqueStrings([
          ...formulaIntent,
          ...evidenceFitNotes,
          ...socialPositive,
        ]).slice(0, 3);

        const cautionSignals = uniqueStrings([
          ...cautionFromReasons,
          ...evidenceRiskNotes,
          ...socialNegative,
          ...socialRisks,
        ]).slice(0, 4);

        const keyTakeawayLines = uniqueStrings([
          verdict ? (language === 'CN' ? `结论：${verdict}` : `Verdict: ${verdict}`) : '',
          bestForSignals[0] || '',
          cautionSignals[0] ? (language === 'CN' ? `主要注意：${cautionSignals[0]}` : `Main watchout: ${cautionSignals[0]}`) : '',
        ]).slice(0, 2);

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

          return uniqueStrings(out).slice(0, 5);
        })();

        const dataNotes = uniqueStrings([
          ...dataNotesFromReasons,
          ...expertNotes.filter((note) => /(evidence source|ingredient list|inci|entries|product page|parsed)/i.test(String(note || ''))),
        ]).slice(0, 3);

        return (
          <div className="space-y-3">
            {product ? <AuroraAnchorCard product={product} offers={anchorOffers} language={language} hidePriceWhenUnknown /> : null}

            {verdict ? (
              <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${verdictStyle}`}>
                {language === 'CN' ? '结论：' : 'Verdict: '} {verdict}
              </div>
            ) : null}

            {keyTakeawayLines.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '重点结论' : 'Key takeaway'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {keyTakeawayLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
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

            {allDetectedIngredients.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  {language === 'CN' ? '关键活性与支持成分' : 'Notable actives & support ingredients'}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allDetectedIngredients.map((ingredient) => (
                    <button
                      key={ingredient}
                      type="button"
                      className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-foreground transition hover:bg-muted/80"
                      title={language === 'CN' ? '点击查看成分分析' : 'Click to view ingredient analysis'}
                      onClick={() => onAction('ingredient_drilldown', { ingredient_name: ingredient })}
                    >
                      {ingredient}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {(bestForSignals.length || cautionSignals.length) ? (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 sm:grid-cols-2">
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
                    <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '使用注意' : 'Use with caution'}</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                      {cautionSignals.slice(0, 3).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {howToUseBullets.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '安全使用建议' : 'How to use safely'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {howToUseBullets.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}

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

            {competitorCandidates.length ? (
              <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '同类可替代产品' : 'Comparable alternatives'}</div>
                <div className="mt-2 space-y-2">
                  {competitorCandidates.slice(0, 4).map((candidate, idx) => {
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
                    const cHighlights = uniqueStrings((candidate as any).compare_highlights || (candidate as any).compareHighlights).slice(0, 2);
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
                    const feedbackKey = `competitors::${candidateId}`.toLowerCase();
                    const feedbackBusy = feedbackBusyByKey[feedbackKey] === true;
                    const feedbackSaved = feedbackSavedByKey[feedbackKey] || null;
                    const feedbackError = asString(feedbackErrorByKey[feedbackKey]);

                    return (
                      <div key={`${cBrand}_${cName}_${idx}`} className="rounded-xl border border-border/50 bg-muted/30 p-3">
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

                        {(cWhy.length || cHighlights.length) ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {cWhy.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                            {cHighlights
                              .filter((x) => !isLikelyUrl(x))
                              .map((x) => (
                                <li key={x}>{x}</li>
                              ))}
                          </ul>
                        ) : null}

                        {(showEmployeeFeedbackControls && anchorProductIdForFeedback) ? (
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
                                    block: 'competitors',
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
                                    block: 'competitors',
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
                                    block: 'competitors',
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
                            {originalForCompare ? (
                              <button
                                type="button"
                                className="chip-button"
                                onClick={() => onAction('dupe_compare', { original: originalForCompare, dupe: candidate })}
                              >
                                {language === 'CN' ? '对比差异' : 'Compare tradeoffs'}
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
                </div>
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

        const tradeoffNote = tradeoffNoteParts.length ? tradeoffNoteParts.slice(0, 2).join(' · ') : tradeoffs[0] || undefined;

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
              tradeoffNote={tradeoffNote}
              missingActives={missingActives}
              addedBenefits={addedBenefits}
              labels={labels as any}
            />

            {tradeoffs.length ? (
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
  const initialLanguageRef = useRef<UiLanguage | null>(null);
  if (!initialLanguageRef.current) initialLanguageRef.current = getInitialLanguage();
  const initialLanguage = initialLanguageRef.current;

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

  type DeepLinkOpen = 'photo' | 'routine' | 'auth' | 'profile' | 'checkin';
  const searchParams = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const openRaw = String(sp.get('open') || '').trim().toLowerCase();
      return {
        brief_id: String(sp.get('brief_id') || '').trim(),
        trace_id: String(sp.get('trace_id') || '').trim(),
        q: String(sp.get('q') || '').trim(),
        chip_id: String(sp.get('chip_id') || '').trim(),
        open: (
          openRaw === 'photo' || openRaw === 'routine' || openRaw === 'auth' || openRaw === 'profile' || openRaw === 'checkin'
            ? openRaw
            : null
        ) as DeepLinkOpen | null,
      };
    } catch {
      return { brief_id: '', trace_id: '', q: '', chip_id: '', open: null as DeepLinkOpen | null };
    }
  }, [location.search]);

  const [language, setLanguage] = useState<UiLanguage>(initialLanguage);
  const [headers, setHeaders] = useState(() => {
    const base = makeDefaultHeaders(initialLanguage);
    const briefId = searchParams.brief_id;
    const traceId = searchParams.trace_id;
    return {
      ...base,
      ...(briefId ? { brief_id: briefId.slice(0, 128) } : {}),
      ...(traceId ? { trace_id: traceId.slice(0, 128) } : {}),
    };
  });
  const [sessionState, setSessionState] = useState<string>('idle');
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIntent, setLoadingIntent] = useState<AuroraLoadingIntent>('default');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const sessionStartedEmittedRef = useRef(false);
  const returnVisitEmittedRef = useRef(false);
  const openIntentConsumedRef = useRef<string | null>(null);
  const actionIntentConsumedRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [bootstrapInfo, setBootstrapInfo] = useState<BootstrapInfo | null>(null);
  const [profileSnapshot, setProfileSnapshot] = useState<Record<string, unknown> | null>(null);
  const pendingActionAfterDiagnosisRef = useRef<V1Action | null>(null);

  const shop = useShop();
  const cartCount = Math.max(0, Number(shop.cart?.item_count) || 0);

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [checkinSheetOpen, setCheckinSheetOpen] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [dupeSheetOpen, setDupeSheetOpen] = useState(false);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [authSession, setAuthSession] = useState(() => loadAuroraAuthSession());
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

  const [productDraft, setProductDraft] = useState('');
  const [dupeDraft, setDupeDraft] = useState({ original: '' });

  const [profileDraft, setProfileDraft] = useState({
    skinType: '',
    sensitivity: '',
    barrierStatus: '',
    goals: [] as string[],
    region: '',
    budgetTier: '',
    itinerary: '',
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
    setLangPref(toLangPref(language));
  }, [language]);

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
          // eslint-disable-next-line no-console
          console.warn('[PDP Guard] blocked non-PDP route', { url: rawUrl });
        }
        return;
      }
      shop.openShop({ url: parsed.toString(), title: args.title });
    },
    [debug, shop],
  );

  const applyEnvelope = useCallback((env: V1Envelope) => {
    setError(null);

    if (env.session_patch && typeof env.session_patch === 'object') {
      const patch = env.session_patch as Record<string, unknown>;
      const next = (env.session_patch as Record<string, unknown>)['next_state'];
      if (typeof next === 'string' && next.trim()) setSessionState(next.trim());

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

    const nextItems: ChatItem[] = [];
    if (env.assistant_message?.content) {
      const raw = String(env.assistant_message.content || '');
      const cleaned = debug ? raw : stripInternalKbRefsFromText(raw);
      if (cleaned.trim()) nextItems.push({ id: nextId(), role: 'assistant', kind: 'text', content: cleaned });
    }

    const rawCards = Array.isArray(env.cards) ? env.cards : [];
    const cards = filterRecommendationCardsForState(rawCards, agentStateRef.current);

    if (cards.length) {
      nextItems.push({
        id: nextId(),
        role: 'assistant',
        kind: 'cards',
        cards,
        meta: { request_id: env.request_id, trace_id: env.trace_id, events: env.events },
      });
    }

    const suppressChips = cards.length
      ? cards.some((c) => {
          const t = String((c as any)?.type || '').toLowerCase();
          return t === 'analysis_summary' || t === 'profile' || t === 'diagnosis_gate';
        })
      : false;

    if (!suppressChips && Array.isArray(env.suggested_chips) && env.suggested_chips.length) {
      nextItems.push({ id: nextId(), role: 'assistant', kind: 'chips', chips: env.suggested_chips });
    }

    if (nextItems.length) setItems((prev) => [...prev, ...nextItems]);
  }, []);

  const tryApplyEnvelopeFromBffError = useCallback(
    (err: unknown) => {
      if (!(err instanceof PivotaAgentBffError)) return false;
      const body = err.responseBody;
      if (!body || typeof body !== 'object') return false;
      const env = body as any;
      if (typeof env.request_id !== 'string' || !Array.isArray(env.cards)) return false;
      applyEnvelope(env as V1Envelope);
      return true;
    },
    [applyEnvelope],
  );

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
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
          chip_id: 'chip.start.ingredients',
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
      setIsLoading(false);
    }
  }, [agentState, hasBootstrapped, headers, language, tryApplyEnvelopeFromBffError]);

  const startNewChat = useCallback(() => {
    setError(null);
    setSessionState('idle');
    setAgentStateSafe('IDLE_CHAT');
    setQuickProfileStep('skin_feel');
    setQuickProfileDraft({});
    setQuickProfileBusy(false);
    setItems([]);
    setAnalysisPhotoRefs([]);
    setSessionPhotos({});
    setBootstrapInfo(null);
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
    const itineraryRaw = (p as any)?.itinerary;
    const itineraryText =
      typeof itineraryRaw === 'string'
        ? itineraryRaw
        : itineraryRaw && typeof itineraryRaw === 'object'
          ? JSON.stringify(itineraryRaw)
          : '';
    setProfileDraft({
      skinType: asString(p?.skinType) ?? '',
      sensitivity: asString(p?.sensitivity) ?? '',
      barrierStatus: asString(p?.barrierStatus) ?? '',
      goals: (asArray(p?.goals).map((g) => asString(g)).filter(Boolean) as string[]) ?? [],
      region: asString(p?.region) ?? '',
      budgetTier: asString(p?.budgetTier) ?? '',
      itinerary: itineraryText ?? '',
    });
  }, [profileSheetOpen, bootstrapInfo, profileSnapshot]);

  const saveProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const patch: Record<string, unknown> = {};
      if (profileDraft.skinType.trim()) patch.skinType = profileDraft.skinType.trim();
      if (profileDraft.sensitivity.trim()) patch.sensitivity = profileDraft.sensitivity.trim();
      if (profileDraft.barrierStatus.trim()) patch.barrierStatus = profileDraft.barrierStatus.trim();
      if (profileDraft.region.trim()) patch.region = profileDraft.region.trim();
      if (profileDraft.budgetTier.trim()) patch.budgetTier = profileDraft.budgetTier.trim();
      if (profileDraft.itinerary.trim()) patch.itinerary = profileDraft.itinerary.trim().slice(0, 2000);
      if (profileDraft.goals.length) patch.goals = profileDraft.goals;

      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
        method: 'POST',
        body: JSON.stringify(patch),
      });

      setItems((prev) => [
        ...prev,
        { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '更新肤况资料' : 'Update profile' },
      ]);
      applyEnvelope(env);
      setProfileSheetOpen(false);
    } catch (err) {
      if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyEnvelope, headers, language, profileDraft, tryApplyEnvelopeFromBffError]);

  const saveCheckin = useCallback(async () => {
    setIsLoading(true);
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

      setItems((prev) => [
        ...prev,
        { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '今日打卡' : 'Daily check-in' },
      ]);
      applyEnvelope(env);
      setCheckinSheetOpen(false);
    } catch (err) {
      if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyEnvelope, checkinDraft, headers, language, tryApplyEnvelopeFromBffError]);

  const refreshBootstrapInfo = useCallback(async () => {
    try {
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/session/bootstrap', requestHeaders, { method: 'GET' });
      const info = readBootstrapInfo(env);
      if (info) setBootstrapInfo(info);
      if (info?.profile) setProfileSnapshot(info.profile);
    } catch {
      // ignore
    }
  }, [headers, language]);

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
      await bffJson<V1Envelope>('/v1/auth/password/set', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      setAuthDraft((prev) => ({ ...prev, newPassword: '', newPasswordConfirm: '' }));
      setAuthNotice(language === 'CN' ? '密码已设置。' : 'Password set.');
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
    [applyEnvelope, headers, language],
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
        // eslint-disable-next-line no-await-in-loop
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
        setIsLoading(true);
        setError(null);
        try {
          setSessionState('S4_ANALYSIS_LOADING');
          const requestHeaders = { ...headers, lang: language };
          const body: Record<string, unknown> = {
            use_photo: true,
            photos: photosForAnalysis,
            ...(hasCurrentRoutine ? { currentRoutine: profileCurrentRoutine } : {}),
          };
          const env = await bffJson<V1Envelope>('/v1/analysis/skin', requestHeaders, {
            method: 'POST',
            body: JSON.stringify(body),
          });
          applyEnvelope(env);
        } catch (err) {
          if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsLoading(false);
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

  const sendChat = useCallback(
    async (
      message?: string,
      action?: V1Action,
      opts?: {
        client_state?: AgentState;
        requested_transition?: RequestedTransition | null;
      },
    ) => {
      setLoadingIntent(inferAuroraLoadingIntent(message, action));
      setIsLoading(true);
      try {
        const requestHeaders = { ...headers, lang: language };
        const session = buildChatSession({
          state: sessionState,
          profileSnapshot,
          bootstrapProfile: bootstrapInfo?.profile ?? null,
        });
        const body: Record<string, unknown> = {
          session,
          ...(message ? { message } : {}),
          ...(action ? { action } : {}),
          language,
          client_state: normalizeAgentState(opts?.client_state ?? agentState),
          ...(opts?.requested_transition ? { requested_transition: opts.requested_transition } : {}),
          ...(debug ? { debug: true } : {}),
          ...(anchorProductId ? { anchor_product_id: anchorProductId } : {}),
          ...(anchorProductUrl ? { anchor_product_url: anchorProductUrl } : {}),
        };

        const env = await bffJson<V1Envelope>('/v1/chat', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        applyEnvelope(env);
      } catch (err) {
        if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
        setLoadingIntent('default');
      }
    },
    [
      agentState,
      anchorProductId,
      anchorProductUrl,
      applyEnvelope,
      bootstrapInfo?.profile,
      debug,
      headers,
      language,
      profileSnapshot,
      sessionState,
    ]
  );

  const parseMaybeUrl = useCallback((text: string) => {
    const t = String(text || '').trim();
    if (!t) return null;
    try {
      const u = new URL(t);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    } catch {
      // ignore
    }
    return null;
  }, []);

  const runProductDeepScan = useCallback(
    async (rawInput: string) => {
      const inputText = String(rawInput || '').trim();
      if (!inputText) return;

      setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: inputText }]);
      setIsLoading(true);
      setError(null);

      try {
        setSessionState('P1_PRODUCT_ANALYZING');

        const requestHeaders = { ...headers, lang: language };
        const asUrl = parseMaybeUrl(inputText);

        const parseEnv = await bffJson<V1Envelope>('/v1/product/parse', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(asUrl ? { url: asUrl } : { text: inputText }),
        });
        applyEnvelope(parseEnv);

        const parseCard = Array.isArray(parseEnv.cards) ? parseEnv.cards.find((c) => c && c.type === 'product_parse') : null;
        const parsedProduct = parseCard && parseCard.payload && typeof parseCard.payload === 'object' ? (parseCard.payload as any).product : null;
        const analyzeBody = parsedProduct
          ? asUrl
            ? { product: parsedProduct, url: asUrl }
            : { product: parsedProduct }
          : asUrl
            ? { url: asUrl }
            : { name: inputText };

        const analyzeEnv = await bffJson<V1Envelope>('/v1/product/analyze', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(analyzeBody),
        });
        applyEnvelope(analyzeEnv);
        setSessionState('P2_PRODUCT_RESULT');
      } catch (err) {
        if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [applyEnvelope, headers, language, parseMaybeUrl],
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
      setIsLoading(true);
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
        setIsLoading(false);
        setLoadingIntent('default');
      }
    },
    [applyEnvelope, headers, language, parseMaybeUrl],
  );

  const onCardAction = useCallback(
    async (actionId: string, data?: Record<string, any>) => {
      if (actionId === 'diagnosis_skip') {
        pendingActionAfterDiagnosisRef.current = null;
        setItems((prev) => [
          ...prev,
          { id: nextId(), role: 'user', kind: 'text', content: language === 'CN' ? '跳过诊断' : 'Skip diagnosis' },
        ]);
        setSessionState('idle');
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

      if (actionId === 'dupe_compare') {
        const original = data?.original && typeof data.original === 'object' ? data.original : null;
        const dupe = data?.dupe && typeof data.dupe === 'object' ? data.dupe : null;
        if (!original || !dupe) return;

        const dupeName =
          typeof (dupe as any)?.display_name === 'string'
            ? String((dupe as any).display_name).trim()
            : typeof (dupe as any)?.name === 'string'
              ? String((dupe as any).name).trim()
              : '';
        setItems((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'user',
            kind: 'text',
            content: language === 'CN' ? `对比：${dupeName || '平替'}` : `Compare: ${dupeName || 'dupe'}`,
          },
        ]);

        setIsLoading(true);
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
          setIsLoading(false);
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

        setIsLoading(true);
        try {
          const env = await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
            method: 'POST',
            body: JSON.stringify({ goals: concerns }),
          });
          applyEnvelope(env);
        } catch (err) {
          if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsLoading(false);
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
              ? '收到 ✅ 我会按“屏障优先”来给建议，先避免叠加强活性。'
              : 'Got it ✅ I’ll keep this barrier-first and avoid stacking strong actives for now.'
            : language === 'CN'
              ? '好的 ✅ 我会更放心一些推进，但仍会从低频、单一活性开始。'
              : 'Great ✅ We can be a bit more proactive, but still start low-frequency with one active at a time.';
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
        if (!validation.ok) {
          setError(language === 'CN' ? '这个操作当前不可用（状态机硬规则拒绝）。' : 'This action is not allowed right now (state machine hard rule).');
          return;
        }
        if (validation.next_state !== fromState) {
          emitAgentStateEntered(
            { ...ctx, state: validation.next_state },
            { state_name: validation.next_state, from_state: fromState, trigger_source: 'action', trigger_id: actionId },
          );
          setAgentStateSafe(validation.next_state);
        }
        if (validation.next_state === 'RECO_GATE') {
          emitUiRecosRequested({ ...ctx, state: validation.next_state }, { entry_point: 'action', prior_value_moment: 'analysis_summary' });
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
          requested_transition: { trigger_source: 'action', trigger_id: actionId, requested_next_state: validation.next_state },
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
          if (!validation.ok) {
            setError(language === 'CN' ? '这个操作当前不可用（状态机硬规则拒绝）。' : 'This action is not allowed right now (state machine hard rule).');
            return;
          }
          if (validation.next_state !== fromState) {
            emitAgentStateEntered(
              { ...ctx, state: validation.next_state },
              { state_name: validation.next_state, from_state: fromState, trigger_source: 'action', trigger_id: actionId },
            );
            setAgentStateSafe(validation.next_state);
          }
          if (validation.next_state === 'RECO_GATE') {
            emitUiRecosRequested({ ...ctx, state: validation.next_state }, { entry_point: 'action', prior_value_moment: 'analysis_summary' });
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
            requested_transition: { trigger_source: 'action', trigger_id: actionId, requested_next_state: validation.next_state },
          });
          return;
        }

        await sendChat(msg);
        return;
      }

      await sendChat(undefined, { action_id: actionId, kind: 'action', data });
    },
    [agentState, applyEnvelope, headers, language, sendChat, setAgentStateSafe, tryApplyEnvelopeFromBffError],
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
    if (!validation.ok) {
      setError(language === 'CN' ? '这个操作当前不可用（状态机硬规则拒绝）。' : 'This action is not allowed right now (state machine hard rule).');
      return;
    }

    if (validation.next_state !== fromState) {
      emitAgentStateEntered(
        { ...ctx, state: validation.next_state },
        { state_name: validation.next_state, from_state: fromState, trigger_source: 'action', trigger_id: actionId },
      );
      setAgentStateSafe(validation.next_state);
    }

    emitUiRecosRequested({ ...ctx, state: validation.next_state }, { entry_point: 'action', prior_value_moment: 'product_picks' });

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
        requested_transition: { trigger_source: 'action', trigger_id: actionId, requested_next_state: validation.next_state },
      },
    );
  }, [agentState, headers, isLoading, language, sendChat, setAgentStateSafe]);

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

  const runLowConfidenceSkinAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSessionState('S4_ANALYSIS_LOADING');
      const requestHeaders = { ...headers, lang: language };
      const env = await bffJson<V1Envelope>('/v1/analysis/skin', requestHeaders, {
        method: 'POST',
        body: JSON.stringify({ use_photo: false }),
      });
      applyEnvelope(env);
    } catch (err) {
      if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyEnvelope, headers, language, tryApplyEnvelopeFromBffError]);

  const runRoutineSkinAnalysis = useCallback(
    async (routineInput: string | Record<string, unknown>, photoRefsOverride?: AnalysisPhotoRef[]) => {
      const routine =
        typeof routineInput === 'string'
          ? String(routineInput || '').trim()
          : routineInput && typeof routineInput === 'object'
            ? routineInput
            : null;
      if (!routine || (typeof routine === 'string' && !routine.trim())) return;
      setIsLoading(true);
      setError(null);
      const requestHeaders = { ...headers, lang: language };

      try {
        setSessionState('S4_ANALYSIS_LOADING');
        const photos = mergeAnalysisPhotoRefs(getSanitizedAnalysisPhotos(), Array.isArray(photoRefsOverride) ? photoRefsOverride : []);
        const usePhoto = photos.length > 0;
        const body: Record<string, unknown> = {
          use_photo: usePhoto,
          currentRoutine: routine,
          ...(usePhoto ? { photos } : {}),
        };
        const envAnalysis = await bffJson<V1Envelope>('/v1/analysis/skin', requestHeaders, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        applyEnvelope(envAnalysis);
      } catch (err) {
        if (!tryApplyEnvelopeFromBffError(err)) setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [applyEnvelope, getSanitizedAnalysisPhotos, headers, language, tryApplyEnvelopeFromBffError],
  );

  const submitText = useCallback(
    async (raw: string) => {
      const msg = String(raw || '').trim();
      if (!msg) return;
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
    [agentState, headers, language, sendChat, setAgentStateSafe],
  );

  const onSubmit = useCallback(async () => {
    await submitText(input);
  }, [input, submitText]);

  const onChip = useCallback(
    async (chip: SuggestedChip) => {
      const id = String(chip.chip_id || '').trim();
      const qpRaw = (chip.data as any)?.quick_profile;
      const qpQuestionId = qpRaw && typeof qpRaw === 'object' ? String(qpRaw.question_id || '').trim() : '';
      const qpAnswer = qpRaw && typeof qpRaw === 'object' ? String(qpRaw.answer || '').trim() : '';

      const fromState = agentState;
      const langPref = toLangPref(language);
      const requestedToState: AgentState = (() => {
        if (qpQuestionId === 'skip') return 'IDLE_CHAT';
        if (qpQuestionId === 'opt_in_more' && qpAnswer === 'no') return 'IDLE_CHAT';
        if (qpQuestionId === 'rx_flag') return 'IDLE_CHAT';
        return nextAgentStateForChip(id) ?? fromState;
      })();
      const toState = requestedToState;

      const ctx: AnalyticsContext = {
        brief_id: headers.brief_id,
        trace_id: headers.trace_id,
        aurora_uid: headers.aurora_uid,
        lang: langPref,
        state: fromState,
      };

      emitUiChipClicked(ctx, { chip_id: id, from_state: fromState, to_state: toState });

      const stripReturnWelcome = (prev: ChatItem[]) => prev.filter((it) => it.kind !== 'return_welcome');

      if (qpQuestionId && qpAnswer) {
        emitAgentProfileQuestionAnswered(ctx, { question_id: qpQuestionId, answer_type: qpAnswer });

        const finishQuickProfile = (args: { didSkip: boolean; draft: QuickProfileProfilePatch }) => {
          setAgentStateSafe('IDLE_CHAT');
          setQuickProfileStep('skin_feel');
          setQuickProfileDraft(args.draft);
          const content = args.didSkip
            ? (language === 'CN'
                ? '好的，先不做快速画像。你想先做什么？'
                : "No problem — we can do the quick profile later. What would you like to do?")
            : buildQuickProfileAdvice(language, args.draft);
          setItems((prev) => [
            ...stripReturnWelcome(prev),
            { id: nextId(), role: 'assistant', kind: 'text', content },
            { id: nextId(), role: 'assistant', kind: 'chips', chips: buildQuickProfileExitChips(language) },
          ]);
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
          await patchGlowSessionProfile(
            { brief_id: headers.brief_id, trace_id: headers.trace_id },
            profilePatch,
          );

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

            // Best-effort persist to BFF storage (do not block quick-profile progression).
            try {
              const requestHeaders = { ...headers, lang: language };
              await bffJson<V1Envelope>('/v1/profile/update', requestHeaders, {
                method: 'POST',
                body: JSON.stringify(auroraProfilePatch),
              });
            } catch {
              // ignore (local snapshot already updated)
            }
          }

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
            trigger_id: id,
            requested_next_state: toState,
        });
        if (!validation.ok) {
          setError(language === 'CN' ? '这个操作当前不可用（状态机硬规则拒绝）。' : 'This action is not allowed right now (state machine hard rule).');
          return;
        }
        requestedTransition = { trigger_source: 'chip', trigger_id: id, requested_next_state: validation.next_state };
        emitAgentStateEntered(
          { ...ctx, state: validation.next_state },
          { state_name: validation.next_state, from_state: fromState, trigger_source: 'chip', trigger_id: id },
        );
        if (validation.next_state === 'RECO_GATE') {
          emitUiRecosRequested({ ...ctx, state: validation.next_state }, { entry_point: 'chip', prior_value_moment: null });
        }
        setAgentStateSafe(validation.next_state);
      }

      const userItem: ChatItem = { id: nextId(), role: 'user', kind: 'text', content: chip.label };

      if (id === 'chip_keep_chatting') {
        setItems((prev) => [...stripReturnWelcome(prev), userItem]);
        return;
      }

      if (id === 'chip_quick_profile') {
        setQuickProfileStep('skin_feel');
        setQuickProfileDraft({});
        setItems((prev) => [...stripReturnWelcome(prev), userItem]);
        return;
      }

      if (id === 'chip_start_diagnosis' || id === 'chip.start.diagnosis') {
        setSessionState('S2_DIAGNOSIS');
        setItems((prev) => [
          ...stripReturnWelcome(prev),
          userItem,
          {
            id: nextId(),
            role: 'assistant',
            kind: 'cards',
            cards: [{ card_id: `local_diagnosis_${Date.now()}`, type: 'diagnosis_gate', payload: {} }],
          },
        ]);
        return;
      }

      setItems((prev) => [...stripReturnWelcome(prev), userItem]);

      // If the user explicitly requests product recommendations but lacks a minimal profile,
      // the backend will gate. Remember this intent so we can resume recommendations
      // immediately after the user completes the diagnosis card.
      if (id === 'chip.start.reco_products' || id === 'chip_get_recos') {
        const { score } = profileRecoCompleteness(profileSnapshot ?? bootstrapInfo?.profile ?? null);
        if (score < 3) {
          pendingActionAfterDiagnosisRef.current = {
            action_id: chip.chip_id,
            kind: 'chip',
            data: chip.data,
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

      if (id === 'chip_checkin_now') {
        setCheckinSheetOpen(true);
        return;
      }

      if (id === 'chip_eval_single_product') {
        setProductDraft('');
        setProductSheetOpen(true);
        return;
      }

      if (id === 'chip.intake.upload_photos') {
        setPromptRoutineAfterPhoto(true);
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

      await sendChat(
        undefined,
        { action_id: chip.chip_id, kind: 'chip', data: chip.data },
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
    ]
  );

  const deepLinkChip = useCallback(
    (chipId: string): SuggestedChip => {
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
        'chip.start.ingredients': { EN: 'Ingredient science (evidence)', CN: '成分机理/证据链' },
      };

      const label = (labelMap[id]?.[isCN ? 'CN' : 'EN'] ?? id).slice(0, 80);
      const replyTextMap: Record<string, { EN: string; CN: string }> = {
        'chip.start.ingredients': {
          EN: 'I want ingredient science (evidence/mechanism), not product recommendations yet.',
          CN: '我想聊成分科学（证据/机制），先不做产品推荐。',
        },
      };
      const reply_text = (replyTextMap[id]?.[isCN ? 'CN' : 'EN'] ?? label).slice(0, 160);
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
    setItems([]);
    setAnalysisPhotoRefs([]);
    setSessionPhotos({});
    setBootstrapInfo(null);
    pendingActionAfterDiagnosisRef.current = null;
    sessionStartedEmittedRef.current = false;
    returnVisitEmittedRef.current = false;
    openIntentConsumedRef.current = null;
    actionIntentConsumedRef.current = null;

    setProfileSheetOpen(false);
    setCheckinSheetOpen(false);
    setPhotoSheetOpen(false);
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
      setPhotoSheetOpen(true);
    }
    if (searchParams.open === 'routine') {
      setRoutineDraft(makeEmptyRoutineDraft());
      setRoutineTab('am');
      setRoutineSheetOpen(true);
    }
    if (searchParams.open === 'profile') {
      setProfileSheetOpen(true);
    }
    if (searchParams.open === 'checkin') {
      setCheckinSheetOpen(true);
    }
    if (searchParams.open === 'auth') {
      setAuthError(null);
      setAuthNotice(null);
      setAuthStage('email');
      setAuthDraft((prev) => ({ ...prev, code: '', password: '', newPassword: '', newPasswordConfirm: '' }));
      setAuthSheetOpen(true);
    }

    try {
      const sp = new URLSearchParams(window.location.search);
      let changed = false;
      if (sp.has('open')) {
        sp.delete('open');
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
    const hasActionIntent = Boolean(searchParams.q || searchParams.chip_id);
    if (!hasActionIntent) {
      actionIntentConsumedRef.current = null;
      return;
    }

    const sig = [searchParams.brief_id, searchParams.trace_id, searchParams.q, searchParams.chip_id]
      .map((v) => String(v || ''))
      .join('|');
    if (actionIntentConsumedRef.current === sig) return;
    actionIntentConsumedRef.current = sig;

    const run = async () => {
      if (searchParams.chip_id) {
        await onChip(deepLinkChip(searchParams.chip_id));
        return;
      }
      if (searchParams.q) {
        await submitText(searchParams.q);
      }
    };
    void run();

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
  }, [deepLinkChip, hasBootstrapped, headers.brief_id, headers.trace_id, navigate, onChip, searchParams, submitText]);

  const switchLanguage = useCallback(
    (next: UiLanguage) => {
      if (next === language) return;
      const ctx: AnalyticsContext = {
        brief_id: headers.brief_id,
        trace_id: headers.trace_id,
        aurora_uid: headers.aurora_uid,
        lang: toLangPref(language),
        state: agentState,
      };
      emitUiLanguageSwitched(ctx, { from_lang: toLangPref(language), to_lang: toLangPref(next) });
      setLanguage(next);
    },
    [agentState, headers, language],
  );

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
    }: {
      query: string;
      limit?: number;
      preferBrand?: string | null;
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
      const timer = window.setTimeout(() => controller.abort(), VIEW_DETAILS_REQUEST_TIMEOUT_MS);
      try {
        return await bffJson<any>('/agent/shop/v1/invoke', requestHeaders, {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            operation: 'find_products_multi',
            payload: {
              search: {
                query: queryWithHint,
                in_stock_only: false,
                search_all_merchants: true,
                limit: requestedLimit,
                offset: 0,
              },
            },
            metadata: {
              source: 'aurora_chatbox',
              ...(brand ? { prefer_brand: brand } : {}),
            },
          }),
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
        <button type="button" className="ios-nav-button ml-1" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
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
                    {authSession.expires_at ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {language === 'CN' ? '有效期至：' : 'Expires:'} {authSession.expires_at}
                      </div>
                    ) : null}
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
                      {authNotice ? <div className="text-xs text-emerald-700">{authNotice}</div> : null}
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
                          <div className="flex gap-2">
                            <button type="button" className="chip-button" onClick={() => setAuthStage('email')} disabled={authLoading}>
                              {language === 'CN' ? '返回' : 'Back'}
                            </button>
                            <button
                              type="button"
                              className="chip-button chip-button-primary flex-1"
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
            title={language === 'CN' ? '上传照片（更准确）' : 'Upload photos (recommended)'}
            onClose={() => {
              if (isLoading || photoUploading) return;
              setPhotoSheetOpen(false);
              setPromptRoutineAfterPhoto(false);
            }}
            onOpenMenu={() => {
              if (isLoading || photoUploading) return;
              setPhotoSheetOpen(false);
              setPromptRoutineAfterPhoto(false);
              setSidebarOpen(true);
            }}
          >
            <PhotoUploadCard language={language} onAction={onPhotoAction} uploading={photoUploading} />
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
                  disabled={isLoading}
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
                  disabled={isLoading}
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
                          disabled={isLoading}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '活性/精华（可选）' : 'Treatment/active (optional)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.am.treatment}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, treatment: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：烟酰胺 / VC / 无' : 'e.g., niacinamide / vitamin C / none'}
                          disabled={isLoading}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '保湿（可选）' : 'Moisturizer (optional)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.am.moisturizer}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, moisturizer: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：CeraVe PM / 无' : 'e.g., CeraVe PM / none'}
                          disabled={isLoading}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '防晒 SPF（可选但推荐）' : 'SPF (optional but recommended)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.am.spf}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, am: { ...prev.am, spf: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：EltaMD UV Clear / 无' : 'e.g., EltaMD UV Clear / none'}
                          disabled={isLoading}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                    <div className="grid gap-2">
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '洁面' : 'Cleanser'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.pm.cleanser}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, cleanser: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：同 AM / 或不同产品' : 'e.g., same as AM / or different'}
                          disabled={isLoading}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '活性/精华（可选）' : 'Treatment/active (optional)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.pm.treatment}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, treatment: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：Retinol / AHA/BHA / 无' : 'e.g., retinol / AHA/BHA / none'}
                          disabled={isLoading}
                        />
                      </label>
                      <label className="space-y-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '保湿（可选）' : 'Moisturizer (optional)'}
                        <input
                          className="h-9 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                          value={routineDraft.pm.moisturizer}
                          onChange={(e) => setRoutineDraft((prev) => ({ ...prev, pm: { ...prev.pm, moisturizer: e.target.value } }))}
                          placeholder={language === 'CN' ? '例如：CeraVe PM / 无' : 'e.g., CeraVe PM / none'}
                          disabled={isLoading}
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
                      disabled={isLoading}
                    />
                  </div>
                </details>
              </div>

              <div className="sticky bottom-0 -mx-[var(--aurora-page-x)] border-t border-border/40 bg-card/95 px-[var(--aurora-page-x)] pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
                <div className="flex gap-2">
                  <button type="button" className="chip-button" onClick={() => setRoutineSheetOpen(false)} disabled={isLoading}>
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
                      void runLowConfidenceSkinAnalysis();
                    }}
                    disabled={isLoading}
                  >
                    {language === 'CN' ? '先给基线' : 'Baseline only'}
                  </button>
                  <button
                    type="button"
                    className="chip-button chip-button-primary flex-1"
                    disabled={isLoading || !hasAnyRoutineDraftInput(routineDraft)}
                    onClick={() => {
                      const payload = buildCurrentRoutinePayloadFromDraft(routineDraft);
                      const text = routineDraftToDisplayText(routineDraft, language);
                      setRoutineSheetOpen(false);
                      setRoutineDraft(makeEmptyRoutineDraft());
                      setItems((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', content: text }]);
                      void runRoutineSkinAnalysis(payload);
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
              <div className="flex gap-2">
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

              <div className="flex gap-2">
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
            title={language === 'CN' ? '编辑肤况资料' : 'Edit profile'}
            onClose={() => setProfileSheetOpen(false)}
            onOpenMenu={() => {
              setProfileSheetOpen(false);
              setSidebarOpen(true);
            }}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '肤质' : 'Skin type'}
                  <select
                    className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.skinType}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, skinType: e.target.value }))}
                  >
                    <option value="">{language === 'CN' ? '未选择' : '—'}</option>
                    <option value="oily">{language === 'CN' ? '油性' : 'oily'}</option>
                    <option value="dry">{language === 'CN' ? '干性' : 'dry'}</option>
                    <option value="combination">{language === 'CN' ? '混合' : 'combination'}</option>
                    <option value="normal">{language === 'CN' ? '中性' : 'normal'}</option>
                    <option value="sensitive">{language === 'CN' ? '敏感' : 'sensitive'}</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '敏感程度' : 'Sensitivity'}
                  <select
                    className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.sensitivity}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, sensitivity: e.target.value }))}
                  >
                    <option value="">{language === 'CN' ? '未选择' : '—'}</option>
                    <option value="low">{language === 'CN' ? '低' : 'low'}</option>
                    <option value="medium">{language === 'CN' ? '中' : 'medium'}</option>
                    <option value="high">{language === 'CN' ? '高' : 'high'}</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '屏障状态' : 'Barrier status'}
                  <select
                    className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
                    value={profileDraft.barrierStatus}
                    onChange={(e) => setProfileDraft((p) => ({ ...p, barrierStatus: e.target.value }))}
                  >
                    <option value="">{language === 'CN' ? '未选择' : '—'}</option>
                    <option value="healthy">{language === 'CN' ? '稳定' : 'healthy'}</option>
                    <option value="impaired">{language === 'CN' ? '不稳定/刺痛' : 'impaired'}</option>
                    <option value="unknown">{language === 'CN' ? '不确定' : 'unknown'}</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-muted-foreground">
                  {language === 'CN' ? '预算' : 'Budget'}
                  <select
                    className="h-10 w-full rounded-2xl border border-border/60 bg-background/60 px-3 text-sm text-foreground"
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

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '目标（可多选）' : 'Goals (multi-select)'}
                <div className="flex flex-wrap gap-2">
                  {[
                    ['acne', language === 'CN' ? '控痘' : 'Acne'],
                    ['redness', language === 'CN' ? '泛红/敏感' : 'Redness'],
                    ['dark_spots', language === 'CN' ? '淡斑/痘印' : 'Dark spots'],
                    ['dehydration', language === 'CN' ? '补水' : 'Hydration'],
                    ['pores', language === 'CN' ? '毛孔' : 'Pores'],
                    ['wrinkles', language === 'CN' ? '抗老' : 'Anti-aging'],
                  ].map(([key, label]) => {
                    const selected = profileDraft.goals.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`chip-button ${selected ? 'chip-button-primary' : ''}`}
                        onClick={() =>
                          setProfileDraft((p) => ({
                            ...p,
                            goals: selected ? p.goals.filter((g) => g !== key) : [...p.goals, key],
                          }))
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </label>

              <label className="space-y-1 text-xs text-muted-foreground">
                {language === 'CN' ? '行程/环境（可选）' : 'Upcoming plan (optional)'}
                <textarea
                  className="min-h-[88px] w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                  value={profileDraft.itinerary}
                  onChange={(e) => setProfileDraft((p) => ({ ...p, itinerary: e.target.value }))}
                  placeholder={
                    language === 'CN'
                      ? '例如：下周出差/旅行（偏干冷/偏潮热），白天户外多；或“最近熬夜/晒太阳多”…'
                      : 'e.g., travel next week (cold/dry or hot/humid), lots of outdoor time; or “late nights / more sun”…'
                  }
                />
              </label>

              <div className="flex gap-2">
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

              <div className="flex gap-2">
                <button type="button" className="chip-button" onClick={() => setCheckinSheetOpen(false)} disabled={isLoading}>
                  {language === 'CN' ? '取消' : 'Cancel'}
                </button>
                <button type="button" className="chip-button chip-button-primary" onClick={saveCheckin} disabled={isLoading}>
                  {language === 'CN' ? '保存' : 'Save'}
                </button>
              </div>
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
              return (
                <div key={item.id} className="chat-card">
                  <div className="flex flex-wrap gap-2">
                    {item.chips.map((chip) => {
                      const Icon = iconForChip(chip.chip_id);
                      return (
                        <button
                          key={chip.chip_id}
                          className="chip-button"
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
                        <BffCardView
                          key={card.card_id}
                          card={card}
                          language={language}
                          debug={debug}
                          requestHeaders={headers}
                          session={sessionForCards}
                          onAction={onCardAction}
                          resolveOffers={resolveOffers}
                          resolveProductRef={resolveProductRef}
                          resolveProductsSearch={resolveProductsSearch}
                          onDeepScanProduct={runProductDeepScan}
                          bootstrapInfo={bootstrapInfo}
                          onOpenCheckin={() => setCheckinSheetOpen(true)}
                          onOpenPdp={openPdpDrawer}
                          analyticsCtx={{
                            brief_id: headers.brief_id,
                            trace_id: headers.trace_id,
                            aurora_uid: headers.aurora_uid,
                            lang: toLangPref(language),
                            state: agentState,
                          }}
                        />,
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

	          {isLoading ? <AuroraLoadingCard language={language} intent={loadingIntent} /> : null}
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
            title={language === 'CN' ? '上传照片' : 'Upload photo'}
          >
            <Camera className="h-[var(--aurora-chat-control-icon-size)] w-[var(--aurora-chat-control-icon-size)]" />
          </button>
          <input
            className="flex-1 bg-transparent px-2 text-foreground outline-none placeholder:text-muted-foreground/70"
            style={{ height: 'var(--aurora-chat-control-size)', fontSize: 'var(--aurora-chat-input-font-size)' }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={language === 'EN' ? 'Ask a question… (or paste a product link)' : '输入问题…（或粘贴产品链接）'}
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
