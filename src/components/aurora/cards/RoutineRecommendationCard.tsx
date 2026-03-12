import React from 'react';
import type { Language } from '@/lib/types';

type Dict = Record<string, unknown>;

const asString = (value: unknown): string => (value == null ? '' : String(value).trim());
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asObject = (value: unknown): Dict | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : null;

function ProductRow({ product }: { product: Dict }) {
  const title = asString(product.display_name) || [asString(product.brand), asString(product.name)].filter(Boolean).join(' ') || asString(product.name);
  const url = asString(product.url) || asString(product.pdp_url);
  const reasons = asArray(product.reasons).map(asString).filter(Boolean);
  return (
    <div className="rounded-xl border border-border/50 bg-background/70 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{title || 'Product'}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {[asString(product.category), asString(product.match_state)].filter(Boolean).join(' · ')}
          </div>
        </div>
        {url ? (
          <a className="text-xs font-medium text-primary underline underline-offset-2" href={url} target="_blank" rel="noreferrer">
            View
          </a>
        ) : null}
      </div>
      {reasons.length ? <div className="mt-2 text-sm text-foreground">{reasons[0]}</div> : null}
    </div>
  );
}

export function RoutineRecommendationCard({
  payload,
  language,
}: {
  payload: unknown;
  language: Language;
}) {
  const root = asObject(payload) || {};
  const groups = asArray(root.recommendation_groups).map((item) => asObject(item)).filter(Boolean) as Dict[];

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {language === 'CN' ? '如果要升级，先补这里' : 'If you upgrade, start here'}
        </div>
        <div className="text-xs text-muted-foreground">
          {language === 'CN' ? '每组推荐都只服务于一个明确的 adjustment。' : 'Each recommendation group is bound to one specific adjustment.'}
        </div>
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const products = asArray(group.candidate_pool).map((item) => asObject(item)).filter(Boolean) as Dict[];
          const guidance = asObject(group.category_guidance);
          const required = asArray(group.required_attributes).map(asString).filter(Boolean);
          const avoid = asArray(group.avoid_attributes).map(asString).filter(Boolean);
          const guidanceLookFor = asArray(guidance?.what_to_look_for).map(asString).filter(Boolean);
          const guidanceAvoid = asArray(guidance?.avoid).map(asString).filter(Boolean);

          return (
            <div key={asString(group.adjustment_id)} className="rounded-2xl border border-border/60 bg-muted/15 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {asString(group.adjustment_id)}
                </span>
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {[asString(group.target_step), asString(group.timing)].filter(Boolean).join(' · ')}
                </span>
              </div>

              <div className="mt-2 text-sm text-foreground">{asString(group.why)}</div>

              {(required.length || avoid.length) ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {required.length ? (
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '要找什么' : 'Look for'}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {required.map((item) => (
                          <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {avoid.length ? (
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '尽量避开' : 'Avoid'}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {avoid.map((item) => (
                          <span key={item} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {products.length ? (
                <div className="mt-3 space-y-2">
                  {products.map((product) => (
                    <ProductRow key={asString(product.product_id) || asString(product.display_name) || asString(product.name)} product={product} />
                  ))}
                </div>
              ) : guidance ? (
                <div className="mt-3 rounded-xl border border-border/50 bg-background/70 p-3">
                  {guidanceLookFor.length ? (
                    <div className="text-sm text-foreground">
                      <span className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '优先考虑' : 'What to look for'}:</span>{' '}
                      {guidanceLookFor.join(' · ')}
                    </div>
                  ) : null}
                  {guidanceAvoid.length ? (
                    <div className="mt-2 text-sm text-foreground">
                      <span className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '避开' : 'Avoid'}:</span>{' '}
                      {guidanceAvoid.join(' · ')}
                    </div>
                  ) : null}
                  {asString(guidance.note) ? <div className="mt-2 text-sm text-foreground">{asString(guidance.note)}</div> : null}
                  {asString(group.unresolved_reason) ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {language === 'CN' ? '当前没有命中的内部候选' : 'No grounded internal candidates were found yet'} · {asString(group.unresolved_reason)}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {asString(group.recommendation_query) ? (
                <details className="mt-3 rounded-xl border border-border/50 bg-background/60 p-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                    {language === 'CN' ? '查看检索 query' : 'See resolver query'}
                  </summary>
                  <div className="mt-2 text-sm text-foreground">{asString(group.recommendation_query)}</div>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
