import React from 'react';
import type { Language } from '@/lib/types';

type Dict = Record<string, unknown>;

const asString = (value: unknown): string => (value == null ? '' : String(value).trim());
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asObject = (value: unknown): Dict | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : null;

function RoutineSteps({
  title,
  rows,
  language,
}: {
  title: string;
  rows: Dict[];
  language: Language;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={`${asString(row.step_order)}_${asString(row.what_to_use)}`} className="rounded-xl border border-border/50 bg-muted/15 p-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-semibold text-foreground">
                  {asString(row.step_order)}
                </span>
                <span className="text-sm font-medium text-foreground">{asString(row.what_to_use)}</span>
                <span className="rounded-full border border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {asString(row.source_type) === 'step_placeholder'
                    ? (language === 'CN' ? '待补步骤' : 'Placeholder')
                    : (language === 'CN' ? '现有产品' : 'Existing')}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[asString(row.frequency), asString(row.note)].filter(Boolean).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground">{language === 'CN' ? '当前未提供这个时段的步骤。' : 'No current steps were provided for this slot.'}</div>
      )}
    </div>
  );
}

export function RoutineAdjustmentPlanCard({
  payload,
  language,
}: {
  payload: unknown;
  language: Language;
}) {
  const root = asObject(payload) || {};
  const assessment = asObject(root.current_routine_assessment) || {};
  const adjustments = asArray(root.top_3_adjustments).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const improvedAm = asArray(root.improved_am_routine).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const improvedPm = asArray(root.improved_pm_routine).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const overlaps = asArray(root.overlap_or_gaps).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const orderAm = asArray(root.per_step_order_am).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const orderPm = asArray(root.per_step_order_pm).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const rationales = asArray(root.rationale_for_each_adjustment).map((item) => asObject(item)).filter(Boolean) as Dict[];
  const unresolvedNotes = asArray(root.unresolved_recommendation_notes).map((item) => asObject(item)).filter(Boolean) as Dict[];

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div>
        <div className="text-sm font-semibold text-foreground">
          {language === 'CN' ? '最该先改的地方' : 'What to change first'}
        </div>
        {asString(assessment.summary) ? (
          <div className="mt-1 text-sm text-foreground">{asString(assessment.summary)}</div>
        ) : null}
      </div>

      {adjustments.length ? (
        <div className="space-y-2">
          {adjustments.map((adjustment) => {
            const adjustmentId = asString(adjustment.adjustment_id);
            const rationale = rationales.find((item) => asString(item.adjustment_id) === adjustmentId) || null;
            const unresolved = unresolvedNotes.find((item) => asString(item.adjustment_id) === adjustmentId) || null;
            return (
              <div key={adjustmentId || asString(adjustment.title)} className="rounded-2xl border border-border/60 bg-muted/15 p-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                    {asString(adjustment.priority_rank) || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">{asString(adjustment.title)}</div>
                    <div className="mt-1 text-sm text-foreground">{asString(adjustment.why_this_first)}</div>
                    {asString(adjustment.expected_outcome) ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {language === 'CN' ? '预期变化' : 'Expected outcome'}: {asString(adjustment.expected_outcome)}
                      </div>
                    ) : null}
                    {unresolved ? (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                        {asString(unresolved.note)}
                      </div>
                    ) : null}
                    {rationale ? (
                      <details className="mt-2 rounded-xl border border-border/50 bg-background/60 p-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                          {language === 'CN' ? '展开原因' : 'See reasoning'}
                        </summary>
                        <div className="mt-2 space-y-2 text-sm text-foreground">
                          <div>{asString(rationale.reasoning)}</div>
                          {asArray(rationale.evidence).length ? (
                            <div className="text-xs text-muted-foreground">
                              {asArray(rationale.evidence).map(asString).filter(Boolean).join(' · ')}
                            </div>
                          ) : null}
                          {asString(rationale.tradeoff_or_caution) ? (
                            <div className="text-xs text-muted-foreground">
                              {language === 'CN' ? '注意' : 'Caution'}: {asString(rationale.tradeoff_or_caution)}
                            </div>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <RoutineSteps title="AM" rows={improvedAm} language={language} />
        <RoutineSteps title="PM" rows={improvedPm} language={language} />
      </div>

      {(overlaps.length || orderAm.length || orderPm.length) ? (
        <details className="rounded-2xl border border-border/60 bg-background/60 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {language === 'CN' ? '查看组合问题和顺序依据' : 'See overlap, gaps, and order details'}
          </summary>
          <div className="mt-3 space-y-3">
            {overlaps.length ? (
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">{language === 'CN' ? '组合问题' : 'Combination findings'}</div>
                <div className="mt-2 space-y-2">
                  {overlaps.map((item) => (
                    <div key={asString(item.title)} className="rounded-xl border border-border/50 bg-muted/15 p-2">
                      <div className="text-sm font-medium text-foreground">{asString(item.title)}</div>
                      {asArray(item.evidence).length ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {asArray(item.evidence).map(asString).filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {(orderAm.length || orderPm.length) ? (
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">AM</div>
                  <div className="mt-2 space-y-2">
                    {orderAm.map((item) => (
                      <div key={asString(item.product_ref)} className="rounded-xl border border-border/50 bg-muted/15 p-2 text-sm text-foreground">
                        <div className="font-medium">{asString(item.recommended_order)}. {asString(item.input_label)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{asString(item.why_here)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">PM</div>
                  <div className="mt-2 space-y-2">
                    {orderPm.map((item) => (
                      <div key={asString(item.product_ref)} className="rounded-xl border border-border/50 bg-muted/15 p-2 text-sm text-foreground">
                        <div className="font-medium">{asString(item.recommended_order)}. {asString(item.input_label)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{asString(item.why_here)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
