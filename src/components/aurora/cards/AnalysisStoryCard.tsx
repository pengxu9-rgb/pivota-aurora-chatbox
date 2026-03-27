import React from 'react';

import type { Language } from '@/lib/types';

type Dict = Record<string, unknown>;

const asObject = (value: unknown): Dict | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Dict;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string => {
  if (value == null) return '';
  return String(value).trim();
};

const toStringList = (value: unknown, max = 12): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of asArray(value)) {
    const text = asString(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
};

const toPlanLines = (value: unknown, max = 8): string[] =>
  asArray(value)
    .map((item) => {
      const row = asObject(item);
      if (!row) return asString(item);
      const step = asString(row.step) || asString(row.title) || asString(row.name);
      const purpose = asString(row.purpose) || asString(row.why) || asString(row.goal);
      if (step && purpose) return `${step} - ${purpose}`;
      return step || purpose || '';
    })
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);

const renderSectionTitle = (language: Language, en: string, cn: string) => (language === 'CN' ? cn : en);

const canonicalizeFindingText = (raw: string): string =>
  String(raw || '')
    .toLowerCase()
    .replace(/^\s*\d+\s*[.)\-:：·]\s*/, '')
    .replace(/^[\s\-*•·]+/, '')
    .replace(/[，,。.!！？;；:：()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildFindingLine = (item: Dict): string => {
  const priority = asString(item.priority) || asString(item.priority_level);
  const title = asString(item.title) || asString(item.finding) || asString(item.issue);
  const area = asString(item.area) || asString(item.region) || asString(item.module);
  const text = [priority, title, area].filter(Boolean).join(' · ');
  return text || asString(item.description);
};

const normalizeConfidenceLevelLabel = (rawLevel: string, language: Language): string => {
  const token = String(rawLevel || '').trim().toLowerCase();
  if (!token) return '';
  if (language === 'CN') {
    if (token === 'high') return '高';
    if (token === 'medium') return '中';
    if (token === 'low') return '低';
    return rawLevel;
  }
  if (token === 'high') return 'High';
  if (token === 'medium') return 'Medium';
  if (token === 'low') return 'Low';
  return rawLevel;
};

const formatConfidenceOverall = (value: unknown, language: Language): string => {
  if (typeof value === 'string') return value.trim();
  const obj = asObject(value);
  if (!obj) return '';

  const levelRaw = asString(obj.level);
  const level = normalizeConfidenceLevelLabel(levelRaw, language);
  const scoreRaw = Number(obj.score);
  const scorePct = Number.isFinite(scoreRaw) && scoreRaw >= 0 && scoreRaw <= 1 ? Math.round(scoreRaw * 100) : null;

  if (level && scorePct != null) return `${level} (${scorePct}%)`;
  if (level) return level;
  if (scorePct != null) return `${scorePct}%`;
  return '';
};

const looksPhotoLed = (root: Dict, headline: string): boolean => {
  const headlineToken = headline.trim().toLowerCase();
  if (headlineToken.includes('photo') || headlineToken.includes('photographed')) return true;

  return asArray(root.priority_findings).some((item) => {
    const row = asObject(item);
    if (!row) return false;
    const evidence = asArray(row.evidence_region_or_module)
      .map((value) => asString(value))
      .filter(Boolean);
    return evidence.length > 0;
  });
};

export function AnalysisStoryCard({
  payload,
  language,
  onAction,
}: {
  payload: unknown;
  language: Language;
  onAction?: (actionId: string, data?: Record<string, unknown>) => void;
}) {
  const root = asObject(payload) || {};
  const uiCard = asObject(root.ui_card_v1);
  const headline = asString(uiCard?.headline);
  const keyPoints = toStringList(uiCard?.key_points, 6);
  const actionsNow = toStringList(uiCard?.actions_now, 6);
  const avoidNow = toStringList(uiCard?.avoid_now, 6);
  const nextCheckin = asString(uiCard?.next_checkin);
  const photoLed = looksPhotoLed(root, headline);
  const confidenceOverall = formatConfidenceOverall(root.confidence_overall, language);
  const skinProfile = asObject(root.skin_profile);
  const findingLines = asArray(root.priority_findings)
    .map((item) => {
      const row = asObject(item);
      if (!row) return asString(item);
      return buildFindingLine(row);
    })
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  const priorityFindingKeys = findingLines
    .map((line) => canonicalizeFindingText(line))
    .filter(Boolean);
  const currentStrengths = toStringList(skinProfile?.current_strengths, 8).filter((item) => {
    const candidate = canonicalizeFindingText(item);
    if (!candidate) return false;
    return !priorityFindingKeys.some((findingKey) => {
      if (!findingKey) return false;
      if (candidate === findingKey) return true;
      if (candidate.length >= 12 && findingKey.includes(candidate)) return true;
      if (findingKey.length >= 12 && candidate.includes(findingKey)) return true;
      return false;
    });
  });
  const profileBullets = toStringList(
    skinProfile
      ? [
          skinProfile.skin_type_tendency,
          skinProfile.sensitivity_tendency,
          ...currentStrengths,
        ]
      : [],
    8,
  );

  const targetState = toStringList(root.target_state, 6);
  const principles = toStringList(root.core_principles, 8);
  const amPlan = toPlanLines(root.am_plan, 8);
  const pmPlan = toPlanLines(root.pm_plan, 8);
  const timeline = toStringList(root.timeline, 6);
  const safetyNotes = toStringList(root.safety_notes, 6);
  const disclaimer = typeof root.disclaimer_non_medical === 'string' ? root.disclaimer_non_medical.trim() : '';
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">{renderSectionTitle(language, 'Skin analysis', '肤况分析')}</div>
            {headline ? <div className="mt-1 text-sm text-foreground/90">{headline}</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {photoLed ? (
              <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1">
                {renderSectionTitle(language, 'Photo-led', '照片主导')}
              </span>
            ) : null}
            {confidenceOverall ? (
              <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1">
                {renderSectionTitle(language, `Confidence: ${confidenceOverall}`, `置信度：${confidenceOverall}`)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {keyPoints.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {renderSectionTitle(language, 'What stands out', '重点观察')}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {keyPoints.map((item) => (
              <li key={`point_${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {actionsNow.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{renderSectionTitle(language, 'Do now', '现在先做')}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {actionsNow.map((item) => (
              <li key={`action_${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {avoidNow.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{renderSectionTitle(language, 'Hold for now', '暂缓事项')}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {avoidNow.map((item) => (
              <li key={`avoid_${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {nextCheckin ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="text-xs font-medium text-muted-foreground">{renderSectionTitle(language, 'Next check-in', '下次复查')}</div>
          <div className="mt-1 text-sm text-foreground">{nextCheckin}</div>
        </div>
      ) : null}

      {profileBullets.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {renderSectionTitle(language, 'Current profile', '当前画像')}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {profileBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {findingLines.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {renderSectionTitle(language, 'Priority findings', '优先问题')}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {findingLines.map((line, idx) => (
              <li key={`finding_${idx}_${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {targetState.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {renderSectionTitle(language, 'Target state', '目标状态')}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {targetState.map((item) => (
              <li key={`target_${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {principles.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {renderSectionTitle(language, 'Core principles', '关键原则')}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {principles.map((item) => (
              <li key={`principle_${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {amPlan.length || pmPlan.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '早间计划 (AM)' : 'AM plan'}</div>
            {amPlan.length ? (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                {amPlan.map((item) => (
                  <li key={`am_${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">{language === 'CN' ? '暂无 AM 步骤' : 'No AM steps yet.'}</div>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="text-xs font-medium text-muted-foreground">{language === 'CN' ? '晚间计划 (PM)' : 'PM plan'}</div>
            {pmPlan.length ? (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                {pmPlan.map((item) => (
                  <li key={`pm_${item}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">{language === 'CN' ? '暂无 PM 步骤' : 'No PM steps yet.'}</div>
            )}
          </div>
        </div>
      ) : null}

      {timeline.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{renderSectionTitle(language, 'Timeline', '时间线')}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {timeline.map((item) => (
              <li key={`timeline_${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {safetyNotes.length ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{renderSectionTitle(language, 'Safety notes', '安全提示')}</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
            {safetyNotes.map((item) => (
              <li key={`safety_${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className="chip-button text-[11px]"
          onClick={() =>
            onAction?.('chip.aurora.next_action.deep_dive_skin', {
              reply_text: language === 'CN' ? '深入了解我的皮肤状态' : 'Tell me more about my skin',
              trigger_source: 'analysis_story_v2',
            })
          }
        >
          {language === 'CN' ? '深入了解皮肤状态' : 'Dive deeper into skin'}
        </button>
        <button
          type="button"
          className="chip-button text-[11px]"
          onClick={() =>
            onAction?.('chip.aurora.next_action.ingredient_plan', {
              reply_text: language === 'CN' ? '查看成分计划详情' : 'Explain the ingredient plan',
              trigger_source: 'analysis_story_v2',
            })
          }
        >
          {language === 'CN' ? '成分计划详情' : 'Ingredient plan details'}
        </button>
      </div>

      {disclaimer ? <div className="text-[11px] text-muted-foreground">{disclaimer}</div> : null}
    </div>
  );
}
