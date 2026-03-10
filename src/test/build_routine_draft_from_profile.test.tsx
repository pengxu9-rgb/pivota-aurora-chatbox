import { describe, expect, it } from 'vitest';

import { buildRoutineDraftFromProfile, makeEmptyRoutineDraft, hasAnyRoutineDraftInput } from '@/pages/BffChat';

describe('buildRoutineDraftFromProfile', () => {
  it('returns null for null/undefined input', () => {
    expect(buildRoutineDraftFromProfile(null)).toBeNull();
    expect(buildRoutineDraftFromProfile(undefined)).toBeNull();
  });

  it('returns null for invalid non-routine input', () => {
    expect(buildRoutineDraftFromProfile('string')).toBeNull();
    expect(buildRoutineDraftFromProfile(42)).toBeNull();
    expect(buildRoutineDraftFromProfile([])).toBeNull();
  });

  it('returns null for empty routine payloads', () => {
    expect(buildRoutineDraftFromProfile({ schema_version: 'aurora.routine_intake.v1', am: [], pm: [] })).toBeNull();
    expect(buildRoutineDraftFromProfile({ schema_version: 'aurora.routine_intake.v2', am: [], pm: [] })).toBeNull();
    expect(buildRoutineDraftFromProfile({ am: [], pm: [] })).toBeNull();
  });

  it('parses valid v2 routine with am/pm steps', () => {
    const input = {
      schema_version: 'aurora.routine_intake.v2',
      am: [
        { step: 'cleanser', product: 'CeraVe Hydrating' },
        { step: 'spf', product: 'La Roche-Posay SPF 50' },
      ],
      pm: [
        { step: 'treatment', product: 'Retinol Serum' },
        { step: 'moisturizer', product: 'Cetaphil Cream' },
      ],
      notes: 'Added retinol 2 weeks ago',
    };

    const draft = buildRoutineDraftFromProfile(input);
    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser).toBe('CeraVe Hydrating');
    expect(draft!.am.spf).toBe('La Roche-Posay SPF 50');
    expect(draft!.pm.treatment).toBe('Retinol Serum');
    expect(draft!.pm.moisturizer).toBe('Cetaphil Cream');
    expect(draft!.notes).toBe('Added retinol 2 weeks ago');
  });

  it('parses JSON-string routine payloads', () => {
    const draft = buildRoutineDraftFromProfile(
      JSON.stringify({
        schema_version: 'aurora.routine_intake.v2',
        am: [{ step: 'cleanser', product: 'CeraVe Hydrating' }],
        pm: [{ step: 'treatment', product: 'Retinol Serum' }],
      }),
    );

    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser).toBe('CeraVe Hydrating');
    expect(draft!.pm.treatment).toBe('Retinol Serum');
  });

  it('parses object-map routine payloads into slots', () => {
    const draft = buildRoutineDraftFromProfile({
      am: { cleanser: 'Gentle cleanser', spf: 'SPF 50' },
      pm: { treatment: 'Retinol Serum', moisturizer: 'Barrier cream' },
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser).toBe('Gentle cleanser');
    expect(draft!.am.spf).toBe('SPF 50');
    expect(draft!.pm.treatment).toBe('Retinol Serum');
    expect(draft!.pm.moisturizer).toBe('Barrier cream');
  });

  it('parses array routine payloads with slot metadata', () => {
    const draft = buildRoutineDraftFromProfile([
      { slot: 'am', step: 'cleanser', product: 'Gentle cleanser' },
      { slot: 'pm', step: 'treatment', product: 'Retinol Serum' },
    ]);

    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser).toBe('Gentle cleanser');
    expect(draft!.pm.treatment).toBe('Retinol Serum');
  });

  it('maps sunscreen step to spf slot', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'sunscreen', product: 'Anessa UV' }],
      pm: [],
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.spf).toBe('Anessa UV');
  });

  it('maps serum and toner steps to treatment slot', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'serum', product: 'Vitamin C Serum' }],
      pm: [{ step: 'toner', product: 'Glycolic Toner' }],
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.treatment).toBe('Vitamin C Serum');
    expect(draft!.pm.treatment).toBe('Glycolic Toner');
  });

  it('ignores metadata fields that do not affect draft text', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'cleanser', product: 'CeraVe', product_id: 'PID123', sku_id: 'SKU456' }],
      pm: [],
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser).toBe('CeraVe');
  });

  it('skips entries with missing step or product', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [
        { step: '', product: 'CeraVe' },
        { step: 'cleanser', product: '' },
        { step: 'spf', product: 'SPF 50' },
      ],
      pm: [],
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser).toBe('');
    expect(draft!.am.spf).toBe('SPF 50');
  });

  it('returns null for only unrecognized step names', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'unknown_step', product: 'Product X' }],
      pm: [],
    });

    expect(draft).toBeNull();
  });

  it('handles notes-only input gracefully', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: 'not-an-array',
      pm: { cleanser: 'X' },
      notes: 'only notes',
    });

    expect(draft).not.toBeNull();
    expect(draft!.notes).toBe('only notes');
    expect(draft!.am.cleanser).toBe('');
    expect(draft!.pm.cleanser).toBe('X');
  });

  it('returns null when content is empty after normalization', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: 'not-an-array',
      pm: null,
    });

    expect(draft).toBeNull();
  });
});

describe('makeEmptyRoutineDraft', () => {
  it('creates empty draft with all slots', () => {
    const draft = makeEmptyRoutineDraft();
    expect(draft.am.cleanser).toBe('');
    expect(draft.am.spf).toBe('');
    expect(draft.pm.treatment).toBe('');
    expect(draft.notes).toBe('');
  });
});

describe('hasAnyRoutineDraftInput', () => {
  it('returns false for empty draft', () => {
    expect(hasAnyRoutineDraftInput(makeEmptyRoutineDraft())).toBe(false);
  });

  it('returns true when am has input', () => {
    const draft = makeEmptyRoutineDraft();
    draft.am.cleanser = 'CeraVe';
    expect(hasAnyRoutineDraftInput(draft)).toBe(true);
  });

  it('returns true when notes has input', () => {
    const draft = makeEmptyRoutineDraft();
    draft.notes = 'some notes';
    expect(hasAnyRoutineDraftInput(draft)).toBe(true);
  });
});
