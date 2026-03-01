import type { Card, V1Envelope } from '@/lib/pivotaAgentBff';

export type IngredientEvidenceGrade = 'A' | 'B' | 'C' | null;

export type IngredientRiskLevel = 'low' | 'medium' | 'high' | null;

export type IngredientTimeToResults = '2-4w' | '4-8w' | '8-12w' | null;

export type CitationRelevance = 'strong' | 'category' | 'weak';

export type IngredientReportLocale = 'en-US' | 'zh-CN';

export type IngredientReportPayloadV1 = {
  schema_version: 'aurora.ingredient_report.v1' | 'aurora.ingredient_report.v2-lite';
  locale: IngredientReportLocale;
  ingredient: {
    inci: string;
    display_name: string;
    aliases: string[];
    alias_source?: 'curated';
    category: string;
  };
  verdict: {
    one_liner: string;
    top_benefits: string[];
    evidence_grade: IngredientEvidenceGrade;
    irritation_risk: IngredientRiskLevel;
    time_to_results: IngredientTimeToResults;
    confidence: number | null;
    confidence_level?: 'low' | 'medium' | 'high';
  };
  benefits: Array<{ concern: string; strength: 0 | 1 | 2 | 3; what_it_means: string }>;
  how_to_use: {
    frequency: string | null;
    routine_step: string | null;
    pair_well: string[];
    consider_separating: string[];
    notes: string[];
  };
  watchouts: Array<{
    issue: string;
    likelihood: 'uncommon' | 'common' | 'rare' | null;
    what_to_do: string;
  }>;
  use_cases: Array<{
    title: string;
    who_for: string;
    routine_tip: string;
    products_from_kb: string[];
  }>;
  evidence: {
    summary: string;
    citations: Array<{
      title: string;
      url: string;
      year: number | null;
      source: string | null;
      relevance: CitationRelevance | null;
    }>;
    show_citations_by_default: boolean;
  };
  next_questions: Array<{ id: string; label: string; chips: string[] }>;
  research_status?: 'ready' | 'fallback' | 'disabled' | 'provider_unavailable' | 'queued' | 'error' | 'none';
  research_provider?: 'gemini' | 'openai' | null;
  research_attempts?: Array<{ provider: string; outcome: string; reason_code: string }>;
  research_error_code?: string;
  top_products?: Array<{
    name: string;
    brand?: string;
    category?: string;
    price_tier?: string;
    why?: string;
    pdp_url?: string;
  }>;
  updated_at_ms?: number;
  normalized_query?: string | null;
  route_decision_reasons?: string[];
  route_rule_version?: string | null;
  kb_revision?: string | null;
  provider_model_tier?: string | null;
  provider_circuit_state?: 'open' | 'half_open' | 'closed' | string | null;
  personalized_fit?: {
    summary?: string;
    adjustments?: string[];
    warnings?: string[];
  };
};

export type IngredientReportCard = Card & {
  type: 'aurora_ingredient_report';
  payload: IngredientReportPayloadV1;
};

type IngredientReportBuildInput = Partial<V1Envelope> & {
  query?: unknown;
  structured?: unknown;
};

type IngredientSearchHit = {
  product_id: string;
  display_name?: string;
  matched_terms: string[];
  score: number;
};

type ResearchProfile = {
  ingredient_id?: unknown;
  inci_name?: unknown;
  zh_name?: unknown;
  evidence_grade?: unknown;
  primary_benefits?: unknown;
  key_watchouts?: unknown;
  categories?: unknown;
  suitability_rule?: unknown;
};

type ExternalCitation = {
  title: string;
  source: string | null;
  year: number | null;
  url: string;
  note: string | null;
  abstract: string | null;
  keywords: string[];
};

type InciResolution = {
  inci: string;
  display_name: string;
  aliases: string[];
  aliasSource?: 'curated';
  fromUnknown: boolean;
};

// Curated, auditable alias whitelist only. Never infer aliases from model output.
const CURATED_INGREDIENT_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'palmitoyl tripeptide-38': ['Matrixyl Synthe\'6', 'Matrixyl Synthe6', 'Matrixyl Synthe-6', 'Matrixyl'],
});

const PEPTIDE_KEYWORDS = ['peptide', 'tripeptide', 'tetrapeptide', 'dipeptide', 'oligopeptide', 'matrixyl'];

const SKIN_AGING_KEYWORDS = [
  'skin',
  'dermat',
  'wrinkle',
  'aging',
  'anti-aging',
  'photoaging',
  'facial',
  'cosmetic',
  'topical',
  'skincare',
  '皮肤',
  '抗老',
  '皱纹',
  '面部',
  '外用',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown, max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of asArray(value)) {
    const t = asString(item);
    if (!t) continue;
    const key = normalizeKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeKey(value: unknown): string {
  return asString(value)
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^a-z0-9\u4e00-\u9fff+\-\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeType(value: unknown): string {
  return asString(value)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .trim();
}

function uniq(values: string[], max = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = asString(value);
    if (!clean) continue;
    const key = normalizeKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampStrength(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 3) return 3;
  if (value >= 2) return 2;
  return 1;
}

function isZhLocale(locale: IngredientReportLocale): boolean {
  return locale === 'zh-CN';
}

function normalizeLocaleTag(rawTag: string): IngredientReportLocale | null {
  const lower = asString(rawTag).toLowerCase().replace(/_/g, '-');
  if (!lower) return null;
  if (lower.startsWith('zh') || lower === 'cn') return 'zh-CN';
  if (lower.startsWith('en')) return 'en-US';
  return null;
}

function detectUserLanguage(currentUserMessageText: string): IngredientReportLocale | null {
  const text = asString(currentUserMessageText);
  if (!text) return null;
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[a-z]/i.test(text)) return 'en-US';
  return null;
}

function extractRequestLang(
  existingResponse: IngredientReportBuildInput,
  structured: Record<string, unknown> | null,
): string {
  const root = asObject(existingResponse as unknown);
  const meta = asObject(root?.meta);
  const rootRequest = asObject(root?.request);
  const metaRequest = asObject(meta?.request);
  const structuredRequest = asObject(structured?.request);
  const parse = asObject(structured?.parse);

  const candidates = [
    asString(rootRequest?.lang),
    asString(metaRequest?.lang),
    asString(structuredRequest?.lang),
    asString(root?.lang),
    asString(meta?.lang),
    asString(parse?.request_lang),
  ].filter(Boolean);

  return candidates[0] ?? '';
}

function extractUiLocale(
  existingResponse: IngredientReportBuildInput,
  structured: Record<string, unknown> | null,
): string {
  const root = asObject(existingResponse as unknown);
  const meta = asObject(root?.meta);
  const parse = asObject(structured?.parse);

  const candidates = [
    asString(root?.ui_locale),
    asString(meta?.ui_locale),
    asString(structured?.ui_locale),
    asString(parse?.ui_locale),
  ].filter(Boolean);

  return candidates[0] ?? '';
}

function extractCurrentUserMessageText(
  existingResponse: IngredientReportBuildInput,
  structured: Record<string, unknown> | null,
): string {
  const root = asObject(existingResponse as unknown);
  const meta = asObject(root?.meta);
  const rootRequest = asObject(root?.request);
  const metaRequest = asObject(meta?.request);
  const parse = asObject(structured?.parse);

  const candidates = [
    asString(existingResponse.query),
    asString(root?.current_user_message_text),
    asString(root?.currentUserMessageText),
    asString(root?.user_message),
    asString(root?.userMessage),
    asString(meta?.current_user_message_text),
    asString(meta?.currentUserMessageText),
    asString(meta?.user_message),
    asString(meta?.userMessage),
    asString(rootRequest?.query),
    asString(rootRequest?.text),
    asString(metaRequest?.query),
    asString(metaRequest?.text),
    asString(parse?.original_query),
    asString(parse?.raw_query),
    asString(parse?.user_query),
    asString(parse?.source_query),
  ].filter(Boolean);

  return candidates[0] ?? '';
}

function toLocale(params: {
  requestLang: string;
  currentUserMessageText: string;
  uiLocale: string;
  parseLanguageTag: string;
}): IngredientReportLocale {
  const byRequest = normalizeLocaleTag(params.requestLang);
  if (byRequest) return byRequest;

  const byDetectedUserText = detectUserLanguage(params.currentUserMessageText);
  if (byDetectedUserText) return byDetectedUserText;

  const byUiLocale = normalizeLocaleTag(params.uiLocale);
  if (byUiLocale) return byUiLocale;

  const byParse = normalizeLocaleTag(params.parseLanguageTag);
  if (byParse) return byParse;

  return 'en-US';
}

function findStructuredPayload(existingResponse: IngredientReportBuildInput): Record<string, unknown> | null {
  const cards = asArray(existingResponse.cards);
  const structuredCard = cards
    .map((card) => asObject(card))
    .find((card) => normalizeType(card?.type) === 'aurora_structured');
  if (structuredCard && isPlainObject(structuredCard.payload)) return structuredCard.payload;

  const rootStructured = asObject(existingResponse.structured);
  if (rootStructured) return rootStructured;

  return null;
}

function extractQuotedIngredient(queryText: string): string {
  const withIngredientHint = queryText.match(/(?:ingredient|inci|成分)\s*["“'']([^"”'']{2,120})["”'']/i);
  if (withIngredientHint?.[1]) return withIngredientHint[1].trim();

  const genericQuoted = queryText.match(/["“'']([^"”'']{2,120})["”'']/);
  if (genericQuoted?.[1]) return genericQuoted[1].trim();

  return '';
}

function resolveAliases(inci: string): string[] {
  const normalized = normalizeKey(inci);
  return uniq([...(CURATED_INGREDIENT_ALIASES[normalized] ?? [])], 8);
}

function resolveInci(params: {
  structured: Record<string, unknown> | null;
  existingResponse: IngredientReportBuildInput;
}): InciResolution {
  const parse = asObject(params.structured?.parse);
  const normalizedQuery = asString(parse?.normalized_query);
  const rootQuery = asString(params.existingResponse.query);
  const ingredientSearch = asObject(params.structured?.ingredient_search);
  const ext = asObject(params.structured?.external_verification);

  const candidates = [
    extractQuotedIngredient(normalizedQuery),
    extractQuotedIngredient(rootQuery),
    asString(ingredientSearch?.query),
    asString(ext?.query),
  ].filter(Boolean);

  const inci = candidates[0] ? candidates[0] : 'unknown';
  const aliases = inci === 'unknown' ? [] : resolveAliases(inci);
  const aliasSource: 'curated' | undefined = aliases.length ? 'curated' : undefined;

  return {
    inci,
    display_name: inci,
    aliases,
    aliasSource,
    fromUnknown: inci === 'unknown',
  };
}

function inferCategory(inci: string, profile: ResearchProfile | null, structured: Record<string, unknown> | null): string {
  const profileCategories = asStringArray(profile?.categories ?? [], 4);
  if (profileCategories.length) return profileCategories[0].toLowerCase();

  const parse = asObject(structured?.parse);
  const query = [inci, asString(parse?.normalized_query)].join(' ').toLowerCase();
  if (PEPTIDE_KEYWORDS.some((kw) => query.includes(kw))) return 'peptide';
  return 'unknown';
}

function collectProfiles(structured: Record<string, unknown> | null): ResearchProfile[] {
  return asArray(structured?.ingredient_research_profiles)
    .map((item) => asObject(item))
    .filter(Boolean) as ResearchProfile[];
}

function matchProfile(inci: string, aliases: string[], profiles: ResearchProfile[]): ResearchProfile | null {
  if (!profiles.length || inci === 'unknown') return null;
  const target = normalizeKey(inci);
  const aliasKeys = aliases.map((a) => normalizeKey(a));

  for (const profile of profiles) {
    const inciName = normalizeKey(profile.inci_name);
    if (inciName && inciName === target) return profile;
  }

  for (const profile of profiles) {
    const profileTokens = [asString(profile.inci_name), asString(profile.ingredient_id), asString(profile.zh_name)]
      .map((x) => normalizeKey(x))
      .filter(Boolean);
    if (profileTokens.some((token) => aliasKeys.some((alias) => token.includes(alias) || alias.includes(token)))) {
      return profile;
    }
  }

  return null;
}

function normalizeEvidenceGrade(value: unknown): IngredientEvidenceGrade {
  const raw = asString(value).toUpperCase();
  if (raw === 'A' || raw === 'B' || raw === 'C') return raw;
  return 'unknown';
}

function mapConcern(raw: string): string {
  const t = normalizeKey(raw);
  if (!t) return 'unknown';
  if (/(wrinkle|line|fine line|细纹|皱纹)/.test(t)) return 'fine-lines';
  if (/(firm|elastic|紧致|弹性)/.test(t)) return 'firmness';
  if (/(texture|smooth|肤感|肤质|平滑)/.test(t)) return 'texture';
  if (/(bright|tone|pigment|提亮|色沉|色斑|均匀肤色)/.test(t)) return 'brightening';
  if (/(hydrate|hydration|moist|补水|保湿)/.test(t)) return 'hydration';
  if (/(redness|敏感|泛红|repair|barrier|屏障)/.test(t)) return 'barrier-support';
  if (/(acne|pore|痘|毛孔)/.test(t)) return 'acne';
  return t.replace(/\s+/g, '-');
}

function concernLabel(concern: string, locale: IngredientReportLocale): string {
  const zh = {
    'fine-lines': '细纹',
    firmness: '紧致',
    texture: '肤质平滑',
    brightening: '提亮',
    hydration: '保湿',
    'barrier-support': '屏障支持',
    acne: '痘痘/毛孔',
    unknown: '肤况改善',
  } as const;

  const en = {
    'fine-lines': 'fine lines',
    firmness: 'firmness',
    texture: 'texture',
    brightening: 'brightening',
    hydration: 'hydration',
    'barrier-support': 'barrier support',
    acne: 'acne/pores',
    unknown: 'general skin goals',
  } as const;

  if (isZhLocale(locale)) return (zh as Record<string, string>)[concern] ?? concern;
  return (en as Record<string, string>)[concern] ?? concern;
}

function defaultBenefitsByCategory(category: string): string[] {
  if (category === 'peptide') return ['fine-lines', 'firmness', 'texture'];
  return ['texture', 'hydration'];
}

function buildBenefits(params: {
  locale: IngredientReportLocale;
  evidenceGrade: IngredientEvidenceGrade;
  profile: ResearchProfile | null;
  category: string;
}): Array<{ concern: string; strength: 0 | 1 | 2 | 3; what_it_means: string }> {
  const fromProfile = asStringArray(params.profile?.primary_benefits ?? [], 6).map(mapConcern);
  const concerns = fromProfile.length ? fromProfile : defaultBenefitsByCategory(params.category);

  const baseStrength =
    params.profile == null
      ? 1
      : params.evidenceGrade === 'A'
        ? 3
        : params.evidenceGrade === 'B'
          ? 2
          : 1;

  const usesFallback = params.profile == null;

  return uniq(concerns, 4).map((concern, idx) => {
    const strength = usesFallback ? clampStrength(idx === 0 ? 2 : 1) : clampStrength(baseStrength - (idx >= 2 ? 1 : 0));
    const label = concernLabel(concern, params.locale);
    const what_it_means = isZhLocale(params.locale)
      ? usesFallback
        ? `可能对${label}有帮助，但效果受配方与浓度影响。`
        : `常用于改善${label}，实际效果仍取决于配方与浓度。`
      : usesFallback
        ? `May support ${label}, but outcomes vary by formulation and concentration.`
        : `Often used to support ${label}; outcomes still depend on formulation and concentration.`;
    return { concern, strength, what_it_means };
  });
}

function mapWatchoutIssue(raw: string): string {
  const t = normalizeKey(raw);
  if (!t) return 'irritation';
  if (/(allerg|过敏)/.test(t)) return 'allergy';
  if (/(irrit|sting|burn|刺激|刺痛)/.test(t)) return 'irritation';
  if (/(dry|干燥)/.test(t)) return 'dryness';
  if (/(breakout|acne|闷痘|爆痘)/.test(t)) return 'breakout';
  return t.replace(/\s+/g, '_');
}

function buildWatchouts(params: {
  locale: IngredientReportLocale;
  profile: ResearchProfile | null;
  category: string;
}): IngredientReportPayloadV1['watchouts'] {
  const fromProfile = asStringArray(params.profile?.key_watchouts ?? [], 6).map(mapWatchoutIssue);
  const watchIssues = fromProfile.length ? fromProfile : ['irritation', 'allergy'];

  return uniq(watchIssues, 4).map((issue) => {
    const likelihood: 'uncommon' | 'common' | 'rare' | 'unknown' =
      issue === 'allergy' ? 'rare' : issue === 'irritation' ? 'uncommon' : 'unknown';

    const what_to_do = isZhLocale(params.locale)
      ? issue === 'irritation'
        ? '先做局部测试，出现持续刺痛就停用并降低频率。'
        : issue === 'allergy'
          ? '若出现明显红肿瘙痒，立即停用并咨询专业人士。'
          : '如有不适，先停用并简化护肤步骤。'
      : issue === 'irritation'
        ? 'Patch test first; stop and reduce frequency if persistent stinging occurs.'
        : issue === 'allergy'
          ? 'Stop immediately and seek professional advice if marked swelling/itching appears.'
          : 'Pause use and simplify routine if discomfort appears.';

    return {
      issue,
      likelihood,
      what_to_do,
    };
  });
}

function mapFrequency(raw: string): 'daily' | '3-4x/week' | 'unknown' {
  const t = normalizeKey(raw);
  if (!t) return 'unknown';
  if (/(daily|每天|每日|once daily|twice daily)/.test(t)) return 'daily';
  if (/(3|4|three|four|隔天|每周|week)/.test(t)) return '3-4x/week';
  return 'unknown';
}

function buildHowToUse(params: {
  locale: IngredientReportLocale;
  profile: ResearchProfile | null;
  category: string;
}): IngredientReportPayloadV1['how_to_use'] {
  const rule = asObject(params.profile?.suitability_rule);
  const pairWell = uniq(asStringArray(rule?.pairing_recommended ?? [], 6), 6);
  const separating = uniq(asStringArray(rule?.pairing_conflicts ?? [], 6), 6);
  const notes = uniq(asStringArray(rule?.safety_notes ?? [], 4), 4);

  if (params.category === 'peptide') {
    const rawFrequency = mapFrequency(asString(rule?.frequency));
    return {
      frequency: rawFrequency === 'unknown' ? 'daily' : rawFrequency,
      routine_step: 'serum',
      pair_well: pairWell.length ? pairWell : ['niacinamide', 'hyaluronic_acid', 'moisturizer'],
      consider_separating: separating.length ? separating : ['strong_acids', 'low_pH_vitamin_c'],
      notes: notes.length
        ? notes
        : [
            isZhLocale(params.locale)
              ? '建议先做局部测试，效果与刺激感受会因配方和浓度而异。'
              : 'Patch test first; performance and tolerance vary by formulation and concentration.',
          ],
    };
  }

  return {
    frequency: mapFrequency(asString(rule?.frequency)) || 'unknown',
    routine_step: 'unknown',
    pair_well: pairWell,
    consider_separating: separating,
    notes: notes.length
      ? notes
      : [
          isZhLocale(params.locale)
            ? '证据有限，建议从低频开始并观察反应。'
            : 'Evidence is limited; start low-frequency and monitor response.',
        ],
  };
}

function normalizeSearchHits(structured: Record<string, unknown> | null): IngredientSearchHit[] {
  const ingredientSearch = asObject(structured?.ingredient_search);
  return asArray(ingredientSearch?.hits)
    .map((item) => asObject(item))
    .filter(Boolean)
    .map((item) => ({
      product_id: asString(item.product_id),
      display_name: asString(item.display_name),
      matched_terms: asStringArray(item.matched_terms, 20),
      score: asNumber(item.score) ?? 0,
    }))
    .filter((item) => Boolean(item.product_id));
}

function isExactIngredientHit(hit: IngredientSearchHit, targetKeys: string[]): boolean {
  const hitTerms = hit.matched_terms.map((t) => normalizeKey(t));
  const nameKey = normalizeKey(hit.display_name);
  const genericTokenSet = new Set(PEPTIDE_KEYWORDS.map((kw) => normalizeKey(kw)));
  return targetKeys.some((target) => {
    if (!target) return false;
    if (
      hitTerms.some((term) => {
        if (!term) return false;
        if (term === target) return true;
        if (genericTokenSet.has(term)) return false;
        return (term.length >= 8 && term.includes(target)) || (target.length >= 8 && target.includes(term));
      })
    ) return true;
    return Boolean(nameKey && (nameKey.includes(target) || target.includes(nameKey)));
  });
}

function isCategoryHit(hit: IngredientSearchHit, category: string): boolean {
  if (category !== 'peptide') return false;
  const text = [hit.display_name, ...hit.matched_terms].map((x) => asString(x).toLowerCase()).join(' ');
  return PEPTIDE_KEYWORDS.some((kw) => text.includes(kw));
}

function selectProductsFromKb(params: {
  hits: IngredientSearchHit[];
  targetIngredient: string;
  aliases: string[];
  category: string;
  min: number;
  max: number;
}): string[] {
  const hits = [...params.hits].sort((a, b) => b.score - a.score);
  const targetKeys = uniq([params.targetIngredient, ...params.aliases].map((v) => normalizeKey(v)), 12);

  const exact = hits.filter((hit) => isExactIngredientHit(hit, targetKeys));
  const category = hits.filter((hit) => !exact.includes(hit) && isCategoryHit(hit, params.category));
  const others = hits.filter((hit) => !exact.includes(hit) && !category.includes(hit));

  const selected = uniq(
    [...exact, ...category, ...others].map((hit) => hit.product_id),
    params.max,
  );

  if (selected.length >= params.min) return selected.slice(0, params.max);
  return selected.slice(0, params.max);
}

function normalizeCitation(input: unknown): ExternalCitation | null {
  if (typeof input === 'string') {
    const title = input.trim();
    if (!title) return null;
    return {
      title,
      source: null,
      year: null,
      url: '',
      note: null,
      abstract: null,
      keywords: [],
    };
  }

  const obj = asObject(input);
  if (!obj) return null;

  const title = asString(obj.title);
  if (!title) return null;

  return {
    title,
    source: asString(obj.source) || null,
    year: asNumber(obj.year) == null ? null : Math.round(asNumber(obj.year) as number),
    url: asString(obj.url),
    note: asString(obj.note) || null,
    abstract: asString((obj as any).abstract) || null,
    keywords: asStringArray((obj as any).keywords ?? [], 10),
  };
}

function citationRelevance(params: {
  citation: ExternalCitation;
  ingredient: string;
  aliases: string[];
}): CitationRelevance {
  const ingredientKeys = uniq([params.ingredient, ...params.aliases].map((x) => normalizeKey(x)), 12).filter(Boolean);
  const searchable = [
    normalizeKey(params.citation.title),
    normalizeKey(params.citation.note),
    normalizeKey(params.citation.abstract),
    ...params.citation.keywords.map((k) => normalizeKey(k)),
  ]
    .filter(Boolean)
    .join(' ');

  if (ingredientKeys.some((k) => searchable.includes(k))) return 'strong';

  const hasCategory = PEPTIDE_KEYWORDS.some((kw) => searchable.includes(kw));
  const hasSkinAging = SKIN_AGING_KEYWORDS.some((kw) => searchable.includes(normalizeKey(kw)));
  if (hasCategory && hasSkinAging) return 'category';

  return 'weak';
}

function buildEvidence(params: {
  locale: IngredientReportLocale;
  structured: Record<string, unknown> | null;
  ingredient: InciResolution;
  profileMatched: boolean;
  category: string;
}): IngredientReportPayloadV1['evidence'] {
  const ext = asObject(params.structured?.external_verification);
  const rawCitations = asArray(ext?.citations);

  const normalized = rawCitations
    .map((item) => normalizeCitation(item))
    .filter(Boolean) as ExternalCitation[];

  const withRelevance = normalized.map((citation) => ({
    title: citation.title,
    url: citation.url,
    year: citation.year,
    source: citation.source,
    relevance: citationRelevance({ citation, ingredient: params.ingredient.inci, aliases: params.ingredient.aliases }),
  }));

  const filtered = withRelevance
    .filter((item) => item.relevance === 'strong' || item.relevance === 'category')
    .sort((a, b) => {
      const rank = (x: CitationRelevance) => (x === 'strong' ? 0 : x === 'category' ? 1 : 2);
      if (rank(a.relevance) !== rank(b.relevance)) return rank(a.relevance) - rank(b.relevance);
      const yearA = a.year ?? 0;
      const yearB = b.year ?? 0;
      return yearB - yearA;
    })
    .slice(0, 4);

  const strongCount = filtered.filter((item) => item.relevance === 'strong').length;
  const categoryCount = filtered.filter((item) => item.relevance === 'category').length;

  const summary = !params.profileMatched
    ? isZhLocale(params.locale)
      ? `该成分专属证据缺失，以下结论主要基于${params.category === 'peptide' ? '肽类' : '同类成分'}总体证据。`
      : `Ingredient-specific evidence is missing; conclusions below mainly rely on ${params.category === 'peptide' ? 'peptide-category' : 'category-level'} evidence.`
    : strongCount === 0 && categoryCount > 0
      ? isZhLocale(params.locale)
        ? '当前未检索到该成分强相关引用；以下来源为同类证据。'
        : 'No strong ingredient-specific citations were found; references below are category-level evidence.'
      : strongCount > 0
        ? isZhLocale(params.locale)
          ? '该成分有一定研究支持，但效果与刺激风险仍取决于具体配方与浓度。'
          : 'This ingredient has some research support, but outcomes and tolerability still depend on formulation and concentration.'
        : isZhLocale(params.locale)
          ? '暂无可默认展示的高相关引用，以下结论保持保守。'
          : 'No high-relevance citations are available for default display; conclusions remain conservative.';

  return {
    summary,
    citations: filtered,
    show_citations_by_default: false,
  };
}

function inferIrritationRisk(watchouts: IngredientReportPayloadV1['watchouts']): IngredientRiskLevel {
  const irritation = watchouts.find((item) => item.issue === 'irritation');
  if (!irritation) return 'unknown';
  if (irritation.likelihood === 'common') return 'medium';
  if (irritation.likelihood === 'uncommon' || irritation.likelihood === 'rare') return 'low';
  return 'unknown';
}

function inferTimeToResults(category: string, evidenceGrade: IngredientEvidenceGrade): IngredientTimeToResults {
  if (category !== 'peptide') return 'unknown';
  if (evidenceGrade === 'unknown') return 'unknown';
  if (evidenceGrade === 'A') return '2-4w';
  return '4-8w';
}

function inferTimeToResultsWithProfile(params: {
  category: string;
  evidenceGrade: IngredientEvidenceGrade;
  profileMatched: boolean;
}): IngredientTimeToResults {
  if (!params.profileMatched) return 'unknown';
  return inferTimeToResults(params.category, params.evidenceGrade);
}

function truncateText(value: string, maxChars: number): string {
  const clean = asString(value);
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function buildOneLiner(params: {
  locale: IngredientReportLocale;
  ingredient: InciResolution;
  evidenceGrade: IngredientEvidenceGrade;
  profileMatched: boolean;
  benefits: IngredientReportPayloadV1['benefits'];
}): string {
  if (params.ingredient.fromUnknown) {
    return isZhLocale(params.locale)
      ? '先确认具体 INCI 成分名，我再给你准确结论。'
      : 'Share the exact INCI name first, then I can give a precise verdict.';
  }

  if (!params.profileMatched || params.evidenceGrade === 'unknown') {
    const fallback = isZhLocale(params.locale)
      ? '偏温和的同类方向，但该成分专属证据仍不足。'
      : 'Likely useful by category, but ingredient-specific evidence is still limited.';
    return truncateText(fallback, isZhLocale(params.locale) ? 40 : 80);
  }

  const top = params.benefits[0]?.concern ?? 'texture';
  const label = concernLabel(top, params.locale);
  const confident = isZhLocale(params.locale)
    ? `可能改善${label}，整体更适合保守持续使用。`
    : `May support ${label}, with a generally conservative tolerability profile.`;
  return truncateText(confident, isZhLocale(params.locale) ? 40 : 80);
}

function computeConfidence(params: {
  ingredient: InciResolution;
  profileMatched: boolean;
  evidenceGrade: IngredientEvidenceGrade;
  evidence: IngredientReportPayloadV1['evidence'];
  selectedProducts: string[];
}): number {
  if (params.ingredient.fromUnknown) return 0.15;

  let score = 0.3;
  if (params.profileMatched) score += 0.35;
  if (params.evidenceGrade !== 'unknown') score += 0.1;

  const strongCount = params.evidence.citations.filter((c) => c.relevance === 'strong').length;
  const categoryCount = params.evidence.citations.filter((c) => c.relevance === 'category').length;
  score += Math.min(0.16, strongCount * 0.06 + categoryCount * 0.03);

  if (params.selectedProducts.length) score += Math.min(0.09, params.selectedProducts.length * 0.03);

  return Number(clamp01(score).toFixed(2));
}

function buildUseCases(params: {
  locale: IngredientReportLocale;
  category: string;
  selectedProducts: string[];
}): IngredientReportPayloadV1['use_cases'] {
  const title = isZhLocale(params.locale)
    ? params.category === 'peptide'
      ? '温和抗老与细纹管理'
      : '日常温和修护场景'
    : params.category === 'peptide'
      ? 'Gentle anti-aging for fine lines'
      : 'Daily gentle support scenario';

  const whoFor = isZhLocale(params.locale)
    ? '想做稳妥抗老、并能接受持续使用的人群'
    : 'People seeking conservative anti-aging support through consistent use';

  const routineTip = isZhLocale(params.locale)
    ? '先低频观察 1-2 周，再按耐受逐步增加频率。'
    : 'Start low-frequency for 1-2 weeks, then increase based on tolerance.';

  return [
    {
      title,
      who_for: whoFor,
      routine_tip: routineTip,
      products_from_kb: params.selectedProducts,
    },
  ];
}

function buildNextQuestions(locale: IngredientReportLocale): IngredientReportPayloadV1['next_questions'] {
  if (isZhLocale(locale)) {
    return [
      { id: 'goal', label: '你最优先的目标是？', chips: ['细纹/紧致', '敏感修护', '痘痘', '提亮'] },
      { id: 'sensitivity', label: '你的耐受度属于？', chips: ['敏感', '一般', '耐受'] },
    ];
  }

  return [
    { id: 'goal', label: 'What is your top goal?', chips: ['Fine lines/firmness', 'Sensitive repair', 'Acne', 'Brightening'] },
    { id: 'sensitivity', label: 'How sensitive is your skin?', chips: ['Sensitive', 'Normal', 'Resilient'] },
  ];
}

function isIngredientIntentText(text: string): boolean {
  const t = asString(text);
  if (!t) return false;
  return /(ingredient|inci|成分|肽|peptide|tripeptide|tetrapeptide|dipeptide)/i.test(t);
}

export function buildIngredientReportCard(existingResponse: IngredientReportBuildInput): IngredientReportCard | null {
  const structured = findStructuredPayload(existingResponse);
  if (!structured) return null;

  const parse = asObject(structured.parse);
  const normalizedQuery = asString(parse?.normalized_query);
  const rootQuery = asString(existingResponse.query);
  const locale = toLocale({
    requestLang: extractRequestLang(existingResponse, structured),
    currentUserMessageText: extractCurrentUserMessageText(existingResponse, structured),
    uiLocale: extractUiLocale(existingResponse, structured),
    parseLanguageTag: asString(parse?.normalized_query_language),
  });

  const ingredient = resolveInci({ structured, existingResponse });
  const profiles = collectProfiles(structured);
  const hits = normalizeSearchHits(structured);

  // Do not emit this card for general product evaluations/routines.
  const ingredientIntent = isIngredientIntentText(normalizedQuery) || isIngredientIntentText(rootQuery);
  const hasIngredientData = profiles.length > 0 || hits.length > 0;
  if (!ingredientIntent && !hasIngredientData) return null;

  const profile = matchProfile(ingredient.inci, ingredient.aliases, profiles);
  const evidenceGrade = normalizeEvidenceGrade(profile?.evidence_grade);
  const category = inferCategory(ingredient.inci, profile, structured);

  const benefits = buildBenefits({
    locale,
    evidenceGrade,
    profile,
    category,
  });

  const watchouts = buildWatchouts({ locale, profile, category });
  const howToUse = buildHowToUse({ locale, profile, category });

  const selectedProducts = selectProductsFromKb({
    hits,
    targetIngredient: ingredient.inci,
    aliases: ingredient.aliases,
    category,
    min: 3,
    max: 6,
  });

  const evidence = buildEvidence({
    locale,
    structured,
    ingredient,
    profileMatched: Boolean(profile),
    category,
  });

  const verdict = {
    one_liner: buildOneLiner({ locale, ingredient, evidenceGrade, profileMatched: Boolean(profile), benefits }),
    top_benefits: benefits.map((item) => item.concern).slice(0, 3),
    evidence_grade: evidenceGrade,
    irritation_risk: inferIrritationRisk(watchouts),
    time_to_results: inferTimeToResultsWithProfile({ category, evidenceGrade, profileMatched: Boolean(profile) }),
    confidence: computeConfidence({
      ingredient,
      profileMatched: Boolean(profile),
      evidenceGrade,
      evidence,
      selectedProducts,
    }),
  } as const;

  const payload: IngredientReportPayloadV1 = {
    schema_version: 'aurora.ingredient_report.v1',
    locale,
    ingredient: {
      inci: ingredient.inci,
      display_name: ingredient.display_name,
      aliases: ingredient.aliases,
      ...(ingredient.aliasSource ? { alias_source: ingredient.aliasSource } : {}),
      category,
    },
    verdict,
    benefits,
    how_to_use: howToUse,
    watchouts,
    use_cases: buildUseCases({ locale, category, selectedProducts }),
    evidence,
    next_questions: buildNextQuestions(locale),
  };

  return {
    card_id: `ingredient_report_${normalizeKey(ingredient.inci).replace(/\s+/g, '_') || 'unknown'}`,
    type: 'aurora_ingredient_report',
    payload,
  };
}

export function buildIngredientReportAssistantMessage(params: {
  locale: IngredientReportLocale;
  ingredientInci: string;
}): string {
  if (params.ingredientInci === 'unknown') {
    return isZhLocale(params.locale)
      ? '我可以做 1 分钟成分报告。请先告诉我具体 INCI 成分名是哪个？'
      : 'I can build a 1-minute ingredient report. Which exact INCI ingredient should I analyze?';
  }

  return isZhLocale(params.locale)
    ? '我把这个成分整理成了 1 分钟报告：**功效、用法、风险、以及相似产品案例**都在下方卡片👇'
    : 'I turned this ingredient into a 1-minute report: benefits, usage, risks, and product examples are in the card below.';
}

export function augmentEnvelopeWithIngredientReport(existingResponse: V1Envelope): V1Envelope {
  if (!existingResponse || !Array.isArray(existingResponse.cards)) return existingResponse;

  const hasReportAlready = existingResponse.cards.some((card) => normalizeType((card as any)?.type) === 'aurora_ingredient_report');
  if (hasReportAlready) return existingResponse;

  const card = buildIngredientReportCard(existingResponse);
  if (!card) return existingResponse;

  const structured = findStructuredPayload(existingResponse);
  const parse = asObject(structured?.parse);
  const locale = toLocale({
    requestLang: extractRequestLang(existingResponse, structured),
    currentUserMessageText: extractCurrentUserMessageText(existingResponse, structured),
    uiLocale: extractUiLocale(existingResponse, structured),
    parseLanguageTag: asString(parse?.normalized_query_language),
  });

  const assistantContent = buildIngredientReportAssistantMessage({
    locale,
    ingredientInci: card.payload.ingredient.inci,
  });

  const nextCards = [...existingResponse.cards];
  const structuredIndex = nextCards.findIndex((item) => normalizeType((item as any)?.type) === 'aurora_structured');
  const insertAt = structuredIndex >= 0 ? structuredIndex : 0;
  nextCards.splice(insertAt, 0, card);

  return {
    ...existingResponse,
    assistant_message: {
      role: 'assistant',
      format: 'markdown',
      content: assistantContent,
    },
    cards: nextCards,
  };
}
