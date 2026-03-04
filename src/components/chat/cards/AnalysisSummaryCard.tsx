import React, { useMemo, useState } from 'react';
import type {
  AnalysisDeepening,
  AnalysisEvidenceRef,
  AnalysisFeature,
  AnalysisFinding,
  AnalysisResult,
  Language,
  QualityInfo,
  RoutineExpertV1,
  Session,
} from '@/lib/types';

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

const toFindings = (analysis: AnalysisResult): AnalysisFinding[] => {
  const raw = Array.isArray(analysis?.findings) ? analysis.findings : [];
  return raw
    .map((row: any) => ({
      cue: asString(row?.cue),
      where: asString(row?.where),
      severity: (asString(row?.severity) || 'mild') as AnalysisFinding['severity'],
      confidence: (asString(row?.confidence) || 'med') as AnalysisFinding['confidence'],
      evidence: asString(row?.evidence),
    }))
    .filter((row) => row.cue && row.evidence)
    .slice(0, 5);
};

const toQuality = (analysis: AnalysisResult): QualityInfo | null => {
  const raw = analysis?.quality;
  if (!raw || typeof raw !== 'object') return null;
  const grade = asString((raw as any).grade) as QualityInfo['grade'];
  if (grade !== 'pass' && grade !== 'degraded' && grade !== 'fail') return null;
  return {
    grade,
    message: asString((raw as any).message) || undefined,
    issues: asStringArray((raw as any).issues, 6) || undefined,
    confidence_penalty: typeof (raw as any).confidence_penalty === 'number' ? (raw as any).confidence_penalty : undefined,
  };
};

const SEVERITY_COLORS: Record<string, string> = {
  mild: 'bg-green-50 border-green-200 text-green-900',
  moderate: 'bg-amber-50 border-amber-200 text-amber-900',
  high: 'bg-red-50 border-red-200 text-red-900',
};

const CONFIDENCE_LABEL: Record<string, Record<string, string>> = {
  EN: { high: 'High confidence', med: 'Medium confidence', low: 'Low confidence' },
  CN: { high: '高置信', med: '中置信', low: '低置信' },
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

const toRoutineExpert = (analysis: AnalysisResult): RoutineExpertV1 | null => {
  const raw = (analysis as any)?.routine_expert;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (asString((raw as any).contract) !== 'aurora.routine_expert.v1') return null;
  return raw as RoutineExpertV1;
};

export function AnalysisSummaryCard({ payload, onAction, language }: Props) {
  const analysis = payload?.analysis || ({} as AnalysisResult);
  const lowConfidence = Boolean(payload?.low_confidence);
  const photosProvided = Boolean(payload?.photos_provided);
  const photoQc = Array.isArray(payload?.photo_qc) ? payload.photo_qc.map((item) => asString(item)).filter(Boolean) : [];
  const [quickCheckAnswer, setQuickCheckAnswer] = useState<'yes' | 'no' | null>(null);

  const quality = useMemo(() => toQuality(analysis), [analysis]);
  const findings = useMemo(() => toFindings(analysis), [analysis]);
  const guidanceBrief = useMemo(() => asStringArray(analysis?.guidance_brief, 3), [analysis]);
  const insufficientDetail = Boolean(analysis?.insufficient_visual_detail);

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
  const routineExpert = useMemo(() => toRoutineExpert(analysis), [analysis]);
  const routineEvidenceRefs = useMemo(() => {
    if (!routineExpert) return [] as AnalysisEvidenceRef[];
    const refs = Array.isArray((routineExpert as any).evidence_refs) ? (routineExpert as any).evidence_refs : [];
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
  }, [routineExpert]);

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

  const nextStepOptions = Array.isArray(analysis?.next_step_options) ? analysis.next_step_options : [];
  const twoWeekFocus = asStringArray(analysis?.two_week_focus, 3);
  const lang = language === 'CN' ? 'CN' : 'EN';
  const quickCheckQuestion = asString((routineExpert as any)?.primary_question);
  const quickCheckFollowups = asStringArray((routineExpert as any)?.conditional_followups, 3);
  const keyIssues = useMemo(() => {
    const rows = Array.isArray((routineExpert as any)?.key_issues) ? (routineExpert as any).key_issues : [];
    return rows
      .map((row: any) => asString(row?.title))
      .filter(Boolean)
      .slice(0, 4);
  }, [routineExpert]);
  const phase1Lines = asStringArray((routineExpert as any)?.phase_plan?.phase_1_14d, 4);
  const phase2Lines = asStringArray((routineExpert as any)?.phase_plan?.phase_2_3_6w, 4);
  const mechanismLines = asStringArray((routineExpert as any)?.why_it_happens, 4);
  const displayedEvidenceRefs = routineEvidenceRefs.length ? routineEvidenceRefs : evidenceRefs;

  return (
    <article className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">{language === 'CN' ? '肤况深度分析' : 'Skin Deep Analysis'}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>

        {quality?.grade === 'degraded' && quality.message ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {quality.message}
          </div>
        ) : null}

        {quality?.grade === 'fail' ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-900">
            {language === 'CN'
              ? '照片质量不足，无法进行分析。请按指引重新拍照。'
              : 'Photo quality is insufficient for analysis. Please retake with the guidance below.'}
          </div>
        ) : null}

        {insufficientDetail ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {language === 'CN'
              ? '可见细节不足，建议补充更清晰的照片以提升准确度。'
              : 'Insufficient visual detail. Consider adding a clearer photo for better accuracy.'}
          </div>
        ) : null}

        {!quality && lowConfidence ? (
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

      {findings.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '观察发现' : 'Findings'}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {findings.map((f, i) => (
              <li key={`${f.cue}_${f.where}_${i}`} className={`rounded-xl border px-3 py-2 ${SEVERITY_COLORS[f.severity] || 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{f.cue.replace(/_/g, ' ')}</span>
                  <span className="text-xs opacity-70">{f.where} &middot; {CONFIDENCE_LABEL[lang]?.[f.confidence] || f.confidence}</span>
                </div>
                <p className="mt-1 text-xs opacity-80">{f.evidence}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : features.length ? (
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

      {guidanceBrief.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '核心建议' : 'Key Guidance'}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {guidanceBrief.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {twoWeekFocus.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '两周重点' : '2-Week Focus'}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {twoWeekFocus.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {routineExpert && keyIssues.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '关键问题' : 'Key Issues'}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {keyIssues.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {routineExpert && phase1Lines.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">Phase 1</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {phase1Lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {routineExpert && phase2Lines.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">Phase 2</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {phase2Lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {routineExpert && mechanismLines.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '机制解释' : 'Mechanism'}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {mechanismLines.map((line) => (
              <li key={line}>{line}</li>
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

      {displayedEvidenceRefs.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '证据来源' : 'Evidence References'}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {displayedEvidenceRefs.map((ref) => (
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

      {routineExpert && quickCheckQuestion ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">{language === 'CN' ? '快速确认' : 'Quick Check'}</h3>
          <p className="mt-2 text-sm text-slate-800">{quickCheckQuestion}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setQuickCheckAnswer('yes');
                onAction('analysis_quick_check', { value: 'yes' });
              }}
            >
              {language === 'CN' ? '是' : 'Yes'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setQuickCheckAnswer('no');
                onAction('analysis_quick_check', { value: 'no' });
              }}
            >
              {language === 'CN' ? '否' : 'No'}
            </button>
          </div>
          {quickCheckAnswer && quickCheckFollowups.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {quickCheckFollowups.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <footer className="mt-5 space-y-3">
        {lowConfidence ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => onAction('analysis_continue')}
            >
              {language === 'CN' ? '查看产品推荐' : 'See product recommendations'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onAction('analysis_review_products')}
            >
              {language === 'CN' ? '填写 AM/PM 产品（更准）' : 'Add AM/PM products (more accurate)'}
            </button>
          </div>
        ) : null}

        {!lowConfidence && phase === 'photo_optin' ? (
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

        {!lowConfidence && phase === 'products' ? (
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

        {!lowConfidence && phase === 'reactions' ? (
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

        {!lowConfidence && phase === 'refined' && nextStepOptions.length ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {nextStepOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => onAction(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : !lowConfidence && phase === 'refined' ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => onAction('analysis_continue')}
            >
              {language === 'CN' ? '查看产品推荐' : 'See product recommendations'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onAction('analysis_review_products')}
            >
              {language === 'CN' ? '填写 AM/PM 产品' : 'Add AM/PM products'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => onAction('analysis_both_reco_optimize')}
            >
              {language === 'CN' ? '两者都要' : 'Both'}
            </button>
          </div>
        ) : null}
      </footer>
    </article>
  );
}

export default AnalysisSummaryCard;
