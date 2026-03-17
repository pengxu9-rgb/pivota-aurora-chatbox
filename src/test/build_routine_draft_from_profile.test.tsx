import { describe, expect, it } from 'vitest';

import {
  buildCurrentRoutinePayloadFromDraft,
  buildRoutineDraftFromProfile,
  hasAnyRoutineDraftInput,
  makeEmptyRoutineDraft,
} from '@/pages/BffChat';

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

  it('maps sunscreen step to spf slot', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'sunscreen', product: 'Anessa UV' }],
      pm: [],
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.spf.text).toBe('Anessa UV');
  });

  it('maps first treatment-like step to treatment slot and keeps the rest as extra rows', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [
        { step: 'serum', product: 'Vitamin C Serum' },
        { step: 'essence', product: 'Ferment Essence' },
      ],
      pm: [
        { step: 'toner', product: 'Glycolic Toner' },
        { step: 'ampoule', product: 'Calming Ampoule' },
      ],
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.treatment.text).toBe('Vitamin C Serum');
    expect(draft!.pm.treatment.text).toBe('Glycolic Toner');
    expect(draft!.amExtra).toHaveLength(1);
    expect(draft!.amExtra[0].step).toBe('essence');
    expect(draft!.amExtra[0].fieldValue.text).toBe('Ferment Essence');
    expect(draft!.pmExtra).toHaveLength(1);
    expect(draft!.pmExtra[0].step).toBe('ampoule');
    expect(draft!.pmExtra[0].fieldValue.text).toBe('Calming Ampoule');
  });

  it('keeps product binding metadata when present', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'cleanser', product: 'CeraVe', product_id: 'PID123', sku_id: 'SKU456' }],
      pm: [],
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser.text).toBe('CeraVe');
    expect(draft!.am.cleanser.resolvedProduct?.product_id).toBe('PID123');
    expect(draft!.am.cleanser.resolvedProduct?.sku_id).toBe('SKU456');
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
    expect(draft!.am.cleanser.text).toBe('');
    expect(draft!.am.spf.text).toBe('SPF 50');
  });

  it('keeps unrecognized step names as custom extra rows', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [{ step: 'unknown_step', product: 'Product X' }],
      pm: [],
    });

    expect(draft).not.toBeNull();
    expect(draft!.amExtra).toHaveLength(1);
    expect(draft!.amExtra[0].step).toBe('other');
    expect(draft!.amExtra[0].customStepLabel).toBe('unknown_step');
    expect(draft!.amExtra[0].fieldValue.text).toBe('Product X');
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
    expect(draft!.am.cleanser.text).toBe('');
    expect(draft!.pm.cleanser.text).toBe('X');
  });

  it('keeps duplicate or custom steps in extra rows', () => {
    const draft = buildRoutineDraftFromProfile({
      schema_version: 'aurora.routine_intake.v2',
      am: [
        { step: 'cleanser', product: 'Milk cleanser' },
        { step: 'cleanser', product: 'Powder cleanser' },
        { step: 'other', step_label: 'Peptide mist', product: 'Custom peptide mist' },
      ],
      pm: [],
    });

    expect(draft).not.toBeNull();
    expect(draft!.am.cleanser.text).toBe('Milk cleanser');
    expect(draft!.amExtra).toHaveLength(2);
    expect(draft!.amExtra[0].step).toBe('other');
    expect(draft!.amExtra[0].customStepLabel).toBe('cleanser');
    expect(draft!.amExtra[0].fieldValue.text).toBe('Powder cleanser');
    expect(draft!.amExtra[1].step).toBe('other');
    expect(draft!.amExtra[1].customStepLabel).toBe('Peptide mist');
    expect(draft!.amExtra[1].fieldValue.text).toBe('Custom peptide mist');
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
    expect(draft.am.cleanser.text).toBe('');
    expect(draft.am.spf.text).toBe('');
    expect(draft.pm.treatment.text).toBe('');
    expect(draft.amExtra).toEqual([]);
    expect(draft.pmExtra).toEqual([]);
    expect(draft.notes).toBe('');
  });
});

describe('hasAnyRoutineDraftInput', () => {
  it('returns false for empty draft', () => {
    expect(hasAnyRoutineDraftInput(makeEmptyRoutineDraft())).toBe(false);
  });

  it('returns true when am has input', () => {
    const draft = makeEmptyRoutineDraft();
    draft.am.cleanser.text = 'CeraVe';
    expect(hasAnyRoutineDraftInput(draft)).toBe(true);
  });

  it('returns true when notes has input', () => {
    const draft = makeEmptyRoutineDraft();
    draft.notes = 'some notes';
    expect(hasAnyRoutineDraftInput(draft)).toBe(true);
  });
});

describe('buildCurrentRoutinePayloadFromDraft', () => {
  it('emits v2 payload with extra rows and product binding metadata', () => {
    const draft = makeEmptyRoutineDraft();
    draft.am.cleanser = {
      text: 'CeraVe Foaming Cleanser',
      resolvedProduct: { product_id: 'PID123', sku_id: 'SKU123', display_name: 'CeraVe Foaming Cleanser' },
    };
    draft.amExtra.push({
      id: 'extra_1',
      step: 'essence',
      customStepLabel: '',
      fieldValue: { text: 'SK-II Facial Treatment Essence', resolvedProduct: null },
    });
    draft.pmExtra.push({
      id: 'extra_2',
      step: 'other',
      customStepLabel: 'Peptide mist',
      fieldValue: { text: 'Custom peptide mist', resolvedProduct: null },
    });

    const payload = buildCurrentRoutinePayloadFromDraft(draft);

    expect(payload.schema_version).toBe('aurora.routine_intake.v2');
    expect(payload.am[0]).toMatchObject({
      step: 'cleanser',
      product: 'CeraVe Foaming Cleanser',
      product_id: 'PID123',
      sku_id: 'SKU123',
    });
    expect(payload.am[1]).toMatchObject({
      step: 'essence',
      product: 'SK-II Facial Treatment Essence',
    });
    expect(payload.pm[0]).toMatchObject({
      step: 'other',
      step_label: 'Peptide mist',
      product: 'Custom peptide mist',
    });
  });
});
