import { describe, expect, it } from 'vitest';

import { resolveAnalysisSummaryLowConfidence } from '@/lib/analysisSummary';

describe('resolveAnalysisSummaryLowConfidence', () => {
  it('uses backend low_confidence=true with highest priority', () => {
    const lowConfidence = resolveAnalysisSummaryLowConfidence(
      { low_confidence: true, analysis_source: 'rule_based_with_photo_qc' },
      [],
    );
    expect(lowConfidence).toBe(true);
  });

  it('uses backend low_confidence=false with highest priority', () => {
    const lowConfidence = resolveAnalysisSummaryLowConfidence(
      { low_confidence: false, analysis_source: 'baseline_low_confidence' },
      [{ field: 'analysis.currentRoutine' }],
    );
    expect(lowConfidence).toBe(false);
  });

  it('falls back to analysis_source when backend low_confidence is missing', () => {
    const lowConfidence = resolveAnalysisSummaryLowConfidence(
      { analysis_source: 'baseline_low_confidence' },
      [],
    );
    expect(lowConfidence).toBe(true);
  });

  it('falls back to field_missing currentRoutine signal when backend low_confidence is missing', () => {
    const lowConfidence = resolveAnalysisSummaryLowConfidence(
      { analysis_source: 'rule_based_with_photo_qc' },
      [{ field: 'analysis.currentRoutine' }],
    );
    expect(lowConfidence).toBe(true);
  });
});
