import React from 'react';
import type { Language } from '@/lib/types';

type Dict = Record<string, unknown>;

const asString = (value: unknown): string => (value == null ? '' : String(value).trim());
const asNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asObject = (value: unknown): Dict | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : null;

const verdictTone = (verdict: string): string => {
  const key = verdict.toLowerCase();
  if (key === 'good') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (key === 'poor') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (key === 'mixed') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const actionTone = (action: string): string => {
  const key = action.toLowerCase();
  if (key === 'keep') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (key === 'move_to_am' || key === 'move_to_pm' || key === 'reduce_frequency') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (key === 'replace' || key === 'remove') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const actionLabel = (action: string, language: Language): string => {
  const labels: Record<string, Record<Language, string>> = {
    keep: { EN: 'Keep', CN: '保留' },
    move_to_am: { EN: 'Move to AM', CN: '挪到 AM' },
    move_to_pm: { EN: 'Move to PM', CN: '挪到 PM' },
    reduce_frequency: { EN: 'Reduce frequency', CN: '降低频率' },
    replace: { EN: 'Replace', CN: '替换' },
    remove: { EN: 'Remove', CN: '移除' },
    unknown: { EN: 'Needs verification', CN: '待核实' },
  };
  return labels[action]?.[language] || action || (language === 'CN' ? '待核实' : 'Needs verification');
};

export function RoutineProductAuditCard({
  payload,
  language,
}: {
  payload: unknown;
  language: Language;
}) {
  const root = asObject(payload) || {};
  const products = asArray(root.products).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const additional = asArray(root.additional_items_needing_verification).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const missingInfo = asArray(root.missing_info).map(asString).filter(Boolean);
  const confidence = asNumber(root.confidence);

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {language === 'CN' ? '你当前产品逐个拆解' : 'Your current products'}
          </div>
          <div className="text-xs text-muted-foreground">
            {language === 'CN' ? '先看每个产品现在在这套 routine 里的作用和处理方式。' : 'Product-by-product audit before any routine-level summary.'}
          </div>
        </div>
        {confidence != null ? (
          <div className="rounded-full border border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
            {language === 'CN' ? '整体置信度' : 'Overall confidence'} {Math.round(confidence * 100)}%
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {products.map((product) => {
          const fitForGoals = asArray(product.fit_for_goals).map((item) => asObject(item)).filter(Boolean) as Dict[];
          const fitForSeason = asObject(product.fit_for_season_or_climate);
          const fitForSkin = asObject(product.fit_for_skin_type);
          const potentialConcerns = asArray(product.potential_concerns).map(asString).filter(Boolean);
          const signals = asArray(product.likely_key_ingredients_or_signals).map(asString).filter(Boolean);
          const missing = asArray(product.missing_info).map(asString).filter(Boolean);
          const evidenceBasis = asArray(product.evidence_basis).map(asString).filter(Boolean);
          const resolvedName = asString(product.resolved_name_or_null);
          const itemConfidence = asNumber(product.confidence);
          const action = asString(product.suggested_action) || 'unknown';
          const tentative = !resolvedName || (itemConfidence != null && itemConfidence < 0.6);

          return (
            <div key={asString(product.product_ref) || asString(product.input_label)} className="rounded-2xl border border-border/60 bg-muted/15 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-foreground">{asString(product.input_label) || (language === 'CN' ? '未命名产品' : 'Unnamed product')}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${actionTone(action)}`}>
                      {actionLabel(action, language)}
                    </span>
                    {tentative ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700">
                        {language === 'CN' ? '暂定判断' : 'Tentative'}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {[resolvedName, asString(product.inferred_product_type), asString(product.likely_role)].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {fitForSkin ? (
                  <div className="rounded-xl border border-border/50 bg-background/70 p-2">
                    <div className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '肤质/耐受匹配' : 'Skin fit'}</div>
                    <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${verdictTone(asString(fitForSkin.verdict))}`}>
                      {asString(fitForSkin.verdict) || 'unknown'}
                    </div>
                    <div className="mt-1 text-sm text-foreground">{asString(fitForSkin.reason)}</div>
                  </div>
                ) : null}
                {fitForSeason ? (
                  <div className="rounded-xl border border-border/50 bg-background/70 p-2">
                    <div className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '季节/环境匹配' : 'Season / climate fit'}</div>
                    <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${verdictTone(asString(fitForSeason.verdict))}`}>
                      {asString(fitForSeason.verdict) || 'unknown'}
                    </div>
                    <div className="mt-1 text-sm text-foreground">{asString(fitForSeason.reason)}</div>
                  </div>
                ) : null}
              </div>

              {fitForGoals.length ? (
                <div className="mt-3">
                  <div className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '目标匹配' : 'Goal fit'}</div>
                  <div className="mt-2 space-y-2">
                    {fitForGoals.slice(0, 3).map((goal) => (
                      <div key={`${asString(goal.goal)}_${asString(goal.verdict)}`} className="rounded-xl border border-border/50 bg-background/70 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{asString(goal.goal)}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${verdictTone(asString(goal.verdict))}`}>
                            {asString(goal.verdict) || 'unknown'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-foreground">{asString(goal.reason)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {potentialConcerns.length ? (
                <div className="mt-3">
                  <div className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '潜在问题' : 'Potential concerns'}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {potentialConcerns.slice(0, 5).map((concern) => (
                      <span key={concern} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                        {concern}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 rounded-xl border border-border/50 bg-background/70 p-2 text-sm text-foreground">
                {asString(product.concise_reasoning_en)}
              </div>

              {(signals.length || missing.length || evidenceBasis.length || itemConfidence != null) ? (
                <details className="mt-3 rounded-xl border border-border/50 bg-background/60 p-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                    {language === 'CN' ? '查看判断依据' : 'See evidence details'}
                  </summary>
                  <div className="mt-2 space-y-2 text-sm text-foreground">
                    {signals.length ? <div><span className="text-[11px] text-muted-foreground">{language === 'CN' ? '关键信号' : 'Signals'}:</span> {signals.join(' · ')}</div> : null}
                    {evidenceBasis.length ? <div><span className="text-[11px] text-muted-foreground">{language === 'CN' ? '判断来源' : 'Evidence basis'}:</span> {evidenceBasis.join(' · ')}</div> : null}
                    {missing.length ? <div><span className="text-[11px] text-muted-foreground">{language === 'CN' ? '缺失信息' : 'Missing info'}:</span> {missing.join(' · ')}</div> : null}
                    {itemConfidence != null ? <div><span className="text-[11px] text-muted-foreground">{language === 'CN' ? '置信度' : 'Confidence'}:</span> {Math.round(itemConfidence * 100)}%</div> : null}
                  </div>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>

      {additional.length ? (
        <details className="rounded-xl border border-border/60 bg-background/60 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {language === 'CN' ? `还有 ${additional.length} 个待核实产品` : `${additional.length} more items need verification`}
          </summary>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            {additional.map((item) => (
              <div key={asString(item.product_ref) || asString(item.input_label)}>
                <span className="font-medium text-foreground">{asString(item.input_label)}</span>
                {asString(item.reason) ? ` · ${asString(item.reason)}` : ''}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {missingInfo.length ? (
        <div className="text-xs text-muted-foreground">{missingInfo.join(' · ')}</div>
      ) : null}
    </div>
  );
}
