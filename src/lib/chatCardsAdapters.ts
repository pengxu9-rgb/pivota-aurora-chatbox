import type {
  DiagnosisResult,
  Language,
  MechanismVector,
  ProductAnalysisResult,
  SkinConcern,
  SkinType,
} from '@/lib/types';

type AnyRecord = Record<string, unknown>;

type RoutineStepUi = {
  category: string;
  product: {
    name: string;
    brand: string;
  };
  type: 'premium' | 'dupe';
};

export type CompatibilityAdapterData = {
  routineSimulationPayload: AnyRecord;
  conflictHeatmapPayload: AnyRecord;
};

export type RoutineAdapterData = {
  amSteps: RoutineStepUi[];
  pmSteps: RoutineStepUi[];
  conflicts: string[];
  compatibility: 'known' | 'unknown';
};

export type TravelAdapterData = {
  payload: AnyRecord;
};

export type ProductVerdictAdapterData = {
  result: ProductAnalysisResult;
  photoPreview?: string;
};

export type SkinStatusAdapterData = {
  payload: {
    diagnosis: DiagnosisResult;
    avatarUrl?: string | null;
    photoHint?: boolean;
  };
};

export type EffectReviewAdapterData = {
  payload: AnyRecord;
};

export type TriageAdapterData = {
  summary: string;
  actionPoints: string[];
  nextSteps: string[];
  redFlags: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  recoveryWindowHours?: number;
  primaryAction?: {
    type: string;
    label: string;
    payload?: AnyRecord;
  };
  secondaryAction?: {
    type: string;
    label: string;
    payload?: AnyRecord;
  };
};

export type NudgeAdapterData = {
  message: string;
  hints: string[];
  cadenceDays?: number;
  primaryAction?: {
    type: string;
    label: string;
    payload?: AnyRecord;
  };
  secondaryAction?: {
    type: string;
    label: string;
    payload?: AnyRecord;
  };
};

export type ChatCardsAdapterHit =
  | { kind: 'compatibility'; data: CompatibilityAdapterData }
  | { kind: 'routine'; data: RoutineAdapterData }
  | { kind: 'travel'; data: TravelAdapterData }
  | { kind: 'product_verdict'; data: ProductVerdictAdapterData }
  | { kind: 'skin_status'; data: SkinStatusAdapterData }
  | { kind: 'effect_review'; data: EffectReviewAdapterData }
  | { kind: 'triage'; data: TriageAdapterData }
  | { kind: 'nudge'; data: NudgeAdapterData };

const asObject = (value: unknown): AnyRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as AnyRecord;
};

const asArray = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asStringArray = (value: unknown, limit = 20): string[] => {
  const out: string[] = [];
  for (const row of asArray(value)) {
    const text = asString(row);
    if (!text) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
};

const normalizeCategory = (raw: unknown): string => {
  const token = asString(raw).toLowerCase();
  if (!token) return 'treatment';
  if (token.includes('cleanser') || token.includes('洁面')) return 'cleanser';
  if (token.includes('spf') || token.includes('sunscreen') || token.includes('防晒')) return 'sunscreen';
  if (token.includes('moistur') || token.includes('cream') || token.includes('lotion') || token.includes('保湿')) return 'moisturizer';
  if (token.includes('treatment') || token.includes('serum') || token.includes('精华') || token.includes('功效')) return 'treatment';
  return token;
};

const sectionKind = (section: AnyRecord): string => asString(section.kind).toLowerCase();

const collectConflictText = (sections: AnyRecord[]): string[] => {
  const out: string[] = [];
  for (const section of sections) {
    const kind = sectionKind(section);
    const title = asString(section.title).toLowerCase();
    if (kind !== 'bullets' && kind !== 'checklist') continue;
    if (title && !title.includes('conflict') && !title.includes('冲突') && !title.includes('watchout') && !title.includes('风险')) continue;
    for (const item of asArray(section.items)) {
      if (typeof item === 'string') {
        const t = item.trim();
        if (t) out.push(t);
        continue;
      }
      const row = asObject(item);
      if (!row) continue;
      const text = asString(row.message) || asString(row.label) || asString(row.reason) || asString(row.name) || asString(row.value);
      if (text) out.push(text);
    }
  }
  return out.slice(0, 8);
};

const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeScore = (value: unknown, fallback = 68): number => {
  const parsed = asNumber(value);
  const score = parsed == null ? fallback : parsed;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const findSectionByKind = (sections: AnyRecord[], kind: string): AnyRecord | null =>
  sections.find((section) => sectionKind(section) === kind) || null;

const collectSectionItemsText = (
  sections: AnyRecord[],
  opts?: { includeKinds?: string[]; titleNeedles?: string[]; limit?: number },
): string[] => {
  const includeKinds = opts?.includeKinds ?? ['bullets', 'checklist'];
  const titleNeedles = (opts?.titleNeedles || []).map((token) => token.toLowerCase()).filter(Boolean);
  const limit = opts?.limit ?? 8;
  const out: string[] = [];

  for (const section of sections) {
    const kind = sectionKind(section);
    if (!includeKinds.includes(kind)) continue;
    const title = asString(section.title).toLowerCase();
    if (titleNeedles.length > 0 && !titleNeedles.some((needle) => title.includes(needle))) continue;

    for (const item of asArray(section.items)) {
      if (typeof item === 'string') {
        const text = item.trim();
        if (!text) continue;
        out.push(text);
      } else {
        const row = asObject(item);
        if (!row) continue;
        const text =
          asString(row.title) ||
          asString(row.message) ||
          asString(row.label) ||
          asString(row.reason) ||
          asString(row.name) ||
          asString(row.value) ||
          asString(row.detail);
        if (!text) continue;
        out.push(text);
      }
      if (out.length >= limit) return out;
    }
  }

  return out.slice(0, limit);
};

const normalizeRiskLevel = (value: unknown): 'none' | 'low' | 'medium' | 'high' => {
  const token = asString(value).toLowerCase();
  if (token === 'none' || token === 'low' || token === 'medium' || token === 'high') return token;
  if (token.includes('block') || token.includes('danger') || token.includes('urgent')) return 'high';
  if (token.includes('warn') || token.includes('require')) return 'medium';
  if (token.includes('caution')) return 'low';
  return 'medium';
};

const pickActionPair = (payload: AnyRecord): {
  primaryAction?: { type: string; label: string; payload?: AnyRecord };
  secondaryAction?: { type: string; label: string; payload?: AnyRecord };
} => {
  const safeActions = asArray(payload.actions)
    .map((row) => asObject(row))
    .filter(Boolean)
    .map((row) => ({
      type: asString(row.type),
      label: asString(row.label),
      payload: asObject(row.payload) || undefined,
    }))
    .filter((row) => row.type && row.label)
    .slice(0, 2);

  return {
    ...(safeActions[0] ? { primaryAction: safeActions[0] } : {}),
    ...(safeActions[1] ? { secondaryAction: safeActions[1] } : {}),
  };
};

const toSkinType = (value: unknown): SkinType | null => {
  const token = asString(value).toLowerCase();
  if (!token) return null;
  if (token === 'oily' || token === 'dry' || token === 'combination' || token === 'normal' || token === 'sensitive') {
    return token as SkinType;
  }
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

const toSkinConcern = (value: unknown): SkinConcern | null => {
  const token = asString(value).toLowerCase();
  if (!token) return null;
  return GOAL_TO_CONCERN[token] || null;
};

const toConcernList = (value: unknown, limit = 6): SkinConcern[] => {
  const out: SkinConcern[] = [];
  for (const row of asArray(value)) {
    const concern = toSkinConcern(row);
    if (!concern || out.includes(concern)) continue;
    out.push(concern);
    if (out.length >= limit) break;
  }
  return out;
};

const toBarrierStatus = (value: unknown): DiagnosisResult['barrierStatus'] => {
  const token = asString(value).toLowerCase();
  if (token === 'healthy' || token === 'impaired' || token === 'unknown') {
    return token as DiagnosisResult['barrierStatus'];
  }
  return 'unknown';
};

const normalizeSuitability = (value: unknown): ProductAnalysisResult['suitability'] => {
  const token = asString(value).toLowerCase();
  if (token === 'excellent' || token === 'good' || token === 'moderate' || token === 'poor') return token;
  if (token.includes('veto') || token.includes('avoid') || token.includes('not') || token.includes('mismatch')) return 'poor';
  if (token.includes('warn') || token.includes('risk') || token.includes('caution')) return 'moderate';
  if (token.includes('yes') || token.includes('fit') || token.includes('suitable')) return 'good';
  return 'moderate';
};

const suitabilityFallbackScore: Record<ProductAnalysisResult['suitability'], number> = {
  excellent: 90,
  good: 82,
  moderate: 68,
  poor: 35,
};

const toTiming = (value: unknown): ProductAnalysisResult['usageAdvice']['timing'] => {
  const token = asString(value).toLowerCase();
  if (!token) return 'both';
  if (token.includes('am') || token.includes('morning')) return 'AM';
  if (token.includes('pm') || token.includes('night') || token.includes('evening')) return 'PM';
  return 'both';
};

const toMechanismVector = (value: unknown): MechanismVector | null => {
  const token = asString(value).toLowerCase();
  if (!token) return null;
  if (token.includes('oil') || token.includes('acne') || token.includes('sebum') || token.includes('控油')) return 'oil_control';
  if (token.includes('sooth') || token.includes('calm') || token.includes('redness') || token.includes('舒缓')) return 'soothing';
  if (token.includes('repair') || token.includes('barrier') || token.includes('ceramide') || token.includes('修复')) return 'repair';
  if (token.includes('bright') || token.includes('spot') || token.includes('tone') || token.includes('提亮')) return 'brightening';
  if (token.includes('aging') || token.includes('wrinkle') || token.includes('retino') || token.includes('抗老')) return 'anti_aging';
  if (token.includes('hydrat') || token.includes('moist') || token.includes('dry') || token.includes('保湿')) return 'hydrating';
  return null;
};

const toMechanisms = (value: unknown, fallbackSignals: string[] = []): ProductAnalysisResult['mechanisms'] => {
  const out: ProductAnalysisResult['mechanisms'] = [];

  for (const row of asArray(value)) {
    if (typeof row === 'string') {
      const vector = toMechanismVector(row);
      if (!vector || out.some((entry) => entry.vector === vector)) continue;
      out.push({ vector, strength: 66 });
      continue;
    }

    const obj = asObject(row);
    if (!obj) continue;
    const vector = toMechanismVector(obj.vector || obj.name || obj.label || obj.type);
    if (!vector || out.some((entry) => entry.vector === vector)) continue;
    out.push({ vector, strength: normalizeScore(obj.strength, 66) });
  }

  for (const signal of fallbackSignals) {
    const vector = toMechanismVector(signal);
    if (!vector || out.some((entry) => entry.vector === vector)) continue;
    out.push({ vector, strength: 62 });
    if (out.length >= 6) break;
  }

  return out.slice(0, 6);
};

const adaptCompatibility = (sections: AnyRecord[]): CompatibilityAdapterData | null => {
  const structured = sections.find((section) => sectionKind(section) === 'compatibility_structured');
  if (structured) {
    const routineSimulationPayload = asObject(structured.routine_simulation) || {};
    const conflictHeatmapPayload = asObject(structured.conflict_heatmap) || {};
    return {
      routineSimulationPayload,
      conflictHeatmapPayload,
    };
  }

  const conflicts = collectConflictText(sections);
  const fallbackSimulation = {
    safe: conflicts.length === 0,
    summary: conflicts.length ? conflicts[0] : '',
    conflicts: conflicts.map((message, idx) => ({
      rule_id: `chatcards_v1_${idx + 1}`,
      message,
      severity: 'warn',
      step_indices: [0, 1],
    })),
  };

  const fallbackHeatmap = {
    schema_version: 'aurora.ui.conflict_heatmap.v1',
    title_i18n: { en: 'Compatibility heatmap', zh: '搭配热力图' },
    subtitle_i18n: { en: 'Fallback mapping from card sections', zh: '由卡片内容生成的回退热力图' },
    axes: {
      rows: {
        items: [
          { index: 0, step_key: 'step_1', label_i18n: { en: 'Step 1', zh: '步骤 1' }, short_label_i18n: { en: 'S1', zh: 'S1' } },
          { index: 1, step_key: 'step_2', label_i18n: { en: 'Step 2', zh: '步骤 2' }, short_label_i18n: { en: 'S2', zh: 'S2' } },
        ],
      },
      cols: {
        items: [
          { index: 0, step_key: 'step_1', label_i18n: { en: 'Step 1', zh: '步骤 1' }, short_label_i18n: { en: 'S1', zh: 'S1' } },
          { index: 1, step_key: 'step_2', label_i18n: { en: 'Step 2', zh: '步骤 2' }, short_label_i18n: { en: 'S2', zh: 'S2' } },
        ],
      },
    },
    cells: {
      items: conflicts.length
        ? [
            {
              row_index: 0,
              col_index: 1,
              severity: 2,
              rule_ids: ['chatcards_v1_1'],
              headline_i18n: { en: 'Potential conflict', zh: '潜在冲突' },
              why_i18n: { en: conflicts[0], zh: conflicts[0] },
              recommendations: [{ en: 'Separate into AM/PM or alternate nights.', zh: '建议分 AM/PM 或隔天使用。' }],
            },
          ]
        : [],
    },
  };

  if (!conflicts.length) return null;
  return {
    routineSimulationPayload: fallbackSimulation,
    conflictHeatmapPayload: fallbackHeatmap,
  };
};

const toRoutineStepsFromStructured = (list: unknown, language: Language): RoutineStepUi[] => {
  const fallbackBrand = language === 'CN' ? '未知品牌' : 'Unknown';
  const fallbackName = language === 'CN' ? '未命名步骤' : 'Unnamed step';
  const out: RoutineStepUi[] = [];

  for (const raw of asArray(list)) {
    const row = asObject(raw);
    if (!row) continue;

    const category = normalizeCategory(row.category || row.slot || row.step || row.type);
    const brand = asString(row.product_brand) || asString(row.brand) || fallbackBrand;
    const name =
      asString(row.product_name) ||
      asString(row.name) ||
      asString(row.product) ||
      asString((asObject(row.product_ref) || {}).name) ||
      fallbackName;
    const typeRaw = asString(row.item_type || row.type || row.tier).toLowerCase();
    const type: 'premium' | 'dupe' = typeRaw.includes('dupe') ? 'dupe' : 'premium';

    out.push({
      category,
      product: { brand, name },
      type,
    });
  }

  return out.slice(0, 12);
};

const toRoutineStepsFromListSection = (section: AnyRecord, language: Language): RoutineStepUi[] => {
  const fallbackBrand = language === 'CN' ? '未知品牌' : 'Unknown';
  const fallbackName = language === 'CN' ? '未命名步骤' : 'Unnamed step';

  return asArray(section.items)
    .map((raw) => {
      const row = asObject(raw);
      if (!row) return null;

      const name = asString(row.name) || asString(row.label) || fallbackName;
      if (!name) return null;
      const category = normalizeCategory(row.category || row.slot || row.type || row.step || name);
      const brand = asString(row.brand) || fallbackBrand;
      return {
        category,
        product: { brand, name },
        type: 'premium' as const,
      };
    })
    .filter(Boolean)
    .slice(0, 12) as RoutineStepUi[];
};

const adaptRoutine = (sections: AnyRecord[], language: Language): RoutineAdapterData | null => {
  const structured = sections.find((section) => sectionKind(section) === 'routine_structured');
  if (structured) {
    const amSteps = toRoutineStepsFromStructured(structured.am_steps, language);
    const pmSteps = toRoutineStepsFromStructured(structured.pm_steps, language);
    const conflicts = asStringArray(structured.conflicts, 8);
    if (!amSteps.length && !pmSteps.length) return null;
    return {
      amSteps,
      pmSteps,
      conflicts,
      compatibility: conflicts.length ? 'known' : 'unknown',
    };
  }

  const amSection = sections.find((section) => sectionKind(section) === 'routine_list' && asString(section.title).toLowerCase() === 'am');
  const pmSection = sections.find((section) => sectionKind(section) === 'routine_list' && asString(section.title).toLowerCase() === 'pm');
  const amSteps = amSection ? toRoutineStepsFromListSection(amSection, language) : [];
  const pmSteps = pmSection ? toRoutineStepsFromListSection(pmSection, language) : [];
  if (!amSteps.length && !pmSteps.length) return null;

  const conflicts = collectConflictText(sections);
  return {
    amSteps,
    pmSteps,
    conflicts,
    compatibility: conflicts.length ? 'known' : 'unknown',
  };
};

const adaptTravel = (payload: AnyRecord, sections: AnyRecord[]): TravelAdapterData | null => {
  const structured = sections.find((section) => sectionKind(section) === 'travel_structured');
  if (structured) {
    const envPayload = asObject(structured.env_payload);
    if (envPayload) {
      return { payload: envPayload };
    }
  }

  const rootHasEnvSignals =
    asObject(payload.travel_readiness) ||
    asObject(payload.destination_context) ||
    asObject(payload.delta_vs_home) ||
    asObject(payload.env_stress);
  if (rootHasEnvSignals) {
    return { payload };
  }

  return null;
};

const adaptProductVerdict = (
  payload: AnyRecord,
  sections: AnyRecord[],
  language: Language,
): ProductVerdictAdapterData | null => {
  const structured = findSectionByKind(sections, 'product_verdict_structured');
  const source = structured || {};

  const whyLines = collectSectionItemsText(sections, {
    includeKinds: ['bullets', 'checklist'],
    titleNeedles: ['why', 'summary', '原因', '总结'],
    limit: 6,
  });
  const watchoutLines = collectSectionItemsText(sections, {
    includeKinds: ['bullets', 'checklist'],
    titleNeedles: ['watch', 'risk', 'caution', '冲突', '风险'],
    limit: 6,
  });

  const verdict = asString(source.verdict);
  const suitability = normalizeSuitability(source.suitability || verdict);
  const productName =
    asString(source.product_name) ||
    asString(payload.product_name) ||
    asString(payload.title) ||
    (language === 'CN' ? '当前产品' : 'Current product');
  const brand =
    asString(source.brand) ||
    asString(payload.brand) ||
    (language === 'CN' ? '未知品牌' : 'Unknown');

  const scoreBase = normalizeScore(
    source.match_score,
    suitabilityFallbackScore[suitability],
  );
  const beneficial = asStringArray(source.beneficial_ingredients, 10);
  const caution = asStringArray(source.caution_ingredients, 10);
  const safetySignals = caution.length ? caution : watchoutLines;
  const usage = asObject(source.usage) || {};
  const usageNotes = asStringArray(usage.notes, 6);
  const usageTiming = toTiming(usage.timing || source.timing);
  const mechanisms = toMechanisms(source.mechanisms, [
    ...beneficial,
    ...safetySignals,
    ...whyLines,
  ]);

  const dupeRaw =
    asObject(source.dupe_recommendation) ||
    asObject(payload.dupe_recommendation) ||
    asObject(payload.dupeRecommendation);
  const dupeName = asString(dupeRaw?.name);
  const dupeBrand = asString(dupeRaw?.brand);
  const dupeReason = asString(dupeRaw?.reason);
  const dupeSavings = normalizeScore(dupeRaw?.savingsPercent, 30);
  const dupeRecommendation =
    dupeName || dupeBrand || dupeReason
      ? {
          name: dupeName || (language === 'CN' ? '替代方案' : 'Alternative'),
          brand: dupeBrand || (language === 'CN' ? '未知品牌' : 'Unknown'),
          reason: dupeReason || (language === 'CN' ? '预算友好替代。' : 'Budget-friendly alternative.'),
          savingsPercent: dupeSavings,
        }
      : undefined;

  const skinProfileRaw = asObject(source.skin_profile_match) || {};
  const matchedConcerns = toConcernList(skinProfileRaw.matched_concerns || skinProfileRaw.concerns, 6);
  const unmatchedConcerns = toConcernList(skinProfileRaw.unmatched_concerns, 6);
  const skinType = toSkinType(skinProfileRaw.skin_type || skinProfileRaw.skinType);
  const skinProfileMatch =
    skinType || matchedConcerns.length || unmatchedConcerns.length
      ? {
          skinType: skinType || 'normal',
          matchedConcerns,
          unmatchedConcerns,
        }
      : undefined;

  if (!structured && !whyLines.length && !watchoutLines.length && !productName) {
    return null;
  }

  const result: ProductAnalysisResult = {
    productName,
    brand,
    matchScore: scoreBase,
    suitability,
    mechanisms,
    ingredients: {
      beneficial,
      caution: safetySignals.slice(0, 8),
      ...(asString(source.veto) ? { veto: asString(source.veto) } : {}),
    },
    usageAdvice: {
      timing: usageTiming,
      notes:
        usageNotes[0] ||
        whyLines[0] ||
        (language === 'CN' ? '先从低频开始，观察耐受。' : 'Start low frequency and monitor tolerance.'),
    },
    ...(dupeRecommendation ? { dupeRecommendation } : {}),
    ...(skinProfileMatch ? { skinProfileMatch } : {}),
  };

  return {
    result,
    photoPreview: asString(payload.photo_preview) || asString(payload.photoPreview) || undefined,
  };
};

const adaptSkinStatus = (payload: AnyRecord, sections: AnyRecord[]): SkinStatusAdapterData | null => {
  const structured = findSectionByKind(sections, 'skin_status_structured');
  const diagnosisRaw = asObject(structured?.diagnosis) || asObject(payload.diagnosis) || {};

  const skinType = toSkinType(
    diagnosisRaw.skin_type || diagnosisRaw.skinType || payload.skin_type || payload.skinType,
  );
  const barrierStatus = toBarrierStatus(
    diagnosisRaw.barrier_status || diagnosisRaw.barrierStatus || payload.barrier_status || payload.barrierStatus,
  );
  const concerns = toConcernList(
    diagnosisRaw.concerns || diagnosisRaw.goals || payload.concerns || payload.goals,
    8,
  );

  if (!skinType && barrierStatus === 'unknown' && concerns.length === 0) {
    return null;
  }

  const diagnosis: DiagnosisResult = {
    ...(skinType ? { skinType } : {}),
    concerns,
    currentRoutine: 'basic',
    barrierStatus,
  };

  return {
    payload: {
      diagnosis,
      avatarUrl:
        asString(structured?.avatar_url) ||
        asString(payload.avatar_url) ||
        asString(payload.avatarUrl) ||
        null,
      photoHint: structured?.photo_hint !== false && payload.photo_hint !== false,
    },
  };
};

const adaptEffectReview = (payload: AnyRecord, sections: AnyRecord[]): EffectReviewAdapterData | null => {
  const structured = findSectionByKind(sections, 'effect_review_structured');

  const structuredFindings = asArray(structured?.priority_findings)
    .map((row) => asObject(row))
    .filter(Boolean)
    .map((row) => ({
      title: asString(row?.title) || asString(row?.detail),
      detail: asString(row?.detail) || asString(row?.title),
    }))
    .filter((row) => row.title || row.detail)
    .slice(0, 8);

  const fallbackFindings = collectSectionItemsText(sections, {
    includeKinds: ['bullets', 'checklist'],
    titleNeedles: ['cause', 'reason', '复盘', '原因', 'watchout', 'risk'],
    limit: 8,
  }).map((line) => ({ title: line, detail: line }));

  const targetState = asStringArray(structured?.target_state, 6);
  const corePrinciples = asStringArray(structured?.core_principles, 8);
  const timelineObj = asObject(structured?.timeline) || {};
  const first4Weeks = asStringArray(timelineObj.first_4_weeks, 6);
  const week8To12 = asStringArray(timelineObj.week_8_12_expectation, 6);
  const safetyNotes = asStringArray(structured?.safety_notes, 8);
  const routineBridge = asObject(structured?.routine_bridge) || {};

  const payloadOut: AnyRecord = {
    priority_findings: structuredFindings.length ? structuredFindings : fallbackFindings,
    ...(targetState.length ? { target_state: targetState } : {}),
    ...(corePrinciples.length ? { core_principles: corePrinciples } : {}),
    ...(first4Weeks.length || week8To12.length
      ? {
          timeline: {
            first_4_weeks: first4Weeks,
            week_8_12_expectation: week8To12,
          },
        }
      : {}),
    ...(safetyNotes.length ? { safety_notes: safetyNotes } : {}),
    ...(Object.keys(routineBridge).length ? { routine_bridge: routineBridge } : {}),
  };

  if (
    !Array.isArray(payloadOut.priority_findings) ||
    payloadOut.priority_findings.length === 0
  ) {
    return null;
  }

  const rootBridge = asObject(payload.routine_bridge) || asObject(payload.routineBridge);
  if (rootBridge && !payloadOut.routine_bridge) {
    payloadOut.routine_bridge = rootBridge;
  }

  return { payload: payloadOut };
};

const adaptTriage = (payload: AnyRecord, sections: AnyRecord[]): TriageAdapterData | null => {
  const structured = findSectionByKind(sections, 'triage_structured');
  const summary =
    asString(structured?.summary) ||
    collectSectionItemsText(sections, {
      includeKinds: ['bullets', 'checklist'],
      titleNeedles: ['action', '要点', 'triage', '应急'],
      limit: 1,
    })[0] ||
    '';

  const actionPoints = asStringArray(structured?.action_points, 8);
  const nextSteps = asStringArray(structured?.next_steps, 6);
  const redFlags = asStringArray(structured?.red_flags, 6);
  const riskLevel = normalizeRiskLevel(structured?.risk_level || payload.risk_level || payload.severity);
  const recoveryWindowHoursRaw = asNumber(structured?.recovery_window_hours);

  const fallbackActionPoints = collectSectionItemsText(sections, {
    includeKinds: ['bullets', 'checklist'],
    titleNeedles: ['action', '要点', 'execute', '执行'],
    limit: 8,
  });
  const fallbackNextSteps = collectSectionItemsText(sections, {
    includeKinds: ['bullets', 'checklist'],
    titleNeedles: ['next', '下一步'],
    limit: 6,
  });
  const fallbackRedFlags = collectSectionItemsText(sections, {
    includeKinds: ['bullets', 'checklist'],
    titleNeedles: ['red flag', 'risk', 'warning', '红旗', '风险'],
    limit: 6,
  });

  const resolvedActionPoints = actionPoints.length ? actionPoints : fallbackActionPoints;
  const resolvedNextSteps = nextSteps.length ? nextSteps : fallbackNextSteps;
  const resolvedRedFlags = redFlags.length ? redFlags : fallbackRedFlags;

  if (!summary && resolvedActionPoints.length === 0 && resolvedNextSteps.length === 0) {
    return null;
  }

  return {
    summary:
      summary ||
      resolvedActionPoints[0] ||
      resolvedNextSteps[0] ||
      'Follow conservative triage steps and monitor symptoms.',
    actionPoints: resolvedActionPoints.slice(0, 8),
    nextSteps: resolvedNextSteps.slice(0, 6),
    redFlags: resolvedRedFlags.slice(0, 6),
    riskLevel,
    ...(typeof recoveryWindowHoursRaw === 'number' && Number.isFinite(recoveryWindowHoursRaw)
      ? { recoveryWindowHours: Math.max(0, Math.trunc(recoveryWindowHoursRaw)) }
      : {}),
    ...pickActionPair(payload),
  };
};

const adaptNudge = (payload: AnyRecord, sections: AnyRecord[]): NudgeAdapterData | null => {
  const structured = findSectionByKind(sections, 'nudge_structured');
  const message =
    asString(structured?.message) ||
    collectSectionItemsText(sections, {
      includeKinds: ['bullets', 'checklist'],
      titleNeedles: ['tip', '提示', 'nudge'],
      limit: 1,
    })[0] ||
    '';
  const hints = asStringArray(structured?.hints, 6);
  const cadenceDaysRaw = asNumber(structured?.cadence_days);
  const fallbackHints = collectSectionItemsText(sections, {
    includeKinds: ['bullets', 'checklist'],
    titleNeedles: ['why', 'help', 'reason', '有帮助', '原因'],
    limit: 6,
  });

  if (!message && hints.length === 0 && fallbackHints.length === 0) return null;

  return {
    message: message || hints[0] || fallbackHints[0] || '',
    hints: (hints.length ? hints : fallbackHints).slice(0, 6),
    ...(typeof cadenceDaysRaw === 'number' && Number.isFinite(cadenceDaysRaw)
      ? { cadenceDays: Math.max(0, Math.trunc(cadenceDaysRaw)) }
      : {}),
    ...pickActionPair(payload),
  };
};

export function adaptChatCardForRichRender({
  cardType,
  payload,
  language,
}: {
  cardType: string;
  payload: AnyRecord;
  language: Language;
}): ChatCardsAdapterHit | null {
  const normalizedType = String(cardType || '').trim().toLowerCase();
  const sections = asArray(payload.sections).map((row) => asObject(row)).filter(Boolean) as AnyRecord[];

  if (normalizedType === 'compatibility') {
    const adapted = adaptCompatibility(sections);
    return adapted ? { kind: 'compatibility', data: adapted } : null;
  }

  if (normalizedType === 'routine') {
    const adapted = adaptRoutine(sections, language);
    return adapted ? { kind: 'routine', data: adapted } : null;
  }

  if (normalizedType === 'travel') {
    const adapted = adaptTravel(payload, sections);
    return adapted ? { kind: 'travel', data: adapted } : null;
  }

  if (normalizedType === 'product_verdict') {
    const adapted = adaptProductVerdict(payload, sections, language);
    return adapted ? { kind: 'product_verdict', data: adapted } : null;
  }

  if (normalizedType === 'skin_status') {
    const adapted = adaptSkinStatus(payload, sections);
    return adapted ? { kind: 'skin_status', data: adapted } : null;
  }

  if (normalizedType === 'effect_review') {
    const adapted = adaptEffectReview(payload, sections);
    return adapted ? { kind: 'effect_review', data: adapted } : null;
  }

  if (normalizedType === 'triage') {
    const adapted = adaptTriage(payload, sections);
    return adapted ? { kind: 'triage', data: adapted } : null;
  }

  if (normalizedType === 'nudge') {
    const adapted = adaptNudge(payload, sections);
    return adapted ? { kind: 'nudge', data: adapted } : null;
  }

  return null;
}
