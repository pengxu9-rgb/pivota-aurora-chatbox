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

  it('parses object-map routine payloads', () => {
    const result = extractRoutineProductsFromProfileCurrentRoutine({
      am: { cleanser: 'Gentle cleanser', spf: 'SPF 50' },
      pm: { treatment: 'Retinol Serum' },
    });

    expect(result.map((item) => item.name)).toEqual(['Gentle cleanser', 'SPF 50', 'Retinol Serum']);
  });

  it('parses array routine payloads with slot metadata', () => {
    const result = extractRoutineProductsFromProfileCurrentRoutine([
      { slot: 'am', step: 'cleanser', product: 'Gentle cleanser' },
      { slot: 'pm', step: 'treatment', product: 'Retinol Serum' },
    ]);

    expect(result.map((item) => item.name)).toEqual(['Gentle cleanser', 'Retinol Serum']);
  });

  it('returns empty for invalid payload', () => {
    expect(extractRoutineProductsFromProfileCurrentRoutine('not-json')).toEqual([]);
    expect(extractRoutineProductsFromProfileCurrentRoutine(null)).toEqual([]);
    expect(extractRoutineProductsFromProfileCurrentRoutine({})).toEqual([]);
  });
});
