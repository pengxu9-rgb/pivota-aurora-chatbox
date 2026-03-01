import type { Language as UiLanguage } from '@/lib/types';
import type { IngredientReportPayloadV1 } from '@/lib/ingredientReportCard';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown, max = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    const text = asString(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function normalizePayload(raw: unknown): IngredientReportPayloadV1 | null {
  const obj = isPlainObject(raw) ? raw : null;
  if (!obj) return null;
  const schemaVersion = asString(obj.schema_version);
  if (schemaVersion !== 'aurora.ingredient_report.v1' && schemaVersion !== 'aurora.ingredient_report.v2-lite') return null;

  const ingredient = isPlainObject(obj.ingredient) ? obj.ingredient : {};
  const verdict = isPlainObject(obj.verdict) ? obj.verdict : {};
  const howToUse = isPlainObject((obj as any).how_to_use) ? (obj as any).how_to_use : {};
  const evidence = isPlainObject(obj.evidence) ? obj.evidence : {};

  const payload: IngredientReportPayloadV1 = {
    schema_version: schemaVersion as IngredientReportPayloadV1['schema_version'],
    locale: asString(obj.locale).toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US',
    ingredient: {
      inci: asString(ingredient.inci) || asString((obj as any).normalized_query) || '-',
      display_name: asString(ingredient.display_name) || asString(ingredient.inci) || asString((obj as any).normalized_query) || '-',
      aliases: asStringArray(ingredient.aliases, 8),
      category: asString(ingredient.category) || '-',
    },
    verdict: {
      one_liner: asString(verdict.one_liner),
      top_benefits: asStringArray(verdict.top_benefits, 4),
      evidence_grade: (['A', 'B', 'C'].includes(asString(verdict.evidence_grade))
        ? asString(verdict.evidence_grade)
        : null) as IngredientReportPayloadV1['verdict']['evidence_grade'],
      irritation_risk: (['low', 'medium', 'high'].includes(asString(verdict.irritation_risk))
        ? asString(verdict.irritation_risk)
        : null) as IngredientReportPayloadV1['verdict']['irritation_risk'],
      time_to_results: (['2-4w', '4-8w', '8-12w'].includes(asString(verdict.time_to_results))
        ? asString(verdict.time_to_results)
        : null) as IngredientReportPayloadV1['verdict']['time_to_results'],
      confidence:
        typeof verdict.confidence === 'number' && Number.isFinite(verdict.confidence)
          ? Math.max(0, Math.min(1, verdict.confidence))
          : null,
      confidence_level: (['low', 'medium', 'high'].includes(asString((verdict as any).confidence_level))
        ? asString((verdict as any).confidence_level)
        : undefined) as IngredientReportPayloadV1['verdict']['confidence_level'],
    },
    benefits: asArray(obj.benefits)
      .map((item) => (isPlainObject(item) ? item : null))
      .filter(Boolean)
      .map((item) => ({
        concern: asString((item as any).concern) || '-',
        strength: Math.max(0, Math.min(3, Number((item as any).strength) || 0)) as 0 | 1 | 2 | 3,
        what_it_means: asString((item as any).what_it_means),
      }))
      .slice(0, 6),
    how_to_use: {
      frequency: asString(howToUse.frequency) || null,
      routine_step: asString(howToUse.routine_step) || null,
      pair_well: asStringArray(howToUse.pair_well, 8),
      consider_separating: asStringArray(howToUse.consider_separating, 8),
      notes: asStringArray(howToUse.notes, 6),
    },
    watchouts: asArray(obj.watchouts)
      .map((item) => (isPlainObject(item) ? item : null))
      .filter(Boolean)
      .map((item) => ({
        issue: asString((item as any).issue) || '-',
        likelihood: (['uncommon', 'common', 'rare'].includes(asString((item as any).likelihood))
          ? asString((item as any).likelihood)
          : null) as IngredientReportPayloadV1['watchouts'][number]['likelihood'],
        what_to_do: asString((item as any).what_to_do),
      }))
      .slice(0, 6),
    use_cases: asArray(obj.use_cases)
      .map((item) => (isPlainObject(item) ? item : null))
      .filter(Boolean)
      .map((item) => ({
        title: asString((item as any).title),
        who_for: asString((item as any).who_for),
        routine_tip: asString((item as any).routine_tip),
        products_from_kb: asStringArray((item as any).products_from_kb, 8),
      }))
      .slice(0, 4),
    evidence: {
      summary: asString(evidence.summary),
      citations: asArray(evidence.citations)
        .map((item) => (isPlainObject(item) ? item : null))
        .filter(Boolean)
        .map((item) => ({
          title: asString((item as any).title),
          url: asString((item as any).url),
          year: typeof (item as any).year === 'number' ? Math.round((item as any).year) : null,
          source: asString((item as any).source) || null,
          relevance: (['strong', 'category', 'weak'].includes(asString((item as any).relevance))
            ? asString((item as any).relevance)
            : null) as IngredientReportPayloadV1['evidence']['citations'][number]['relevance'],
        }))
        .slice(0, 8),
      show_citations_by_default: asString((evidence as any).show_citations_by_default).toLowerCase() === 'true',
    },
    next_questions: asArray((obj as any).next_questions)
      .map((item) => (isPlainObject(item) ? item : null))
      .filter(Boolean)
      .map((item) => ({
        id: asString((item as any).id) || 'q',
        label: asString((item as any).label),
        chips: asStringArray((item as any).chips, 8),
      }))
      .slice(0, 3),
    research_status: normalizeResearchStatus((obj as any).research_status),
    research_provider: (() => {
      const provider = asString((obj as any).research_provider).toLowerCase();
      if (provider === 'gemini' || provider === 'openai') return provider as 'gemini' | 'openai';
      return null;
    })(),
    research_attempts: asArray((obj as any).research_attempts)
      .map((item) => (isPlainObject(item) ? item : null))
      .filter(Boolean)
      .map((item) => ({
        provider: asString((item as any).provider) || 'unknown',
        outcome: asString((item as any).outcome) || 'unknown',
        reason_code: asString((item as any).reason_code) || 'unknown',
      }))
      .slice(0, 3),
    research_error_code: asString((obj as any).research_error_code) || undefined,
    top_products: ((): IngredientReportPayloadV1['top_products'] => {
      const direct = asArray((obj as any).top_products)
        .map((item) => (isPlainObject(item) ? item : null))
        .filter(Boolean)
        .map((item) => ({
          name: asString((item as any).name) || '-',
          brand: asString((item as any).brand) || undefined,
          category: asString((item as any).category) || undefined,
          price_tier: asString((item as any).price_tier) || undefined,
          why: asString((item as any).why) || undefined,
          pdp_url: asString((item as any).pdp_url) || undefined,
        }))
        .slice(0, 6);
      if (direct.length) return direct;
      const tiersObj = isPlainObject((obj as any).top_products_tiers)
        ? (obj as any).top_products_tiers
        : isPlainObject((obj as any).top_products)
          ? (obj as any).top_products
          : null;
      if (!tiersObj) return [];
      const tierRows: Array<{ key: string; value: unknown }> = [
        { key: 'budget', value: (tiersObj as any).budget },
        { key: 'mid', value: (tiersObj as any).mid },
        { key: 'premium', value: (tiersObj as any).premium },
      ];
      return tierRows
        .flatMap((tier) =>
          asStringArray(tier.value, 4).map((name) => ({
            name: name || '-',
            price_tier: tier.key,
          })),
        )
        .slice(0, 6);
    })(),
    updated_at_ms: (() => {
      const n = Number((obj as any).updated_at_ms);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
    normalized_query: asString((obj as any).normalized_query) || null,
    route_decision_reasons: asStringArray((obj as any).route_decision_reasons, 12),
    route_rule_version: asString((obj as any).route_rule_version) || null,
    kb_revision: asString((obj as any).kb_revision) || null,
    provider_model_tier: asString((obj as any).provider_model_tier) || null,
    provider_circuit_state: asString((obj as any).provider_circuit_state) || null,
    personalized_fit: (() => {
      const fit = isPlainObject((obj as any).personalized_fit) ? (obj as any).personalized_fit : null;
      if (!fit) return undefined;
      const summary = asString((fit as any).summary);
      const adjustments = asStringArray((fit as any).adjustments, 8);
      const warnings = asStringArray((fit as any).warnings, 8);
      if (!summary && adjustments.length === 0 && warnings.length === 0) return undefined;
      return {
        ...(summary ? { summary } : {}),
        ...(adjustments.length ? { adjustments } : {}),
        ...(warnings.length ? { warnings } : {}),
      };
    })(),
  };

  return payload;
}

function zh(language: UiLanguage): boolean {
  return language === 'CN';
}

function humanizeConcern(concern: string, language: UiLanguage): string {
  const key = asString(concern).toLowerCase();
  const mapCN: Record<string, string> = {
    'fine-lines': '细纹',
    firmness: '紧致',
    texture: '肤质平滑',
    brightening: '提亮',
    hydration: '保湿',
    'barrier-support': '屏障支持',
    acne: '痘痘/毛孔',
  };
  const mapEN: Record<string, string> = {
    'fine-lines': 'Fine lines',
    firmness: 'Firmness',
    texture: 'Texture',
    brightening: 'Brightening',
    hydration: 'Hydration',
    'barrier-support': 'Barrier support',
    acne: 'Acne/pores',
  };
  if (zh(language)) return mapCN[key] ?? concern;
  return mapEN[key] ?? concern;
}

function chipTone(relevance: string): string {
  if (relevance === 'strong') return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  if (relevance === 'category') return 'border-sky-300 bg-sky-50 text-sky-700';
  return 'border-border/60 bg-muted/60 text-muted-foreground';
}

function normalizeResearchStatus(value: unknown): 'ready' | 'fallback' | 'disabled' | 'provider_unavailable' | 'queued' | 'error' | 'none' {
  const token = asString(value).toLowerCase();
  if (
    token === 'ready' ||
    token === 'fallback' ||
    token === 'disabled' ||
    token === 'provider_unavailable' ||
    token === 'queued' ||
    token === 'error' ||
    token === 'none'
  ) {
    return token;
  }
  return 'none';
}

function formatUpdatedAt(value: number | null, language: UiLanguage): string {
  if (!Number.isFinite(value || NaN) || !value || value <= 0) return '';
  try {
    const locale = language === 'CN' ? 'zh-CN' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

export type IngredientReportQuestionSelection = {
  questionId: string;
  chip: string;
};

type IngredientReportCardProps = {
  payload: unknown;
  language: UiLanguage;
  showNextQuestions?: boolean;
  hiddenQuestionIds?: string[];
  nextQuestionBusy?: boolean;
  onSelectNextQuestion?: (selection: IngredientReportQuestionSelection) => void;
  onOpenProfile?: () => void;
  onAction?: (actionId: string, data?: Record<string, any>) => void;
};

export function IngredientReportCard({
  payload: rawPayload,
  language,
  showNextQuestions = true,
  hiddenQuestionIds = [],
  nextQuestionBusy = false,
  onSelectNextQuestion,
  onOpenProfile,
  onAction,
}: IngredientReportCardProps) {
  const payload = normalizePayload(rawPayload);

  if (!payload) {
    return (
      <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
        {zh(language) ? '成分报告卡片数据不可用。' : 'Ingredient report payload is unavailable.'}
      </div>
    );
  }

  const confidencePct =
    typeof payload.verdict.confidence === 'number' && Number.isFinite(payload.verdict.confidence)
      ? `${Math.round(Math.max(0, Math.min(1, payload.verdict.confidence)) * 100)}%`
      : zh(language)
        ? '信息不足'
        : 'Insufficient';
  const hiddenSet = new Set(hiddenQuestionIds.map((id) => asString(id)).filter(Boolean));
  const visibleQuestions = payload.next_questions.filter((q) => !hiddenSet.has(q.id));
  const updatedAtText = formatUpdatedAt(payload.updated_at_ms ?? null, language);
  const researchStatusLabel = (() => {
    if (payload.research_status === 'ready') return zh(language) ? '研究完成' : 'Research ready';
    if (payload.research_status === 'queued') return zh(language) ? '研究排队中' : 'Research queued';
    if (payload.research_status === 'fallback') return zh(language) ? '基础结果' : 'Fallback result';
    if (payload.research_status === 'provider_unavailable') return zh(language) ? '研究服务不可用' : 'Provider unavailable';
    if (payload.research_status === 'error') return zh(language) ? '研究失败' : 'Research failed';
    if (payload.research_status === 'disabled') return zh(language) ? '研究关闭' : 'Research disabled';
    return zh(language) ? '快速结果' : 'Quick result';
  })();
  const fallbackErrorLabel = (() => {
    const code = asString(payload.research_error_code).toLowerCase();
    if (!code) return zh(language) ? '暂时不可用' : 'Temporarily unavailable';
    const mappingCN: Record<string, string> = {
      gemini_invalid_json: '模型返回格式异常',
      gemini_timeout: '模型超时',
      gemini_rate_limited: '请求速率受限',
      gemini_auth: '模型鉴权失败',
      gemini_upstream_5xx: '模型服务不稳定',
      gemini_network: '网络波动',
      provider_unavailable: '研究服务不可用',
      kb_only_mode: '仅知识库模式',
      circuit_open: '熔断保护中',
    };
    const mappingEN: Record<string, string> = {
      gemini_invalid_json: 'Model response format issue',
      gemini_timeout: 'Model timeout',
      gemini_rate_limited: 'Rate limited',
      gemini_auth: 'Model auth failure',
      gemini_upstream_5xx: 'Model upstream instability',
      gemini_network: 'Network transient issue',
      provider_unavailable: 'Provider unavailable',
      kb_only_mode: 'KB-only mode',
      circuit_open: 'Circuit breaker open',
    };
    return zh(language) ? mappingCN[code] || code : mappingEN[code] || code;
  })();
  const ingredientQueryForActions = payload.ingredient.display_name || payload.ingredient.inci || payload.normalized_query || '';

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium">
            {payload.ingredient.display_name}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {zh(language)
              ? `证据 ${payload.verdict.evidence_grade || '暂无'}`
              : `Evidence ${payload.verdict.evidence_grade || 'N/A'}`}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {zh(language)
              ? `刺激风险 ${payload.verdict.irritation_risk || '暂无'}`
              : `Irritation ${payload.verdict.irritation_risk || 'N/A'}`}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {zh(language)
              ? `起效 ${payload.verdict.time_to_results || '暂无'}`
              : `Timeline ${payload.verdict.time_to_results || 'N/A'}`}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {zh(language) ? `置信度 ${confidencePct}` : `Confidence ${confidencePct}`}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {researchStatusLabel}
          </span>
          {payload.research_provider ? (
            <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              {zh(language) ? `提供方 ${payload.research_provider}` : `Provider ${payload.research_provider}`}
            </span>
          ) : null}
        </div>

        <div className="text-sm font-semibold text-foreground">{payload.verdict.one_liner}</div>

        {updatedAtText ? (
          <div className="text-xs text-muted-foreground">
            {zh(language) ? `更新于：${updatedAtText}` : `Updated: ${updatedAtText}`}
          </div>
        ) : null}

        {payload.ingredient.aliases.length ? (
          <div className="text-xs text-muted-foreground">
            {zh(language) ? '别名：' : 'Aliases: '}
            {payload.ingredient.aliases.join(' · ')}
          </div>
        ) : null}

        {payload.research_status === 'queued' ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
            <span>{zh(language) ? '当前为快速结果，增强证据生成中。' : 'Quick result now; enhanced evidence is generating.'}</span>
            {onAction ? (
              <button
                type="button"
                className="rounded-full border border-sky-300 bg-white px-2 py-1 text-[11px] text-sky-700"
                onClick={() =>
                  onAction('ingredient.research.poll', {
                    ingredient_query: ingredientQueryForActions,
                    normalized_query: payload.normalized_query || undefined,
                    entry_source: 'ingredient_report_card',
                  })
                }
              >
                {zh(language) ? '刷新增强结果' : 'Refresh enhanced result'}
              </button>
            ) : null}
          </div>
        ) : null}

        {(payload.research_status === 'fallback' || payload.research_status === 'error' || payload.research_status === 'provider_unavailable') ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <span>
              {zh(language) ? '当前返回基础结果：' : 'Fallback result: '}
              {fallbackErrorLabel}
            </span>
            {onAction ? (
              <button
                type="button"
                className="rounded-full border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-700"
                onClick={() =>
                  onAction('ingredient.research.poll', {
                    ingredient_query: ingredientQueryForActions,
                    normalized_query: payload.normalized_query || undefined,
                    entry_source: 'ingredient_report_card',
                  })
                }
              >
                {zh(language) ? '重试' : 'Retry'}
              </button>
            ) : null}
            {onAction ? (
              <button
                type="button"
                className="rounded-full border border-amber-300 bg-white px-2 py-1 text-[11px] text-amber-700"
                onClick={() =>
                  onAction('ingredient.research.poll', {
                    ingredient_query: ingredientQueryForActions,
                    normalized_query: payload.normalized_query || undefined,
                    entry_source: 'ingredient_report_feedback',
                    feedback_type: 'ingredient_report_issue',
                    reason_code: payload.research_error_code || 'unknown',
                  })
                }
              >
                {zh(language) ? '反馈问题' : 'Report issue'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'Benefits' : 'Benefits'}</div>
        <div className="space-y-2">
          {payload.benefits.length ? (
            payload.benefits.slice(0, 4).map((item) => (
              <div key={`${item.concern}_${item.what_it_means}`} className="rounded-xl border border-border/60 bg-background/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{humanizeConcern(item.concern, language)}</span>
                  <span className="text-xs text-muted-foreground">{`S${item.strength}`}</span>
                </div>
                {item.what_it_means ? <div className="mt-1 text-xs text-muted-foreground">{item.what_it_means}</div> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-border/60 bg-background/60 p-2 text-xs text-muted-foreground">
              {zh(language) ? '暂无足够收益信息，已返回可读基础结果。' : 'Benefit details are limited for now; showing a readable baseline.'}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'How to use' : 'How to use'}</div>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            <li>{zh(language) ? '频率：' : 'Frequency: '}{payload.how_to_use.frequency || (zh(language) ? '暂无' : 'N/A')}</li>
            <li>{zh(language) ? '步骤：' : 'Step: '}{payload.how_to_use.routine_step || (zh(language) ? '暂无' : 'N/A')}</li>
            {payload.how_to_use.pair_well.length ? (
              <li>{zh(language) ? '可搭配：' : 'Pair well: '}{payload.how_to_use.pair_well.join(' · ')}</li>
            ) : null}
            {payload.how_to_use.consider_separating.length ? (
              <li>{zh(language) ? '建议错开：' : 'Consider separating: '}{payload.how_to_use.consider_separating.join(' · ')}</li>
            ) : null}
          </ul>
          {payload.how_to_use.notes.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {payload.how_to_use.notes.slice(0, 3).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'Watchouts' : 'Watchouts'}</div>
          {payload.watchouts.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
              {payload.watchouts.slice(0, 4).map((watch) => (
                <li key={`${watch.issue}_${watch.what_to_do}`}>
                  <span className="font-medium">{watch.issue}</span>
                  {watch.likelihood ? <span className="text-xs text-muted-foreground">{` (${watch.likelihood})`}</span> : null}
                  {watch.what_to_do ? <div className="text-xs text-muted-foreground">{watch.what_to_do}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">
              {zh(language) ? '暂无明确风险提示，建议先小范围测试并观察耐受。' : 'No specific watchouts yet; start low and monitor tolerance.'}
            </div>
          )}
        </div>
      </div>

      {payload.use_cases.length ? (
        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'Use cases' : 'Use cases'}</div>
          <div className="mt-2 space-y-2">
            {payload.use_cases.slice(0, 2).map((useCase) => (
              <div key={`${useCase.title}_${useCase.who_for}`} className="rounded-lg border border-border/50 bg-background/70 p-2">
                <div className="text-sm font-medium text-foreground">{useCase.title}</div>
                {useCase.who_for ? <div className="text-xs text-muted-foreground">{useCase.who_for}</div> : null}
                {useCase.routine_tip ? <div className="mt-1 text-xs text-muted-foreground">{useCase.routine_tip}</div> : null}
                {useCase.products_from_kb.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {useCase.products_from_kb.slice(0, 6).map((pid) => (
                      <span key={pid} className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
                        {pid}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {Array.isArray(payload.top_products) && payload.top_products.length ? (
        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? '相关产品（Top）' : 'Top related products'}</div>
          <div className="mt-2 space-y-2">
            {payload.top_products.slice(0, 5).map((item, idx) => (
              <div key={`${item.name}_${idx}`} className="rounded-lg border border-border/50 bg-background/70 p-2">
                <div className="text-sm font-medium text-foreground">{item.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {[item.brand, item.category, item.price_tier].filter(Boolean).join(' · ')}
                </div>
                {item.why ? <div className="mt-1 text-xs text-muted-foreground">{item.why}</div> : null}
                {item.pdp_url ? (
                  <a className="mt-1 inline-block break-all text-[11px] text-sky-600 underline" href={item.pdp_url} target="_blank" rel="noreferrer">
                    {item.pdp_url}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {payload.personalized_fit ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <div className="text-xs font-semibold text-emerald-800">{zh(language) ? '个性化匹配' : 'Personalized fit'}</div>
          {payload.personalized_fit.summary ? (
            <div className="mt-1 text-sm text-emerald-900">{payload.personalized_fit.summary}</div>
          ) : null}
          {Array.isArray(payload.personalized_fit.adjustments) && payload.personalized_fit.adjustments.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-emerald-900">
              {payload.personalized_fit.adjustments.slice(0, 4).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {Array.isArray(payload.personalized_fit.warnings) && payload.personalized_fit.warnings.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
              {payload.personalized_fit.warnings.slice(0, 3).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <details className="rounded-xl border border-border/60 bg-background/60 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
          {zh(language) ? 'Evidence / Citations（默认折叠）' : 'Evidence / Citations (collapsed by default)'}
        </summary>
        <div className="mt-2 space-y-2">
          {payload.evidence.summary ? <div className="text-sm text-foreground">{payload.evidence.summary}</div> : null}
          {payload.evidence.citations.length ? (
            <ul className="space-y-2 text-sm text-foreground">
              {payload.evidence.citations.slice(0, 6).map((citation) => (
                <li key={`${citation.title}_${citation.url}`} className="rounded-lg border border-border/50 bg-background/70 p-2">
                  {(() => {
                    const relevance = citation.relevance || 'weak';
                    return (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${chipTone(relevance)}`}>{relevance}</span>
                    {citation.year != null ? (
                      <span className="text-[11px] text-muted-foreground">{citation.year}</span>
                    ) : null}
                    {citation.source ? <span className="text-[11px] text-muted-foreground">{citation.source}</span> : null}
                  </div>
                    );
                  })()}
                  <div className="mt-1 text-xs text-foreground">{citation.title}</div>
                  {citation.url ? (
                    <a className="mt-1 inline-block break-all text-[11px] text-sky-600 underline" href={citation.url} target="_blank" rel="noreferrer">
                      {citation.url}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground">
              {zh(language) ? '当前没有可默认展示的高相关来源。' : 'No high-relevance citations available for default display.'}
            </div>
          )}
        </div>
      </details>

      {visibleQuestions.length && showNextQuestions ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'Next questions' : 'Next questions'}</div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-2 text-xs text-muted-foreground">
            {zh(language)
              ? '补充你的目标和皮肤耐受后，我会更准确评估这个成分与你肤况的适用性/匹配度。'
              : 'Add your goal and sensitivity, and I can score ingredient suitability/match for your skin more accurately.'}
            {onOpenProfile ? (
              <button
                type="button"
                className="ml-2 inline-flex items-center rounded-full border border-border/60 bg-muted/70 px-2 py-1 text-[11px] text-foreground"
                onClick={onOpenProfile}
                disabled={nextQuestionBusy}
              >
                {zh(language) ? '完善肤况' : 'Complete profile'}
              </button>
            ) : null}
          </div>
          <div className="space-y-2">
            {visibleQuestions.slice(0, 2).map((q) => (
              <div key={q.id} className="rounded-xl border border-border/60 bg-background/60 p-2">
                <div className="text-xs text-muted-foreground">{q.label}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {q.chips.slice(0, 6).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                      disabled={nextQuestionBusy || !onSelectNextQuestion}
                      onClick={() => onSelectNextQuestion?.({ questionId: q.id, chip })}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {payload.next_questions.length && (!showNextQuestions || !visibleQuestions.length) ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-800">
          {zh(language)
            ? '已记录你的目标与皮肤耐受，后续会优先按成分适配度给建议。'
            : 'Saved your goal and sensitivity. Next ingredient guidance will prioritize skin-fit relevance.'}
        </div>
      ) : null}
    </div>
  );
}
