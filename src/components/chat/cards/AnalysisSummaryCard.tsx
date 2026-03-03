import React, { useMemo } from 'react';
import type { AnalysisDeepening, AnalysisEvidenceRef, AnalysisFeature, AnalysisResult, Language, Session } from '@/lib/types';

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

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asStringArray = (value: unknown, limit = 6): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => asString(item))
        .filter(Boolean)
        .slice(0, limit)
    : [];

const toFeatureRows = (analysis: AnalysisResult): AnalysisFeature[] => {
  const raw = Array.isArray(analysis?.features) ? analysis.features : [];
  return raw
    .map((row) => ({
      observation: asString((row as any)?.observation),
      confidence: (asString((row as any)?.confidence) || 'somewhat_sure') as AnalysisFeature['confidence'],
    }))
    .filter((row) => row.observation)
    .slice(0, 4);
};

const describePhotoBasis = ({
  language,
  photosProvided,
  photoQc,
  analysisSource,
  usedPhotos,
}: {
  language: Language;
  photosProvided: boolean;
  photoQc: string[];
  analysisSource?: string;
  usedPhotos?: boolean;
}) => {
  const source = asString(analysisSource).toLowerCase();
  const hasPassed = photoQc.some((item) => String(item || '').toLowerCase().includes(':passed'));
  if (!photosProvided) return language === 'CN' ? '基于问卷与历史输入' : 'Based on questionnaire and history';
  if (usedPhotos === false || source === 'rule_based_with_photo_qc') {
    return language === 'CN'
      ? '已上传照片，但本轮未纳入可用图像，先按保守路径给建议'
      : 'Photos were uploaded, but this turn did not use usable image data, so guidance stays conservative';
  }
  if (source === 'retake') {
    return language === 'CN' ? '照片质量不足，建议按引导重拍后复核' : 'Photo quality is insufficient; retake with guidance for re-check';
  }
  if (hasPassed) return language === 'CN' ? '基于问卷 + 已通过质检照片' : 'Based on questionnaire + QC-passed photos';
  return language === 'CN' ? '基于问卷 + 上传照片' : 'Based on questionnaire + uploaded photos';
};

const dedupeLines = (lines: string[], skipLine?: string) => {
  const out: string[] = [];
  for (const line of lines) {
    const text = asString(line);
    if (!text) continue;
    if (skipLine && text === skipLine) continue;
    if (out.includes(text)) continue;
    out.push(text);
  }
  return out;
};

const toEvidenceRefs = (analysis: AnalysisResult): AnalysisEvidenceRef[] => {
  const refs = Array.isArray(analysis?.evidence_refs) ? analysis.evidence_refs : [];
  return refs
    .map((item: any) => {
      const id = asString(item?.id);
      const title = asString(item?.title);
      const url = asString(item?.url);
      const why = asString(item?.why_relevant);
      if (!id || !title || !url) return null;
      return { id, title, url, ...(why ? { why_relevant: why } : {}) };
    })
    .filter(Boolean)
    .slice(0, 6) as AnalysisEvidenceRef[];
};

const toDeepening = (analysis: AnalysisResult): AnalysisDeepening | null => {
  const raw = analysis?.deepening;
  if (!raw || typeof raw !== 'object') return null;
  const phase = asString((raw as any).phase) as AnalysisDeepening['phase'];
  if (phase !== 'photo_optin' && phase !== 'products' && phase !== 'reactions' && phase !== 'refined') return null;
  const next = asString((raw as any).next_phase) as AnalysisDeepening['next_phase'];
  return {
    phase,
    ...(next ? { next_phase: next } : {}),
    ...(asString((raw as any).question) ? { question: asString((raw as any).question) } : {}),
    ...(asStringArray((raw as any).options, 8).length ? { options: asStringArray((raw as any).options, 8) } : {}),
  };
};

export function AnalysisSummaryCard({ payload, onAction, language }: Props) {
  const analysis = payload?.analysis || ({} as AnalysisResult);
  const lowConfidence = Boolean(payload?.low_confidence);
  const photosProvided = Boolean(payload?.photos_provided);
  const photoQc = Array.isArray(payload?.photo_qc) ? payload.photo_qc.map((item) => asString(item)).filter(Boolean) : [];

  const reasoning = useMemo(() => {
    const lines = asStringArray((analysis as any).reasoning, 4);
    if (lines.length > 0) return lines;
    const strategy = asString((analysis as any).strategy);
    if (!strategy) return [];
    return strategy
      .split(/\r?\n/)
      .map((line) => asString(line.replace(/^[-*]\s*/, '')))
      .filter(Boolean)
      .slice(0, 3);
  }, [analysis]);

  const features = useMemo(() => toFeatureRows(analysis), [analysis]);
  const deepening = useMemo(() => toDeepening(analysis), [analysis]);
  const evidenceRefs = useMemo(() => toEvidenceRefs(analysis), [analysis]);

  const primaryQuestion = useMemo(() => {
    const top = asString((analysis as any).primary_question);
    if (top) return top;
    if (deepening?.question) return deepening.question;
    return language === 'CN' ? '你希望我下一步优先深挖哪一块？' : 'What should we deepen next?';
  }, [analysis, deepening, language]);

  const followups = useMemo(() => {
    const conditional = asStringArray((analysis as any).conditional_followups, 3);
    const ask3 = asStringArray((analysis as any).ask_3_questions, 3);
    return dedupeLines([...conditional, ...ask3], primaryQuestion).slice(0, 3);
  }, [analysis, primaryQuestion]);

  const subtitle = useMemo(
    () =>
      describePhotoBasis({
        language,
        photosProvided,
        photoQc,
        analysisSource: payload?.analysis_source,
        usedPhotos: payload?.used_photos,
      }),
    [language, payload?.analysis_source, payload?.used_photos, photosProvided, photoQc],
  );

  const phase = deepening?.phase || 'photo_optin';
  const phaseOptions = Array.isArray(deepening?.options) ? deepening.options.filter(Boolean).slice(0, 6) : [];

  const reactionOptions =
    phase === 'reactions' && phaseOptions.length
      ? phaseOptions
      : phase === 'reactions'
        ? language === 'CN'
          ? ['干燥加重', '皮肤紧绷', '刺痛/灼热', '泛红加重', '新爆痘', '无明显不适']
          : ['Worse dryness', 'Tight skin', 'Stinging/burning', 'Worse redness', 'New breakout', 'No obvious discomfort']
        : [];

  return (
    <article className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">{language === 'CN' ? '肤况深度分析' : 'Skin Deep Analysis'}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
        {lowConfidence ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {language === 'CN'
              ? '当前为低置信度保守路径：可继续深挖，但建议补充自拍或 AM/PM 产品以提升准确度。'
              : 'Current path is low-confidence and conservative. You can continue deepening, but adding a selfie or AM/PM products will improve precision.'}
          </div>
        ) : null}
      </header>

      {reasoning.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '原因 / 注意 / 修复路径' : 'Cause / Watchouts / Repair Path'}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {reasoning.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {features.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '当前重点' : 'Current Priorities'}</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-800">
            {features.map((item, index) => (
              <li key={`${item.observation}_${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                {item.observation}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-4">
        <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '下一步追问' : 'Next Question'}</h3>
        <p className="mt-2 text-sm text-slate-800">{primaryQuestion}</p>
        {followups.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {followups.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {evidenceRefs.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '证据来源' : 'Evidence References'}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {evidenceRefs.map((ref) => (
              <li key={ref.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <a className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500" href={ref.url} target="_blank" rel="noreferrer">
                  {ref.title}
                </a>
                {ref.why_relevant ? <p className="mt-1 text-xs text-slate-600">{ref.why_relevant}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-5 space-y-3">
        {phase === 'photo_optin' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => onAction('analysis_upload_selfie')}
            >
              {language === 'CN' ? '上传自拍做深度分析' : 'Upload selfie for deeper analysis'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onAction('analysis_skip_photo')}
            >
              {language === 'CN' ? '先不上传，继续文本深挖' : 'Skip photo and continue'}
            </button>
          </div>
        ) : null}

        {phase === 'products' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => onAction('analysis_review_products')}
            >
              {language === 'CN' ? '填写 AM/PM 产品（更准）' : 'Add AM/PM products'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onAction('analysis_continue_without_products')}
            >
              {language === 'CN' ? '先继续下一步' : 'Continue without products'}
            </button>
          </div>
        ) : null}

        {phase === 'reactions' ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600">{language === 'CN' ? '请选择最近 3 天最接近的反应：' : 'Select the closest reaction from the last 3 days:'}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {reactionOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => onAction('analysis_reaction_select', { reaction: option })}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {phase === 'refined' ? (
          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={() => onAction('analysis_continue')}
          >
            {language === 'CN' ? '查看产品推荐' : 'See product recommendations'}
          </button>
        ) : null}
      </footer>
    </article>
  );
}

export default AnalysisSummaryCard;
