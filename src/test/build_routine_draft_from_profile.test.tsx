import { describe, expect, it } from 'vitest';
import { buildRoutineDraftFromProfile, makeEmptyRoutineDraft, hasAnyRoutineDraftInput } from '@/pages/BffChat';
import type { RoutineDraft } from '@/pages/BffChat';

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

  it('returns null for wrong schema_version', () => {
    expect(buildRoutineDraftFromProfile({ schema_version: 'aurora.routine_intake.v1', am: [], pm: [] })).toBeNull();
    expect(buildRoutineDraftFromProfile({ am: [], pm: [] })).toBeNull();
  });

  it('returns null for empty v2 routine (no products)', () => {
    expect(buildRoutineDraftFromProfile({ schema_version: 'aurora.routine_intake.v2', am: [], pm: [] })).toBeNull();
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
    expect(draft!.am.cleanser.text).toBe('CeraVe Hydrating');
    expect(draft!.am.spf.text).toBe('La Roche-Posay SPF 50');
    expect(draft!.pm.treatment.text).toBe('Retinol Serum');
    expect(draft!.pm.moisturizer.text).toBe('Cetaphil Cream');
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
    expect(draft!.am.cleanser.text).toBe('CeraVe Hydrating');
    expect(draft!.pm.treatment.text).toBe('Retinol Serum');
  });

  it('parses object-map routine payloads into slots', () => {
    const draft = buildRoutineDraftFromProfile({
      am: { cleanser: 'Gentle cleanser', spf: 'SPF 50' },
      pm: { treatment: 'Retinol Serum', moisturizer: 'Barrier cream' },
    });
    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser.text).toBe('Gentle cleanser');
    expect(draft!.am.spf.text).toBe('SPF 50');
    expect(draft!.pm.treatment.text).toBe('Retinol Serum');
    expect(draft!.pm.moisturizer.text).toBe('Barrier cream');
  });

  it('parses array routine payloads with slot metadata', () => {
    const draft = buildRoutineDraftFromProfile([
      { slot: 'am', step: 'cleanser', product: 'Gentle cleanser' },
      { slot: 'pm', step: 'treatment', product: 'Retinol Serum' },
    ]);
    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser.text).toBe('Gentle cleanser');
    expect(draft!.pm.treatment.text).toBe('Retinol Serum');
  });

  it('maps "sunscreen" step to spf slot', () => {
    const input = {
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'sunscreen', product: 'Anessa UV' }],
      pm: [],
    };
    const draft = buildRoutineDraftFromProfile(input);
    expect(draft).not.toBeNull();
    expect(draft!.am.spf.text).toBe('Anessa UV');
  });

  it('maps "serum" and "toner" steps to treatment slot', () => {
    const input = {
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'serum', product: 'Vitamin C Serum' }],
      pm: [{ step: 'toner', product: 'Glycolic Toner' }],
    };
    const draft = buildRoutineDraftFromProfile(input);
    expect(draft).not.toBeNull();
    expect(draft!.am.treatment.text).toBe('Vitamin C Serum');
    expect(draft!.pm.treatment.text).toBe('Glycolic Toner');
  });

  it('preserves product_id as resolvedProduct', () => {
    const input = {
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'cleanser', product: 'CeraVe', product_id: 'PID123', sku_id: 'SKU456' }],
      pm: [],
    };
    const draft = buildRoutineDraftFromProfile(input);
    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser.resolvedProduct).not.toBeNull();
    expect(draft!.am.cleanser.resolvedProduct!.product_id).toBe('PID123');
    expect(draft!.am.cleanser.resolvedProduct!.sku_id).toBe('SKU456');
  });

  it('skips entries with missing step or product', () => {
    const input = {
      schema_version: 'aurora.routine_intake.v2',
      am: [
        { step: '', product: 'CeraVe' },
        { step: 'cleanser', product: '' },
        { step: 'spf', product: 'SPF 50' },
      ],
      pm: [],
    };
    const draft = buildRoutineDraftFromProfile(input);
    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser.text).toBe('');
    expect(draft!.am.spf.text).toBe('SPF 50');
  });

  it('skips unrecognized step names', () => {
    const input = {
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'unknown_step', product: 'Product X' }],
      pm: [],
    };
    const draft = buildRoutineDraftFromProfile(input);
    expect(draft).toBeNull();
  });

  it('handles non-array am/pm gracefully — notes-only still returns draft', () => {
    const input = {
      schema_version: 'aurora.routine_intake.v2',
      am: 'not-an-array',
      pm: { cleanser: 'X' },
      notes: 'only notes',
    };
    const draft = buildRoutineDraftFromProfile(input);
    expect(draft).not.toBeNull();
    expect(draft!.notes).toBe('only notes');
    expect(draft!.am.cleanser.text).toBe('');
  });

  it('returns null when am/pm invalid and notes empty', () => {
    const input = {
      schema_version: 'aurora.routine_intake.v2',
      am: 'not-an-array',
      pm: null,
    };
    const draft = buildRoutineDraftFromProfile(input);
    expect(draft).toBeNull();
  });
});

describe('makeEmptyRoutineDraft', () => {
  it('creates empty draft with all slots', () => {
    const draft = makeEmptyRoutineDraft();
    expect(draft.am.cleanser.text).toBe('');
    expect(draft.am.spf.text).toBe('');
    expect(draft.pm.treatment.text).toBe('');
    expect(draft.notes).toBe('');
  });
});

describe('hasAnyRoutineDraftInput', () => {
  it('returns false for empty draft', () => {
    expect(hasAnyRoutineDraftInput(makeEmptyRoutineDraft())).toBe(false);
  });

  it('returns true when am has input', () => {
    const draft = makeEmptyRoutineDraft();
    draft.am.cleanser = { text: 'CeraVe', resolvedProduct: null };
    expect(hasAnyRoutineDraftInput(draft)).toBe(true);
  });

  it('returns true when notes has input', () => {
    const draft = makeEmptyRoutineDraft();
    draft.notes = 'some notes';
    expect(hasAnyRoutineDraftInput(draft)).toBe(true);
  });
});
