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
  const topProducts = isPlainObject((obj as any).top_products) ? (obj as any).top_products : {};
  const researchStatus = asString((obj as any).research_status).toLowerCase();
  const usage = isPlainObject((obj as any).usage) ? (obj as any).usage : {};
  const routeDecisionReasons = asStringArray((obj as any).route_decision_reasons, 12);
  const researchAttempts = asArray((obj as any).research_attempts)
    .map((item) => (isPlainObject(item) ? item : null))
    .filter(Boolean)
    .map((item) => ({
      provider: asString((item as any).provider) || 'gemini',
      outcome: asString((item as any).outcome) || 'unknown',
      ...(asString((item as any).reason_code) ? { reason_code: asString((item as any).reason_code) } : {}),
    }))
    .slice(0, 3);

  const payload: IngredientReportPayloadV1 = {
    schema_version: schemaVersion as IngredientReportPayloadV1['schema_version'],
    locale: asString(obj.locale).toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US',
    ...(researchStatus === 'none' || researchStatus === 'queued' || researchStatus === 'ready' || researchStatus === 'error' || researchStatus === 'skipped' || researchStatus === 'fallback'
      ? { research_status: researchStatus as IngredientReportPayloadV1['research_status'] }
      : {}),
    ...(asString((obj as any).research_provider) ? { research_provider: asString((obj as any).research_provider) } : {}),
    ...(asString((obj as any).research_error_code) ? { research_error_code: asString((obj as any).research_error_code) } : {}),
    ...(asString((obj as any).normalized_query) ? { normalized_query: asString((obj as any).normalized_query) } : {}),
    ...(routeDecisionReasons.length ? { route_decision_reasons: routeDecisionReasons } : {}),
    ...(asString((obj as any).route_rule_version) ? { route_rule_version: asString((obj as any).route_rule_version) } : {}),
    ...(asString((obj as any).kb_revision) ? { kb_revision: asString((obj as any).kb_revision) } : {}),
    ...(asString((obj as any).provider_model_tier) ? { provider_model_tier: asString((obj as any).provider_model_tier) } : {}),
    ...(asString((obj as any).provider_circuit_state) ? { provider_circuit_state: asString((obj as any).provider_circuit_state) } : {}),
    ...(researchAttempts.length ? { research_attempts: researchAttempts } : {}),
    ...(asString((obj as any).confidence) ? { confidence: asString((obj as any).confidence) as IngredientReportPayloadV1['confidence'] } : {}),
    ingredient: {
      inci: asString(ingredient.inci) || 'N/A',
      display_name: asString(ingredient.display_name) || asString(ingredient.inci) || 'N/A',
      aliases: asStringArray(ingredient.aliases, 8),
      ...(asString((ingredient as any).what_it_is) ? { what_it_is: asString((ingredient as any).what_it_is) } : {}),
      category: asString(ingredient.category) || 'unknown',
    },
    verdict: {
      one_liner: asString(verdict.one_liner),
      top_benefits: asStringArray(verdict.top_benefits, 4),
      evidence_grade: (['A', 'B', 'C', 'unknown'].includes(asString(verdict.evidence_grade))
        ? asString(verdict.evidence_grade)
        : 'unknown') as IngredientReportPayloadV1['verdict']['evidence_grade'],
      irritation_risk: (['low', 'medium', 'high', 'unknown'].includes(asString(verdict.irritation_risk))
        ? asString(verdict.irritation_risk)
        : 'unknown') as IngredientReportPayloadV1['verdict']['irritation_risk'],
      time_to_results: (['2-4w', '4-8w', '8-12w', 'unknown'].includes(asString(verdict.time_to_results))
        ? asString(verdict.time_to_results)
        : 'unknown') as IngredientReportPayloadV1['verdict']['time_to_results'],
      confidence:
        typeof verdict.confidence === 'number' && Number.isFinite(verdict.confidence)
          ? Math.max(0, Math.min(1, verdict.confidence))
          : 0,
      ...(asString((verdict as any).confidence_level)
        ? { confidence_level: asString((verdict as any).confidence_level) as IngredientReportPayloadV1['verdict']['confidence_level'] }
        : {}),
    },
    usage: {
      time: asString((usage as any).time) || 'Both',
      frequency: asString((usage as any).frequency) || null,
      avoid: asStringArray((usage as any).avoid, 8),
    },
    benefits: asArray(obj.benefits)
      .map((item) => (isPlainObject(item) ? item : null))
      .filter(Boolean)
      .map((item) => ({
        concern: asString((item as any).concern) || 'unknown',
        strength: Math.max(0, Math.min(3, Number((item as any).strength) || 0)) as 0 | 1 | 2 | 3,
        what_it_means: asString((item as any).what_it_means),
      }))
      .slice(0, 6),
    how_to_use: {
      frequency: (['daily', '3-4x/week', 'unknown'].includes(asString(howToUse.frequency))
        ? asString(howToUse.frequency)
        : 'unknown') as IngredientReportPayloadV1['how_to_use']['frequency'],
      routine_step: (['serum', 'cream', 'cleanser', 'toner', 'sunscreen', 'unknown'].includes(asString(howToUse.routine_step))
        ? asString(howToUse.routine_step)
        : 'unknown') as IngredientReportPayloadV1['how_to_use']['routine_step'],
      pair_well: asStringArray(howToUse.pair_well, 8),
      consider_separating: asStringArray(howToUse.consider_separating, 8),
      notes: asStringArray(howToUse.notes, 6),
    },
    watchouts: asArray(obj.watchouts)
      .map((item) => (isPlainObject(item) ? item : null))
      .filter(Boolean)
      .map((item) => ({
        issue: asString((item as any).issue) || 'unknown',
        likelihood: (['uncommon', 'common', 'rare', 'unknown'].includes(asString((item as any).likelihood))
          ? asString((item as any).likelihood)
          : 'unknown') as IngredientReportPayloadV1['watchouts'][number]['likelihood'],
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
    top_products: {
      budget: asStringArray(topProducts.budget, 10),
      mid: asStringArray(topProducts.mid, 10),
      premium: asStringArray(topProducts.premium, 10),
    },
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
            : 'weak') as IngredientReportPayloadV1['evidence']['citations'][number]['relevance'],
        }))
        .slice(0, 8),
      show_citations_by_default: Boolean(evidence.show_citations_by_default),
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

function researchStatusLabel(status: IngredientReportPayloadV1['research_status'], language: UiLanguage): string {
  if (status === 'ready') return zh(language) ? '深研已命中' : 'Deep research ready';
  if (status === 'queued') return zh(language) ? '深研排队中' : 'Deep research queued';
  if (status === 'fallback') return zh(language) ? '已降级为快速结果' : 'Fallback quick result';
  if (status === 'error') return zh(language) ? '深研暂不可用' : 'Deep research unavailable';
  if (status === 'skipped') return zh(language) ? '深研已跳过' : 'Deep research skipped';
  return zh(language) ? '快速简报' : 'Quick brief';
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
  onPollResearch?: (query: string) => void;
  onRetryResearch?: (query: string) => void;
};

export function IngredientReportCard({
  payload: rawPayload,
  language,
  showNextQuestions = true,
  hiddenQuestionIds = [],
  nextQuestionBusy = false,
  onSelectNextQuestion,
  onOpenProfile,
  onPollResearch,
  onRetryResearch,
}: IngredientReportCardProps) {
  const payload = normalizePayload(rawPayload);

  if (!payload) {
    return (
      <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
        {zh(language) ? '成分报告卡片数据不可用。' : 'Ingredient report payload is unavailable.'}
      </div>
    );
  }

  const confidencePct = `${Math.round(Math.max(0, Math.min(1, payload.verdict.confidence)) * 100)}%`;
  const effectiveQuery = asString(payload.normalized_query) || asString(payload.ingredient.inci) || asString(payload.ingredient.display_name);
  const hiddenSet = new Set(hiddenQuestionIds.map((id) => asString(id)).filter(Boolean));
  const visibleQuestions = payload.next_questions.filter((q) => !hiddenSet.has(q.id));

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium">
            {payload.ingredient.display_name}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {zh(language) ? `证据 ${payload.verdict.evidence_grade}` : `Evidence ${payload.verdict.evidence_grade}`}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {zh(language) ? `刺激风险 ${payload.verdict.irritation_risk}` : `Irritation ${payload.verdict.irritation_risk}`}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {zh(language) ? `起效 ${payload.verdict.time_to_results}` : `Timeline ${payload.verdict.time_to_results}`}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
            {zh(language) ? `置信度 ${confidencePct}` : `Confidence ${confidencePct}`}
          </span>
          {payload.research_status ? (
            <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
              {researchStatusLabel(payload.research_status, language)}
            </span>
          ) : null}
        </div>

        <div className="text-sm font-semibold text-foreground">{payload.verdict.one_liner}</div>
        {payload.research_status === 'queued' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {zh(language) ? '当前为快速结果，增强证据生成中。' : 'This is a quick result. Enhanced evidence is generating.'}
          </div>
        ) : null}
        {payload.research_status === 'fallback' || payload.research_status === 'error' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {zh(language)
              ? `增强研究暂不可用（${asString(payload.research_error_code) || 'fallback'}）。`
              : `Enhanced research is unavailable (${asString(payload.research_error_code) || 'fallback'}).`}
          </div>
        ) : null}

        {(payload.research_status === 'queued' || payload.research_status === 'fallback' || payload.research_status === 'error') && effectiveQuery ? (
          <div className="flex flex-wrap gap-2">
            {payload.research_status === 'queued' && onPollResearch ? (
              <button
                type="button"
                className="chip-button chip-button-compact"
                onClick={() => onPollResearch(effectiveQuery)}
              >
                {zh(language) ? '刷新增强结果' : 'Refresh enhanced result'}
              </button>
            ) : null}
            {(payload.research_status === 'fallback' || payload.research_status === 'error') && onRetryResearch ? (
              <button
                type="button"
                className="chip-button chip-button-compact"
                onClick={() => onRetryResearch(effectiveQuery)}
              >
                {zh(language) ? '重试研究' : 'Retry research'}
              </button>
            ) : null}
          </div>
        ) : null}

        {payload.ingredient.aliases.length ? (
          <div className="text-xs text-muted-foreground">
            {zh(language) ? '别名：' : 'Aliases: '}
            {payload.ingredient.aliases.join(' · ')}
          </div>
        ) : null}
        {asString(payload.ingredient.what_it_is) ? (
          <div className="text-xs text-muted-foreground">{payload.ingredient.what_it_is}</div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'Benefits' : 'Benefits'}</div>
        <div className="space-y-2">
          {payload.benefits.slice(0, 4).length ? (
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
              {zh(language) ? '暂无足够证据，建议稍后刷新增强结果。' : 'Insufficient evidence for now. Refresh later for enhanced details.'}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'How to use' : 'How to use'}</div>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            <li>{zh(language) ? '频率：' : 'Frequency: '}{payload.how_to_use.frequency}</li>
            <li>{zh(language) ? '步骤：' : 'Step: '}{payload.how_to_use.routine_step}</li>
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
          {payload.watchouts.slice(0, 4).length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
              {payload.watchouts.slice(0, 4).map((watch) => (
                <li key={`${watch.issue}_${watch.what_to_do}`}>
                  <span className="font-medium">{watch.issue}</span>
                  <span className="text-xs text-muted-foreground">{` (${watch.likelihood})`}</span>
                  {watch.what_to_do ? <div className="text-xs text-muted-foreground">{watch.what_to_do}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">
              {zh(language) ? '当前暂无额外注意点。' : 'No additional watchouts yet.'}
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

      {payload.top_products && (payload.top_products.budget.length || payload.top_products.mid.length || payload.top_products.premium.length) ? (
        <div className="rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="text-xs font-semibold text-muted-foreground">
            {zh(language) ? 'Top 产品（按价位）' : 'Top products by budget tier'}
          </div>
          <div className="mt-2 space-y-2 text-sm text-foreground">
            {payload.top_products.budget.length ? (
              <div>
                <div className="text-xs text-muted-foreground">{zh(language) ? 'Budget' : 'Budget'}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {payload.top_products.budget.slice(0, 4).map((name) => (
                    <span key={`budget_${name}`} className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px]">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {payload.top_products.mid.length ? (
              <div>
                <div className="text-xs text-muted-foreground">{zh(language) ? 'Mid' : 'Mid'}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {payload.top_products.mid.slice(0, 4).map((name) => (
                    <span key={`mid_${name}`} className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px]">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {payload.top_products.premium.length ? (
              <div>
                <div className="text-xs text-muted-foreground">{zh(language) ? 'Premium' : 'Premium'}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {payload.top_products.premium.slice(0, 4).map((name) => (
                    <span key={`premium_${name}`} className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px]">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${chipTone(citation.relevance)}`}>{citation.relevance}</span>
                    {citation.year != null ? (
                      <span className="text-[11px] text-muted-foreground">{citation.year}</span>
                    ) : null}
                    {citation.source ? <span className="text-[11px] text-muted-foreground">{citation.source}</span> : null}
                  </div>
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
