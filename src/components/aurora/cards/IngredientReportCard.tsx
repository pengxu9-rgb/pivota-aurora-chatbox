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
  if (asString(obj.schema_version) !== 'aurora.ingredient_report.v1') return null;

  const ingredient = isPlainObject(obj.ingredient) ? obj.ingredient : {};
  const verdict = isPlainObject(obj.verdict) ? obj.verdict : {};
  const howToUse = isPlainObject((obj as any).how_to_use) ? (obj as any).how_to_use : {};
  const evidence = isPlainObject(obj.evidence) ? obj.evidence : {};

  const payload: IngredientReportPayloadV1 = {
    schema_version: 'aurora.ingredient_report.v1',
    locale: asString(obj.locale).toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US',
    ingredient: {
      inci: asString(ingredient.inci) || 'unknown',
      display_name: asString(ingredient.display_name) || asString(ingredient.inci) || 'unknown',
      aliases: asStringArray(ingredient.aliases, 8),
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
      routine_step: (['serum', 'cream', 'unknown'].includes(asString(howToUse.routine_step))
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
      show_citations_by_default: false,
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

export function IngredientReportCard({ payload: rawPayload, language }: { payload: unknown; language: UiLanguage }) {
  const payload = normalizePayload(rawPayload);

  if (!payload) {
    return (
      <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
        {zh(language) ? '成分报告卡片数据不可用。' : 'Ingredient report payload is unavailable.'}
      </div>
    );
  }

  const confidencePct = `${Math.round(Math.max(0, Math.min(1, payload.verdict.confidence)) * 100)}%`;

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
        </div>

        <div className="text-sm font-semibold text-foreground">{payload.verdict.one_liner}</div>

        {payload.ingredient.aliases.length ? (
          <div className="text-xs text-muted-foreground">
            {zh(language) ? '别名：' : 'Aliases: '}
            {payload.ingredient.aliases.join(' · ')}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'Benefits' : 'Benefits'}</div>
        <div className="space-y-2">
          {payload.benefits.slice(0, 4).map((item) => (
            <div key={`${item.concern}_${item.what_it_means}`} className="rounded-xl border border-border/60 bg-background/60 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{humanizeConcern(item.concern, language)}</span>
                <span className="text-xs text-muted-foreground">{`S${item.strength}`}</span>
              </div>
              {item.what_it_means ? <div className="mt-1 text-xs text-muted-foreground">{item.what_it_means}</div> : null}
            </div>
          ))}
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
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
            {payload.watchouts.slice(0, 4).map((watch) => (
              <li key={`${watch.issue}_${watch.what_to_do}`}>
                <span className="font-medium">{watch.issue}</span>
                <span className="text-xs text-muted-foreground">{` (${watch.likelihood})`}</span>
                {watch.what_to_do ? <div className="text-xs text-muted-foreground">{watch.what_to_do}</div> : null}
              </li>
            ))}
          </ul>
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

      {payload.next_questions.length ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">{zh(language) ? 'Next questions' : 'Next questions'}</div>
          <div className="space-y-2">
            {payload.next_questions.slice(0, 2).map((q) => (
              <div key={q.id} className="rounded-xl border border-border/60 bg-background/60 p-2">
                <div className="text-xs text-muted-foreground">{q.label}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {q.chips.slice(0, 6).map((chip) => (
                    <span key={chip} className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px]">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
