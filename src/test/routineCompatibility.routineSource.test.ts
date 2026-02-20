import { describe, expect, it } from 'vitest';

import { extractRoutineProductsFromProfileCurrentRoutine } from '@/lib/routineCompatibility/routineSource';

describe('extractRoutineProductsFromProfileCurrentRoutine', () => {
  it('parses object routine shape', () => {
    const result = extractRoutineProductsFromProfileCurrentRoutine({
      am: [{ step: 'cleanser', product: 'CeraVe Foaming Cleanser' }],
      pm: [{ step: 'treatment', product: 'Retinol Serum' }],
    });

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.name)).toEqual(['CeraVe Foaming Cleanser', 'Retinol Serum']);
  });

  it('parses JSON string and dedupes names', () => {
    const result = extractRoutineProductsFromProfileCurrentRoutine(
      JSON.stringify({
        am: [{ step: 'cleanser', product: 'Same Product' }],
        pm: [{ step: 'moisturizer', product: 'Same Product' }],
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Same Product');
  });

  it('returns empty for invalid payload', () => {
    expect(extractRoutineProductsFromProfileCurrentRoutine('not-json')).toEqual([]);
    expect(extractRoutineProductsFromProfileCurrentRoutine(null)).toEqual([]);
    expect(extractRoutineProductsFromProfileCurrentRoutine({})).toEqual([]);
  });
});
