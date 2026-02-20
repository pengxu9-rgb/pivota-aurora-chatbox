import { describe, expect, it } from 'vitest';

import { analyzeCompatibility } from '@/lib/routineCompatibility/engine';
import { tagIngredientFamilies } from '@/lib/routineCompatibility/tagger';

describe('routineCompatibility engine', () => {
  it('acids + retinoid => avoid_same_routine', () => {
    const base = tagIngredientFamilies({
      id: 'base_acid',
      name: 'AHA Serum',
      ingredients: ['Glycolic Acid', 'Panthenol'],
      source: 'base',
    });
    const other = tagIngredientFamilies({
      id: 'other_retinoid',
      name: 'Retinol Serum',
      ingredients: ['Retinol', 'Squalane'],
      source: 'routine',
    });

    const result = analyzeCompatibility(base, [other], { sensitivity: 'Medium', timing: 'Both', language: 'EN' });
    expect(result.rating).toBe('avoid_same_routine');
    expect(result.reasons.join(' ')).toMatch(/retinoid|acid/i);
  });

  it('hydrator + moisturizer => good', () => {
    const base = tagIngredientFamilies({
      id: 'base_hydrator',
      name: 'Hydrating Serum',
      ingredients: ['Glycerin', 'Sodium Hyaluronate'],
      source: 'base',
    });
    const other = tagIngredientFamilies({
      id: 'other_moisturizer',
      name: 'Barrier Moisturizer',
      ingredients: ['Ceramide NP', 'Cholesterol', 'Fatty Acid'],
      source: 'routine',
    });

    const result = analyzeCompatibility(base, [other], { sensitivity: 'Medium', timing: 'Both', language: 'EN' });
    expect(result.rating).toBe('good');
  });

  it('acids + acids => caution', () => {
    const base = tagIngredientFamilies({
      id: 'base_acid_1',
      name: 'Exfoliating Toner',
      ingredients: ['Lactic Acid'],
      source: 'base',
    });
    const other = tagIngredientFamilies({
      id: 'base_acid_2',
      name: 'BHA Serum',
      ingredients: ['Salicylic Acid'],
      source: 'routine',
    });

    const result = analyzeCompatibility(base, [other], { sensitivity: 'Medium', timing: 'PM', language: 'EN' });
    expect(result.rating).toBe('caution');
    expect(result.reasons.join(' ')).toMatch(/acid/i);
  });

  it('high sensitivity => caution', () => {
    const base = tagIngredientFamilies({
      id: 'base_simple',
      name: 'Hydration Essence',
      ingredients: ['Glycerin', 'Panthenol'],
      source: 'base',
    });
    const other = tagIngredientFamilies({
      id: 'other_simple',
      name: 'Moisturizer',
      ingredients: ['Ceramide NP'],
      source: 'routine',
    });

    const result = analyzeCompatibility(base, [other], { sensitivity: 'High', timing: 'Both', language: 'EN' });
    expect(result.rating).toBe('caution');
    expect(result.reasons.join(' ')).toMatch(/sensitivity/i);
  });
});
