import React, { useMemo, useState } from 'react';
import type { AnalysisResult, Language, Session } from '@/lib/types';

type Props = {
  payload: {
    analysis: AnalysisResult;
    session: Session;
    low_confidence?: boolean;
    photos_provided?: boolean;
  };
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
};

function IconBadge({ kind }: { kind: 'check' | 'warn' }) {
  const base =
    'mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full border text-sm font-semibold leading-none';
  if (kind === 'check') return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>✓</span>;
  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>!</span>;
}

function ConfidencePill({ label }: { label: 'High' | 'Likely' }) {
  return (
    <span className="ml-3 inline-flex shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
      {label}
    </span>
  );
}

export function AnalysisSummaryCard({ payload, onAction }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [quickCheck, setQuickCheck] = useState<'yes' | 'no' | null>(null);

  const takeaways = useMemo(
    () => [
      {
        icon: 'check' as const,
        title: 'Barrier looks irritated',
        subtitle: 'Prioritize calming + repair first',
        confidence: 'High' as const,
      },
      {
        icon: 'warn' as const,
        title: 'Oily/combination = clog-prone',
        subtitle: 'Avoid over-cleansing (oiliness ≠ hydrated)',
        confidence: 'Likely' as const,
      },
      {
        icon: 'warn' as const,
        title: 'Pores/acne goal',
        subtitle: 'Try gentle exfoliation later if tolerated',
        confidence: 'Likely' as const,
      },
    ],
    [],
  );

  const plan = useMemo(
    () => [
      'Minimal routine: cleanser + moisturizer + SPF',
      'Pause actives if stinging/redness; focus on repair',
      'For pores/texture: start 2×/week, watch 72h',
    ],
    [],
  );

  const toggleQuick = (value: 'yes' | 'no') => {
    setQuickCheck((prev) => (prev === value ? null : value));
  };

  const lowConfidence = Boolean(payload.low_confidence);

  return (
    <article className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Skin summary</h2>
        <p className="text-xs text-slate-500">{payload.photos_provided ? 'Based on your answers + 1 photo' : 'Based on your answers'}</p>
      </div>

      <div className="mt-4 space-y-4">
        {/* Key takeaways */}
        <section aria-labelledby="key-takeaways">
          <h3 id="key-takeaways" className="text-sm font-semibold text-slate-900">
            Key takeaways
          </h3>
          <ul className="mt-3 space-y-3">
            {takeaways.map((t) => (
              <li key={t.title} className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <IconBadge kind={t.icon} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{t.subtitle}</div>
                  </div>
                </div>
                <ConfidencePill label={t.confidence} />
              </li>
            ))}
          </ul>
        </section>

        {/* Next 7 days plan */}
        <section aria-labelledby="next-7-days">
          <h3 id="next-7-days" className="text-sm font-semibold text-slate-900">
            Next 7 days plan
          </h3>

          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-800">
            {plan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
            If you feel stinging or see redness, keep it minimal and skip strong actives for now.
          </div>

          <div className="mt-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg px-1 text-sm font-medium text-slate-700 hover:text-slate-900"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((v) => !v)}
            >
              <span>Show details</span>
              <span className="text-slate-400" aria-hidden="true">
                {detailsOpen ? '▴' : '▾'}
              </span>
            </button>

            {detailsOpen ? (
              <div className="mt-2 text-sm leading-relaxed text-slate-700">
                Actives to pause: acids / high-strength vitamin C / retinoids
              </div>
            ) : null}
          </div>
        </section>

        {/* Quick check */}
        <section aria-labelledby="quick-check">
          <h3 id="quick-check" className="text-sm font-semibold text-slate-900">
            Quick check
          </h3>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">Any stinging or redness recently?</p>
            <div
              className="inline-flex shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white"
              role="group"
              aria-label="Quick check options"
            >
              <button
                type="button"
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  quickCheck === 'yes' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
                aria-pressed={quickCheck === 'yes'}
                onClick={() => toggleQuick('yes')}
              >
                Yes
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  quickCheck === 'no' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
                aria-pressed={quickCheck === 'no'}
                onClick={() => toggleQuick('no')}
              >
                No
              </button>
            </div>
          </div>
        </section>

        {/* Actions */}
        <footer className="space-y-3">
          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            onClick={() => onAction(lowConfidence ? 'analysis_review_products' : 'analysis_continue')}
          >
            {lowConfidence ? 'Review my current products first' : 'See product recommendations'}
          </button>

          {!lowConfidence ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => onAction('analysis_gentler')}
              >
                Make gentler
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => onAction('analysis_simple')}
              >
                Keep simple
              </button>
            </div>
          ) : null}
        </footer>
      </div>
    </article>
  );
}

export default AnalysisSummaryCard;
