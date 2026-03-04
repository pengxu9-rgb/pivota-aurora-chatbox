import { describe, expect, it } from 'vitest';

import { canonicalizeChipId, inferTextExplicitTransition, validateRequestedTransition } from '@/lib/agentStateMachine';

describe('agentStateMachine: inferTextExplicitTransition', () => {
  it('does not treat generic CN "诊断" as diagnosis start', () => {
    const inferred = inferTextExplicitTransition('请诊断一下这款产品适不适合我', 'CN');
    expect(inferred).toBeNull();
  });

  it('treats explicit CN skin diagnosis phrases as diagnosis start', () => {
    const inferred = inferTextExplicitTransition('开始皮肤诊断', 'CN');
    expect(inferred?.requested_next_state).toBe('DIAG_PROFILE');
  });

  it('treats explicit EN diagnosis phrases as diagnosis start even when lang=CN', () => {
    const inferred = inferTextExplicitTransition('Start diagnosis', 'CN');
    expect(inferred?.requested_next_state).toBe('DIAG_PROFILE');
  });

  it('treats explicit EN diagnosis phrases as diagnosis start (lang=EN)', () => {
    const inferred = inferTextExplicitTransition('Please diagnose my skin', 'EN');
    expect(inferred?.requested_next_state).toBe('DIAG_PROFILE');
  });

  it('does not treat non-skin EN "diagnose" usage as diagnosis start', () => {
    const inferred = inferTextExplicitTransition('Can you diagnose this product?', 'EN');
    expect(inferred).toBeNull();
  });
});

describe('agentStateMachine: validateRequestedTransition', () => {
  it('allows PRODUCT_LINK_EVAL -> RECO_GATE for text_explicit', () => {
    const validation = validateRequestedTransition({
      from_state: 'PRODUCT_LINK_EVAL',
      trigger_source: 'text_explicit',
      trigger_id: 'recommend some product',
      requested_next_state: 'RECO_GATE',
    });
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.next_state).toBe('RECO_GATE');
    }
  });

  it('allows chip.intake.upload_photos from DIAG_PROFILE -> DIAG_PHOTO_OPTIN', () => {
    const validation = validateRequestedTransition({
      from_state: 'DIAG_PROFILE',
      trigger_source: 'chip',
      trigger_id: 'chip.intake.upload_photos',
      requested_next_state: 'DIAG_PHOTO_OPTIN',
    });
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.next_state).toBe('DIAG_PHOTO_OPTIN');
    }
  });

  it('allows chip.intake.skip_analysis from DIAG_PROFILE -> DIAG_ANALYSIS_SUMMARY', () => {
    const validation = validateRequestedTransition({
      from_state: 'DIAG_PROFILE',
      trigger_source: 'chip',
      trigger_id: 'chip.intake.skip_analysis',
      requested_next_state: 'DIAG_ANALYSIS_SUMMARY',
    });
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.next_state).toBe('DIAG_ANALYSIS_SUMMARY');
    }
  });

  it('allows chip.intake.skip_analysis from DIAG_PHOTO_OPTIN -> DIAG_ANALYSIS_SUMMARY', () => {
    const validation = validateRequestedTransition({
      from_state: 'DIAG_PHOTO_OPTIN',
      trigger_source: 'chip',
      trigger_id: 'chip.intake.skip_analysis',
      requested_next_state: 'DIAG_ANALYSIS_SUMMARY',
    });
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.next_state).toBe('DIAG_ANALYSIS_SUMMARY');
    }
  });

  it('allows action transition from DIAG_PROFILE -> RECO_GATE', () => {
    const validation = validateRequestedTransition({
      from_state: 'DIAG_PROFILE',
      trigger_source: 'action',
      trigger_id: 'analysis_get_recommendations',
      requested_next_state: 'RECO_GATE',
    });
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.next_state).toBe('RECO_GATE');
    }
  });
});

describe('agentStateMachine: chip.intake.* aliases', () => {
  it('canonicalizes chip.intake.upload_photos to chip_intake_upload_photos', () => {
    expect(canonicalizeChipId('chip.intake.upload_photos')).toBe('chip_intake_upload_photos');
  });

  it('canonicalizes chip.intake.skip_analysis to chip_intake_skip_analysis', () => {
    expect(canonicalizeChipId('chip.intake.skip_analysis')).toBe('chip_intake_skip_analysis');
  });
});
