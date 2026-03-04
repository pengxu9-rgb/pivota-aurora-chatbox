import React from 'react';

import type { Language } from '@/lib/types';

type Dict = Record<string, unknown>;
export type AnalysisStoryShortlistItem = Record<string, unknown>;

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

const mapRoutineBridgeAction = (rawAction: string): string => {
  const token = String(rawAction || '').trim().toLowerCase();
  if (!token) return '';
  if (token === 'open_routine_intake') return 'chip.start.routine';
  if (token === 'routine_generate') return 'chip.start.routine';
  return String(rawAction || '').trim();
};

function OptimizationList({
  language,
  titleEn,
  titleCn,
  items,
}: {
  language: Language;
  titleEn: string;
  titleCn: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{renderSectionTitle(language, titleEn, titleCn)}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={`${titleEn}_${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisStoryCard({
  payload,
  language,
  onAction,
  recoShortlist,
  onOpenSimilarProducts,
}: {
  payload: unknown;
  language: Language;
  onAction?: (actionId: string, data?: Record<string, unknown>) => void;
  recoShortlist?: AnalysisStoryShortlistItem[];
  onOpenSimilarProducts?: (item: AnalysisStoryShortlistItem) => void;
}) {
  const root = asObject(payload) || {};
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

  const optimization = asObject(root.existing_products_optimization);
  const keepList = toStringList(optimization?.keep, 6);
  const addList = toStringList(optimization?.add, 6);
  const replaceList = toStringList(optimization?.replace, 6);
  const removeList = toStringList(optimization?.remove, 6);

  const bridge = asObject(root.routine_bridge);
  const ctaText =
    asString(bridge?.cta_text) ||
    asString(bridge?.cta_label) ||
    (language === 'CN' ? '补全 AM/PM routine' : 'Complete AM/PM routine');
  const actionId = asString(bridge?.action_id) || mapRoutineBridgeAction(asString(bridge?.cta_action)) || 'chip.start.routine';
  const replyText =
    asString(bridge?.reply_text) ||
    (language === 'CN'
      ? '我来补全 AM/PM routine，再给我个性化产品建议。'
      : 'Let me complete AM/PM routine, then give me personalized product recommendations.');
  const bridgeWhyNow = asString(bridge?.why_now);
  const bridgeMissing = toStringList(bridge?.missing_fields, 8);
  const shortlistItems = asArray(recoShortlist).map(asObject).filter(Boolean).slice(0, 2) as Dict[];

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="text-sm font-semibold text-foreground">
          {renderSectionTitle(language, 'Personalized skin analysis', '个性化肤况分析')}
        </div>
        {confidenceOverall ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {renderSectionTitle(language, `Confidence: ${confidenceOverall}`, `置信度：${confidenceOverall}`)}
          </div>
        ) : null}
      </div>

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

      {optimization ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="text-xs font-medium text-muted-foreground">
            {renderSectionTitle(language, 'Optimize your existing products', '现有产品优化建议')}
          </div>
          <OptimizationList language={language} titleEn="Keep" titleCn="保留" items={keepList} />
          <OptimizationList language={language} titleEn="Add" titleCn="新增" items={addList} />
          <OptimizationList language={language} titleEn="Replace" titleCn="替换" items={replaceList} />
          <OptimizationList language={language} titleEn="Remove" titleCn="移除" items={removeList} />
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

      {bridgeWhyNow || bridgeMissing.length ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="text-xs font-semibold text-foreground">
            {renderSectionTitle(language, 'Next best step', '下一步建议')}
          </div>
          {bridgeWhyNow ? <div className="mt-1 text-sm text-muted-foreground">{bridgeWhyNow}</div> : null}
          {bridgeMissing.length ? (
            <div className="mt-1 text-xs text-muted-foreground">
              {(language === 'CN' ? '待补充：' : 'Missing: ') + bridgeMissing.join(', ')}
            </div>
          ) : null}
          <button
            type="button"
            className="mt-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
            onClick={() => onAction?.(actionId, { reply_text: replyText, trigger_source: 'analysis_story_v2' })}
          >
            {ctaText}
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="text-xs font-semibold text-muted-foreground">
          {renderSectionTitle(language, 'Product next step', '产品下一步')}
        </div>
        {shortlistItems.length ? (
          <div className="mt-2 space-y-2">
            {shortlistItems.map((item, idx) => {
              const name =
                asString(item.name) ||
                asString(item.title) ||
                asString((item as any).display_name) ||
                asString((item as any).displayName) ||
                (language === 'CN' ? `候选产品 ${idx + 1}` : `Candidate ${idx + 1}`);
              const brand = asString(item.brand);
              const priceLabel = asString((item as any).price_label) || asString((item as any).priceLabel);
              return (
                <div key={`shortlist_${idx}_${name}`} className="rounded-lg border border-border/50 bg-background/70 p-2">
                  <div className="text-sm font-medium text-foreground">{brand ? `${brand} · ${name}` : name}</div>
                  {priceLabel ? <div className="text-xs text-muted-foreground">{priceLabel}</div> : null}
                  <button
                    type="button"
                    className="chip-button mt-2 text-[11px]"
                    onClick={() => onOpenSimilarProducts?.(item)}
                  >
                    {language === 'CN' ? '类似产品' : 'Similar products'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 text-xs text-muted-foreground">
            {renderSectionTitle(
              language,
              'No shortlist yet. Tap below to generate recommendations.',
              '暂无短名单，点击下方生成推荐。',
            )}
          </div>
        )}
        <button
          type="button"
          className="chip-button chip-button-primary mt-3"
          onClick={() => onAction?.('analysis_get_recommendations', { trigger_source: 'analysis_story_v2' })}
        >
          {language === 'CN' ? '查看产品推荐' : 'See product recommendations'}
        </button>
      </div>

      {disclaimer ? <div className="text-[11px] text-muted-foreground">{disclaimer}</div> : null}
    </div>
  );
}
