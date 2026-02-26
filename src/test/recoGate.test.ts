import { describe, expect, it } from 'vitest';

import { filterRecommendationCardsForState } from '@/lib/recoGate';

describe('recoGate', () => {
  it('keeps recommendation cards outside RECO_* states (answer-first)', () => {
    const cards = [
      { card_id: 'c1', type: 'recommendations', payload: { recommendations: [{ sku_id: 'sku_1' }] } },
      { card_id: 'c2', type: 'info', payload: { ok: true } },
    ];

    const filtered = filterRecommendationCardsForState(cards as any, 'IDLE_CHAT' as any);
    expect(filtered.some((c: any) => c.type === 'recommendations')).toBe(true);
    expect(filtered.some((c: any) => c.type === 'info')).toBe(true);
  });

  it('still keeps recommendation cards in RECO states', () => {
    const cards = [
      { card_id: 'c1', type: 'recommendations', payload: { recommendations: [{ sku_id: 'sku_1' }] } },
      { card_id: 'c2', type: 'info', payload: { ok: true } },
    ];

    const kept = filterRecommendationCardsForState(cards as any, 'RECO_GATE' as any);
    expect(kept.some((c: any) => c.type === 'recommendations')).toBe(true);
    expect(kept.some((c: any) => c.type === 'info')).toBe(true);
  });
});
