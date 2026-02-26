import React from 'react';

import type { Language } from '@/lib/types';

type StoryItem = {
  title?: string;
  detail?: string;
};

type StoryStep = {
  step?: string;
  purpose?: string;
};

type RoutineBridge = {
  missing_fields?: string[];
  why_now?: string;
  cta_label?: string;
  cta_action?: string;
};

type AnalysisStoryPayload = {
  skin_profile?: {
    skin_type_tendency?: string;
    sensitivity_tendency?: string;
    current_strengths?: string[];
  };
  priority_findings?: StoryItem[];
  target_state?: string[];
  core_principles?: string[];
  am_plan?: StoryStep[];
  pm_plan?: StoryStep[];
  timeline?: {
    first_4_weeks?: string[];
    week_8_12_expectation?: string[];
  };
  safety_notes?: string[];
  routine_bridge?: RoutineBridge;
};

const asTextArray = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
    .filter(Boolean)
    .slice(0, 12);

const asSteps = (value: unknown): StoryStep[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? (item as StoryStep) : null))
    .filter(Boolean)
    .slice(0, 8) as StoryStep[];

const asFindings = (value: unknown): StoryItem[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item) ? (item as StoryItem) : null))
    .filter(Boolean)
    .slice(0, 8) as StoryItem[];

export function AnalysisStoryCard({
  payload,
  language,
  onAction,
}: {
  payload: Record<string, unknown>;
  language: Language;
  onAction: (actionId: string, data?: Record<string, unknown>) => void;
}) {
  const story = (payload || {}) as AnalysisStoryPayload;
  const skinProfile = story.skin_profile || {};
  const findings = asFindings(story.priority_findings);
  const targetState = asTextArray(story.target_state);
  const corePrinciples = asTextArray(story.core_principles);
  const amPlan = asSteps(story.am_plan);
  const pmPlan = asSteps(story.pm_plan);
  const timeline4Weeks = asTextArray(story.timeline?.first_4_weeks);
  const timeline8To12 = asTextArray(story.timeline?.week_8_12_expectation);
  const safetyNotes = asTextArray(story.safety_notes);
  const routineBridge = (story.routine_bridge || {}) as RoutineBridge;
  const missingFields = asTextArray(routineBridge.missing_fields);

  const labels =
    language === 'CN'
      ? {
          title: '分析解读',
          profile: '皮肤画像',
          concerns: '优先关注',
          target: '目标状态',
          principles: '关键原则',
          am: '早间计划',
          pm: '晚间计划',
          timeline: '执行节奏',
          safety: '安全提示',
        }
      : {
          title: 'Analysis Story',
          profile: 'Skin profile',
          concerns: 'Priority findings',
          target: 'Target state',
          principles: 'Core principles',
          am: 'AM plan',
          pm: 'PM plan',
          timeline: 'Timeline',
          safety: 'Safety notes',
        };

  const ctaLabel = String(routineBridge.cta_label || '').trim() || (language === 'CN' ? '补全 AM/PM Routine' : 'Add AM/PM routine');

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div className="text-sm font-semibold text-foreground">{labels.title}</div>

      <div className="rounded-xl border border-border/60 bg-background/80 p-3 text-sm text-foreground">
        <div className="text-xs font-medium text-muted-foreground">{labels.profile}</div>
        <div className="mt-1">
          {(language === 'CN' ? '肤质倾向：' : 'Skin type: ') + String(skinProfile.skin_type_tendency || (language === 'CN' ? '待补充' : 'pending'))}
        </div>
        <div className="mt-1">
          {(language === 'CN' ? '敏感倾向：' : 'Sensitivity: ') +
            String(skinProfile.sensitivity_tendency || (language === 'CN' ? '待补充' : 'pending'))}
        </div>
        {asTextArray(skinProfile.current_strengths).length ? (
          <div className="mt-2 text-xs text-muted-foreground">{asTextArray(skinProfile.current_strengths).join(' · ')}</div>
        ) : null}
      </div>

      {findings.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{labels.concerns}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {findings.map((item, index) => (
              <li key={`finding_${index}`}>{String(item.title || item.detail || '').trim()}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {targetState.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{labels.target}</div>
          <div className="mt-1 text-sm text-foreground">{targetState.join(' ')}</div>
        </div>
      ) : null}

      {corePrinciples.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{labels.principles}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {corePrinciples.map((line) => (
              <li key={`principle_${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {amPlan.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{labels.am}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {amPlan.map((step, index) => (
              <li key={`am_${index}`}>
                {String(step.step || '').trim()}
                {String(step.purpose || '').trim() ? ` · ${String(step.purpose || '').trim()}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pmPlan.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{labels.pm}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {pmPlan.map((step, index) => (
              <li key={`pm_${index}`}>
                {String(step.step || '').trim()}
                {String(step.purpose || '').trim() ? ` · ${String(step.purpose || '').trim()}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(timeline4Weeks.length || timeline8To12.length) && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{labels.timeline}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {timeline4Weeks.map((line) => (
              <li key={`timeline_w4_${line}`}>{line}</li>
            ))}
            {timeline8To12.map((line) => (
              <li key={`timeline_w12_${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {safetyNotes.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{labels.safety}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {safetyNotes.map((line) => (
              <li key={`safety_${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {String(routineBridge.why_now || '').trim() ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">{String(routineBridge.why_now || '').trim()}</div>
          {missingFields.length ? (
            <div className="mt-1 text-[11px] text-muted-foreground">{missingFields.join(' · ')}</div>
          ) : null}
          <button
            type="button"
            className="chip-button chip-button-primary mt-3"
            data-testid="analysis-story-routine-cta"
            onClick={() =>
              onAction('chip.start.routine', {
                trigger_source: 'analysis_story_v2',
                source_card_type: 'analysis_story_v2',
                cta_action: String(routineBridge.cta_action || '').trim() || 'open_routine_intake',
              })
            }
          >
            {ctaLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

