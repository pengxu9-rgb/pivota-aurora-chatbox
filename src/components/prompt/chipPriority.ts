import type { SuggestedChip } from '@/lib/pivotaAgentBff';

export type ChipPriorityKind = 'primary' | 'skip' | 'neutral';

type MatchSource = 'id' | 'label' | 'none';

export type ChipPriorityMeta = {
  chip: SuggestedChip;
  index: number;
  priority: ChipPriorityKind;
  primaryScore: number;
  matchedBy: MatchSource;
};

export type PrioritizedChips = {
  primaryChip: SuggestedChip | null;
  skipChip: SuggestedChip | null;
  neutralChips: SuggestedChip[];
  meta: ChipPriorityMeta[];
};

const PRIMARY_CUES = {
  recommend: ['recommend', 'reco', 'results', 'show products', 'show recommendations', 'complete profile'],
  analyze: ['analyze', 'analysis', 'evaluate', 'scan', 'deep scan', '分析', '评估', '检测'],
  submit: ['submit', 'confirm', 'save', 'done', '完成', '提交', '确认'],
  continue: ['continue', 'keep going', 'go on', '继续'],
  next: ['next', '下一步', '下一个'],
} as const;

const SKIP_CUES = [
  'skip',
  'not now',
  'not_now',
  'later',
  'baseline',
  'without',
  'continue without',
  'continue_without',
  'no thanks',
  '稍后',
  '跳过',
  '先这样',
  '不用',
  '不需要',
] as const;

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hasAnyCue = (text: string, cues: readonly string[]): boolean => cues.some((cue) => text.includes(cue));

const primaryScoreFromText = (text: string): number => {
  if (!text) return 0;
  if (hasAnyCue(text, PRIMARY_CUES.recommend)) return 500;
  if (hasAnyCue(text, PRIMARY_CUES.analyze)) return 400;
  if (hasAnyCue(text, PRIMARY_CUES.submit)) return 320;
  if (hasAnyCue(text, PRIMARY_CUES.continue)) return 220;
  if (hasAnyCue(text, PRIMARY_CUES.next)) return 120;
  return 0;
};

const classifyText = (
  idText: string,
  labelText: string,
): { priority: ChipPriorityKind; score: number; matchedBy: MatchSource } => {
  if (hasAnyCue(idText, SKIP_CUES)) return { priority: 'skip', score: 0, matchedBy: 'id' };

  const idPrimaryScore = primaryScoreFromText(idText);
  if (idPrimaryScore > 0) return { priority: 'primary', score: idPrimaryScore, matchedBy: 'id' };

  if (hasAnyCue(labelText, SKIP_CUES)) return { priority: 'skip', score: 0, matchedBy: 'label' };

  const labelPrimaryScore = primaryScoreFromText(labelText);
  if (labelPrimaryScore > 0) return { priority: 'primary', score: labelPrimaryScore, matchedBy: 'label' };

  return { priority: 'neutral', score: 0, matchedBy: 'none' };
};

export const classifyChipPriority = (chip: Partial<SuggestedChip> | null | undefined): ChipPriorityKind => {
  const idText = normalizeText(chip?.chip_id);
  const labelText = normalizeText(chip?.label);
  return classifyText(idText, labelText).priority;
};

export const prioritizeChips = (chips: SuggestedChip[] | null | undefined): PrioritizedChips => {
  const safeChips = Array.isArray(chips) ? chips.filter(Boolean) : [];

  const meta = safeChips.map((chip, index) => {
    const idText = normalizeText(chip?.chip_id);
    const labelText = normalizeText(chip?.label);
    const classified = classifyText(idText, labelText);
    return {
      chip,
      index,
      priority: classified.priority,
      primaryScore: classified.score,
      matchedBy: classified.matchedBy,
    } satisfies ChipPriorityMeta;
  });

  const primaryCandidates = meta.filter((entry) => entry.priority === 'primary');
  const selectedPrimary =
    primaryCandidates.length > 0
      ? [...primaryCandidates].sort((a, b) => {
          if (b.primaryScore !== a.primaryScore) return b.primaryScore - a.primaryScore;
          return a.index - b.index;
        })[0]
      : null;

  const skipCandidates = meta.filter((entry) => entry.priority === 'skip');
  const selectedSkip = skipCandidates.length > 0 ? skipCandidates[0] : null;

  const removeIndexes = new Set<number>();
  if (selectedPrimary) removeIndexes.add(selectedPrimary.index);
  skipCandidates.forEach((entry) => removeIndexes.add(entry.index));

  const neutralChips = safeChips.filter((_chip, index) => !removeIndexes.has(index));

  return {
    primaryChip: selectedPrimary ? selectedPrimary.chip : null,
    skipChip: selectedSkip ? selectedSkip.chip : null,
    neutralChips,
    meta,
  };
};

