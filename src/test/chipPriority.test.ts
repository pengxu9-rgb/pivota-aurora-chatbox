import { describe, expect, it } from 'vitest';

import { classifyChipPriority, prioritizeChips } from '@/components/prompt/chipPriority';
import type { SuggestedChip } from '@/lib/pivotaAgentBff';

const mkChip = (chip_id: string, label: string): SuggestedChip => ({ chip_id, label, kind: 'quick_reply', data: {} });

describe('chipPriority', () => {
  it('classifies continue as primary and skip as skip-like in a mixed list', () => {
    const chips = [
      mkChip('chip.start.reco_products', 'See product recommendations'),
      mkChip('chip.intake.skip_analysis', 'Skip and analyze'),
    ];

    const prioritized = prioritizeChips(chips);

    expect(prioritized.primaryChip?.chip_id).toBe('chip.start.reco_products');
    expect(prioritized.skipChip?.chip_id).toBe('chip.intake.skip_analysis');
    expect(prioritized.neutralChips).toHaveLength(0);
  });

  it('selects only one strongest primary when multiple primary-like chips exist', () => {
    const chips = [
      mkChip('chip.action.next', 'Next'),
      mkChip('chip.action.analysis', 'Analyze now'),
      mkChip('chip.action.recommend', 'Recommend products'),
    ];

    const prioritized = prioritizeChips(chips);

    expect(prioritized.primaryChip?.chip_id).toBe('chip.action.recommend');
    expect(prioritized.neutralChips.map((chip) => chip.chip_id)).toEqual(['chip.action.next', 'chip.action.analysis']);
  });

  it('supports CN labels by using id-first matching', () => {
    const primary = mkChip('chip.start.reco_products', '查看推荐');
    const skip = mkChip('chip.intake.skip_analysis', '稍后再说');

    expect(classifyChipPriority(primary)).toBe('primary');
    expect(classifyChipPriority(skip)).toBe('skip');
  });

  it('is null-safe for empty lists and malformed chips', () => {
    const empty = prioritizeChips(undefined);
    expect(empty.primaryChip).toBeNull();
    expect(empty.skipChip).toBeNull();
    expect(empty.neutralChips).toHaveLength(0);

    const malformed = classifyChipPriority({ chip_id: undefined as any, label: null as any });
    expect(malformed).toBe('neutral');
  });
});

