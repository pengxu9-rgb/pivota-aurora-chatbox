import React, { useMemo, useState } from 'react';
import type { AnalysisResult, Language, RoutineExpertV1, Session } from '@/lib/types';

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

const isStringArray = (input: unknown): input is string[] => Array.isArray(input) && input.every((item) => typeof item === 'string');

const normalizeRoutineExpert = (raw: unknown): RoutineExpertV1 | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as any;
  if (String(obj.contract || '') !== 'aurora.routine_expert.v1') return null;
  const snapshot = obj.snapshot && typeof obj.snapshot === 'object' && !Array.isArray(obj.snapshot) ? obj.snapshot : null;
  if (!snapshot) return null;
  const plan7d = obj.plan_7d && typeof obj.plan_7d === 'object' && !Array.isArray(obj.plan_7d) ? obj.plan_7d : null;
  if (!plan7d) return null;

  return {
    contract: 'aurora.routine_expert.v1',
    snapshot: {
      summary: String(snapshot.summary || '').trim(),
      am_steps: isStringArray(snapshot.am_steps) ? snapshot.am_steps.slice(0, 6) : [],
      pm_steps: isStringArray(snapshot.pm_steps) ? snapshot.pm_steps.slice(0, 6) : [],
      active_families: isStringArray(snapshot.active_families) ? snapshot.active_families.slice(0, 8) : [],
      risk_flags: isStringArray(snapshot.risk_flags) ? snapshot.risk_flags.slice(0, 8) : [],
    },
    key_issues: Array.isArray(obj.key_issues)
      ? obj.key_issues
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const severityRaw = String((item as any).severity || '').trim().toLowerCase();
            const severity = severityRaw === 'high' || severityRaw === 'medium' || severityRaw === 'low' ? severityRaw : 'medium';
            const title = String((item as any).title || '').trim();
            if (!title) return null;
            return {
              id: String((item as any).id || title).trim(),
              title,
              severity,
              evidence: isStringArray((item as any).evidence) ? (item as any).evidence.slice(0, 4) : [],
              impact: String((item as any).impact || '').trim(),
              source_ref_ids: isStringArray((item as any).source_ref_ids) ? (item as any).source_ref_ids.slice(0, 2) : [],
            };
          })
          .filter(Boolean)
          .slice(0, 3)
      : [],
    why_it_happens: isStringArray(obj.why_it_happens) ? obj.why_it_happens.slice(0, 4) : [],
    plan_7d: {
      am: isStringArray(plan7d.am) ? plan7d.am.slice(0, 5) : [],
      pm: isStringArray(plan7d.pm) ? plan7d.pm.slice(0, 5) : [],
      observe_metrics: isStringArray(plan7d.observe_metrics) ? plan7d.observe_metrics.slice(0, 4) : [],
      stop_conditions: isStringArray(plan7d.stop_conditions) ? plan7d.stop_conditions.slice(0, 4) : [],
    },
    upgrade_path: Array.isArray(obj.upgrade_path)
      ? obj.upgrade_path
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const week = String((item as any).week || '').trim();
            const focus = String((item as any).focus || '').trim();
            const action = String((item as any).action || '').trim();
            const guardrail = String((item as any).guardrail || '').trim();
            if (!week || !action) return null;
            return { week, focus, action, guardrail };
          })
          .filter(Boolean)
          .slice(0, 3)
      : [],
    primary_question: String(obj.primary_question || '').trim() || undefined,
    conditional_followups: isStringArray(obj.conditional_followups) ? obj.conditional_followups.slice(0, 2) : [],
    phase_plan:
      obj.phase_plan && typeof obj.phase_plan === 'object' && !Array.isArray(obj.phase_plan)
        ? {
            phase_1_14d: isStringArray((obj.phase_plan as any).phase_1_14d) ? (obj.phase_plan as any).phase_1_14d.slice(0, 6) : [],
            phase_2_3_6w: isStringArray((obj.phase_plan as any).phase_2_3_6w) ? (obj.phase_plan as any).phase_2_3_6w.slice(0, 6) : [],
          }
        : undefined,
    evidence_refs: Array.isArray(obj.evidence_refs)
      ? obj.evidence_refs
          .map((item: any) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const id = String(item.id || '').trim();
            const title = String(item.title || '').trim();
            const url = String(item.url || '').trim();
            const why_relevant = String(item.why_relevant || '').trim();
            if (!id || !title || !url) return null;
            return { id, title, url, why_relevant };
          })
          .filter(Boolean)
          .slice(0, 6)
      : [],
    ask_3_questions: isStringArray(obj.ask_3_questions) ? obj.ask_3_questions.slice(0, 3) : [],
  };
};

export function AnalysisSummaryCard({ payload, onAction, language }: Props) {
  const [quickCheck, setQuickCheck] = useState<'yes' | 'no' | null>(null);

  const lowConfidence = Boolean(payload.low_confidence);
  const photosProvided = Boolean(payload.photos_provided);
  const photoQc = useMemo(
    () => (Array.isArray(payload.photo_qc) ? payload.photo_qc.map((v) => String(v || '').trim()).filter(Boolean) : []),
    [payload.photo_qc],
  );
  const routineExpert = useMemo(() => normalizeRoutineExpert(payload.analysis?.routine_expert), [payload.analysis?.routine_expert]);

  const copy = useMemo(
    () => ({
      title: language === 'CN' ? '肤况总结' : 'Skin summary',
      keyTakeaways: language === 'CN' ? '关键问题' : 'Key takeaways',
      next7Days: language === 'CN' ? '未来 7 天计划' : 'Next 7 days plan',
      quickCheck: language === 'CN' ? '快速确认' : 'Quick check',
      quickCheckQuestion: language === 'CN' ? '最近是否有刺痛或泛红？' : 'Any stinging or redness recently?',
      phase1: language === 'CN' ? 'Phase 1（1-14 天）' : 'Phase 1 (Days 1-14)',
      phase2: language === 'CN' ? 'Phase 2（3-6 周）' : 'Phase 2 (Weeks 3-6)',
      upgradePath: language === 'CN' ? '第 2-4 周升级路径' : 'Week 2-4 upgrade path',
      ask3: language === 'CN' ? '补充问题' : 'Follow-up questions',
      mechanism: language === 'CN' ? '机制解释' : 'Why it happens',
      evidence: language === 'CN' ? '证据来源' : 'Evidence refs',
      conditional: language === 'CN' ? '可选追问' : 'Conditional follow-ups',
      observe: language === 'CN' ? '观察指标' : 'Observe metrics',
      stop: language === 'CN' ? '停止条件' : 'Stop conditions',
      yes: language === 'CN' ? '是' : 'Yes',
      no: language === 'CN' ? '否' : 'No',
      caution:
        language === 'CN'
          ? '如出现刺痛或泛红，先极简护理并暂停强活性。'
          : 'If you feel stinging or see redness, keep it minimal and pause strong actives.',
    }),
    [language],
  );

  const takeaways = useMemo(() => {
    if (routineExpert && routineExpert.key_issues.length > 0) {
      return routineExpert.key_issues.slice(0, 3).map((issue) => ({
        icon: 'warn' as const,
        title: clampText(issue.title, 44),
        subtitle: clampText(issue.impact || issue.evidence[0] || '', 64),
        confidence: issue.severity === 'high' ? ('High' as const) : ('Likely' as const),
      }));
    }

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
  }, [payload.analysis?.features, routineExpert]);

  const phase1Plan = useMemo(() => {
    if (routineExpert?.phase_plan?.phase_1_14d?.length) {
      return routineExpert.phase_plan.phase_1_14d.slice(0, 4).map((line) => clampText(line, 140));
    }
    if (routineExpert) {
      const am = routineExpert.plan_7d.am.filter(Boolean).slice(0, 2);
      const pm = routineExpert.plan_7d.pm.filter(Boolean).slice(0, 2);
      return [...am, ...pm].slice(0, 4).map((line) => clampText(line, 140));
    }
    const extracted = extractPlan(payload.analysis?.strategy || '');
    if (extracted.length) return extracted.slice(0, 3).map((line) => clampText(line, 110));
    return [
      language === 'CN' ? '先用温和洁面 + 保湿 + 防晒的极简基线。' : 'Start with a minimal gentle baseline: cleanser + moisturizer + SPF.',
      language === 'CN' ? '若刺痛/泛红持续，先停强活性。' : 'Pause strong actives if stinging/redness persists.',
      language === 'CN' ? '连续观察 7 天再升级。' : 'Observe for 7 days before escalating.',
    ];
  }, [language, payload.analysis?.strategy, routineExpert]);

  const phase2Plan = useMemo(() => {
    if (routineExpert?.phase_plan?.phase_2_3_6w?.length) {
      return routineExpert.phase_plan.phase_2_3_6w.slice(0, 4).map((line) => clampText(line, 140));
    }
    if (routineExpert?.upgrade_path?.length) {
      return routineExpert.upgrade_path.slice(0, 4).map((step) => clampText(`${step.week}: ${step.action}`, 140));
    }
    return [];
  }, [routineExpert]);

  const primaryQuestion = useMemo(() => {
    if (routineExpert?.primary_question?.trim()) return routineExpert.primary_question.trim();
    if (routineExpert?.ask_3_questions?.[0]) return routineExpert.ask_3_questions[0];
    return copy.quickCheckQuestion;
  }, [copy.quickCheckQuestion, routineExpert]);

  const conditionalFollowups = useMemo(() => {
    if (!routineExpert) return [];
    const fromConditional = Array.isArray(routineExpert.conditional_followups) ? routineExpert.conditional_followups : [];
    const fallback = Array.isArray(routineExpert.ask_3_questions) ? routineExpert.ask_3_questions.slice(1) : [];
    const merged = [...fromConditional, ...fallback].filter((line) => Boolean(String(line || '').trim()));
    const dedup: string[] = [];
    for (const line of merged) {
      if (line === primaryQuestion) continue;
      if (dedup.includes(line)) continue;
      dedup.push(line);
      if (dedup.length >= 3) break;
    }
    return dedup;
  }, [primaryQuestion, routineExpert]);

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
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">{copy.title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
        {routineExpert?.snapshot?.summary ? <p className="text-xs text-slate-700">{routineExpert.snapshot.summary}</p> : null}
        {lowConfidence ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {language === 'CN'
              ? '当前为低置信度基线：建议补充你正在用的 AM/PM 产品/步骤后再做个性化分析。'
              : 'Low confidence baseline: add your current AM/PM products/steps for a more accurate analysis.'}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        <section aria-labelledby="key-takeaways">
          <h3 id="key-takeaways" className="text-sm font-semibold text-slate-900">
            {copy.keyTakeaways}
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

        <section aria-labelledby="phase-1">
          <h3 id="phase-1" className="text-sm font-semibold text-slate-900">
            {routineExpert ? copy.phase1 : copy.next7Days}
          </h3>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-800">
            {phase1Plan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{copy.caution}</div>
        </section>

        {routineExpert ? (
          <section aria-labelledby="phase-2">
            <h3 id="phase-2" className="text-sm font-semibold text-slate-900">
              {copy.phase2}
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-800">
              {phase2Plan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {routineExpert?.why_it_happens?.length ? (
          <section aria-labelledby="mechanism">
            <h3 id="mechanism" className="text-sm font-semibold text-slate-900">
              {copy.mechanism}
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-800">
              {routineExpert.why_it_happens.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {routineExpert?.evidence_refs?.length ? (
          <section aria-labelledby="evidence-refs">
            <h3 id="evidence-refs" className="text-sm font-semibold text-slate-900">
              {copy.evidence}
            </h3>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-800">
              {routineExpert.evidence_refs.map((ref) => (
                <li key={ref.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <a
                    className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ref.title}
                  </a>
                  {ref.why_relevant ? <p className="mt-1 text-xs text-slate-600">{ref.why_relevant}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="quick-check">
          <h3 id="quick-check" className="text-sm font-semibold text-slate-900">
            {copy.quickCheck}
          </h3>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">{primaryQuestion}</p>
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
                {copy.yes}
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  quickCheck === 'no' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                }`}
                aria-pressed={quickCheck === 'no'}
                onClick={() => toggleQuick('no')}
              >
                {copy.no}
              </button>
            </div>
          </div>

          {routineExpert && quickCheck && conditionalFollowups.length ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-900">{copy.conditional}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {conditionalFollowups.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {routineExpert && quickCheck && !conditionalFollowups.length && routineExpert.ask_3_questions.length > 1 ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-900">{copy.ask3}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {routineExpert.ask_3_questions.slice(1).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

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
