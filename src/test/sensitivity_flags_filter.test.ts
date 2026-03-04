import { describe, expect, it } from 'vitest';

import { filterContradictoryFragranceFlags } from '@/lib/sensitivityFlags';

describe('filterContradictoryFragranceFlags', () => {
  it('drops short fragrance token when fragrance-free descriptive flag exists', () => {
    const out = filterContradictoryFragranceFlags([
      'high_irritation',
      'fragrance',
      'No added fragrance listed (INCIdecoder)',
    ]);
    expect(out).toEqual(['high_irritation', 'No added fragrance listed (INCIdecoder)']);
  });

  it('keeps fragrance token when no fragrance-free descriptive signal exists', () => {
    const out = filterContradictoryFragranceFlags(['fragrance', 'strong_acid']);
    expect(out).toEqual(['fragrance', 'strong_acid']);
  });

  it('supports CN fragrance-free descriptive signals', () => {
    const out = filterContradictoryFragranceFlags(['fragrance', '无香精配方']);
    expect(out).toEqual(['无香精配方']);
  });
});
