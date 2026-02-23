import React, { useMemo, useState } from 'react';
import type { AnalysisResult, Language, Session } from '@/lib/types';

type Props = {
  payload: {
    analysis: AnalysisResult;
    session: Session;
    low_confidence?: boolean;
    photos_provided?: boolean;
    photo_qc?: string[];
    analysis_source?: string;
    used_photos?: boolean;
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

function clampText(input: string, max: number) {
  const s = String(input || '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function toConfidenceLabel(confidence: string | null | undefined): 'High' | 'Likely' {
  return confidence === 'pretty_sure' ? 'High' : 'Likely';
}

function toIconKind(observation: string, confidence: string | null | undefined): 'check' | 'warn' {
  const c = String(confidence || '');
  if (c === 'pretty_sure') {
    // Pretty sure can still be a warning, so only mark "check" when it's explicitly positive.
    const lower = String(observation || '').toLowerCase();
    const positive = ['balanced', 'healthy', 'stable', 'good', 'improves', 'calm', 'compatible', 'safe', 'passed', 'ok'];
    const negative = ['irritated', 'impaired', 'unclear', 'stressed', 'risk', 'avoid', 'pause', 'sensitive', 'stinging', 'redness', 'flaking'];
    if (positive.some((k) => lower.includes(k)) && !negative.some((k) => lower.includes(k))) return 'check';
  }
  return 'warn';
}

function splitObservation(observation: string): { title: string; subtitle: string } {
  const text = String(observation || '').trim();
  if (!text) return { title: '', subtitle: '' };

  const arrow = text.includes('→') ? '→' : text.includes('->') ? '->' : null;
  if (arrow) {
    const [left, ...rest] = text.split(arrow);
    const titleRaw = String(left || '').trim();
    const subtitleRaw = rest.join(arrow).trim();
    return { title: titleRaw, subtitle: subtitleRaw };
  }

  const sep = text.includes(':') ? ':' : text.includes('—') ? '—' : null;
  if (sep) {
    const idx = text.indexOf(sep);
    if (idx > 6 && idx < 60) {
      const titleRaw = text.slice(0, idx).trim();
      const subtitleRaw = text.slice(idx + 1).trim();
      return { title: titleRaw, subtitle: subtitleRaw };
    }
  }

  return { title: text, subtitle: '' };
}

function extractPlan(strategy: string): string[] {
  const text = String(strategy || '').trim();
  if (!text) return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const numbered: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+\s*[).]\s*(.+)$/);
    if (m && m[1]) numbered.push(m[1].trim());
  }
  if (numbered.length >= 3) return numbered.slice(0, 3);

  const bullets: string[] = [];
  for (const line of lines) {
    const m = line.match(/^[-•]\s*(.+)$/);
    if (m && m[1]) bullets.push(m[1].trim());
  }
  if (bullets.length >= 3) return bullets.slice(0, 3);

  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.slice(0, 3);
}

function describePhotoBasis({
  photosProvided,
  photoQc,
  analysisSource,
  usedPhotos,
  language,
}: {
  photosProvided: boolean;
  photoQc: string[];
  analysisSource?: string;
  usedPhotos?: boolean;
  language: Language;
}) {
  if (!photosProvided) {
    return language === 'CN' ? '基于你的问答信息' : 'Based on your answers';
  }

  const passedSlots = photoQc
    .map((raw) => String(raw || '').trim())
    .filter(Boolean)
    .map((v) => v.split(':').map((x) => x.trim()))
    .filter((parts) => parts.length >= 2 && parts[1].toLowerCase() === 'passed')
    .map((parts) => parts[0])
    .filter(Boolean);
  const uniqueSlots = Array.from(new Set(passedSlots.map((s) => s.toLowerCase()))).slice(0, 2);
  const slotLabel = uniqueSlots.length ? ` (${uniqueSlots.join(', ')})` : '';
  const source = String(analysisSource || '').trim().toLowerCase();

  if (usedPhotos === false || source === 'rule_based_with_photo_qc') {
    return language === 'CN'
      ? `已上传照片，但本次未读到可用图像，当前仅基于问答/历史${slotLabel}`
      : `Photos uploaded, but usable image bytes were unavailable; currently based on answers/history${slotLabel}`;
  }

  if (source === 'retake') {
    return language === 'CN'
      ? `上传质检已通过，但诊断级质量不足，需重拍${slotLabel}`
      : `Upload QC passed, but diagnostic quality is insufficient; retake needed${slotLabel}`;
  }

  const photoCount = uniqueSlots.length > 0 ? uniqueSlots.length : 1;
  if (language === 'CN') return `基于你的问答 + ${photoCount} 张照片${slotLabel}`;
  return `Based on your answers + ${photoCount} photo${photoCount > 1 ? 's' : ''}${slotLabel}`;
}

export function AnalysisSummaryCard({ payload, onAction, language }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [quickCheck, setQuickCheck] = useState<'yes' | 'no' | null>(null);

  const lowConfidence = Boolean(payload.low_confidence);
  const photosProvided = Boolean(payload.photos_provided);
  const photoQc = useMemo(
    () => (Array.isArray(payload.photo_qc) ? payload.photo_qc.map((v) => String(v || '').trim()).filter(Boolean) : []),
    [payload.photo_qc],
  );

  const takeaways = useMemo(() => {
    const fallback = [
      {
        icon: 'warn' as const,
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
    ];

    const features = Array.isArray(payload.analysis?.features) ? payload.analysis.features : [];
    const parsed = features
      .map((f) => {
        const obs = String(f?.observation || '').trim();
        if (!obs) return null;
        const { title, subtitle } = splitObservation(obs);
        const c = String(f?.confidence || 'somewhat_sure');
        return {
          icon: toIconKind(obs, c),
          title: clampText(title || obs, 40),
          subtitle: clampText(subtitle, 60),
          confidence: toConfidenceLabel(c),
        };
      })
      .filter(Boolean) as Array<{ icon: 'check' | 'warn'; title: string; subtitle: string; confidence: 'High' | 'Likely' }>;

    const out = parsed.slice(0, 3);
    while (out.length < 3) out.push(fallback[out.length]);
    return out;
  }, [payload.analysis?.features]);

  const plan = useMemo(() => {
    const fallback = [
      'Minimal routine: cleanser + moisturizer + SPF',
      'Pause actives if stinging/redness; focus on repair',
      'For pores/texture: start 2×/week, watch 72h',
    ];
    const extracted = extractPlan(payload.analysis?.strategy || '');
    if (extracted.length >= 3) return extracted.slice(0, 3).map((x) => clampText(x, 88));
    return fallback;
  }, [payload.analysis?.strategy]);

  const toggleQuick = (value: 'yes' | 'no') => {
    const next = quickCheck === value ? null : value;
    setQuickCheck(next);
    if (next) onAction('analysis_quick_check', { value: next });
  };

  const subtitle = useMemo(
    () =>
      describePhotoBasis({
        photosProvided,
        photoQc,
        analysisSource: payload.analysis_source,
        usedPhotos: payload.used_photos,
        language,
      }),
    [language, payload.analysis_source, payload.used_photos, photoQc, photosProvided],
  );

  return (
    <article className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Skin summary</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
        {lowConfidence ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {language === 'CN'
              ? '当前为低置信度基线：建议补充你正在用的 AM/PM 产品/步骤后再做个性化分析。'
              : 'Low confidence baseline: add your current AM/PM products/steps for a more accurate analysis.'}
          </div>
        ) : null}
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
            onClick={() => onAction('analysis_continue')}
          >
            {language === 'CN' ? '查看产品推荐' : 'See product recommendations'}
          </button>
          {lowConfidence ? (
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300/50"
              onClick={() => onAction('analysis_review_products')}
            >
              {language === 'CN' ? '填写 AM/PM 产品（更准）' : 'Add AM/PM products (more accurate)'}
            </button>
          ) : null}

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onAction('analysis_gentler')}
            >
              {language === 'CN' ? '更温和' : 'Make gentler'}
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onAction('analysis_simple')}
            >
              {language === 'CN' ? '更简单' : 'Keep simple'}
            </button>
          </div>
        </footer>
      </div>
    </article>
  );
}

export default AnalysisSummaryCard;
