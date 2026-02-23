function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveAnalysisSummaryLowConfidence(
  payload: Record<string, unknown>,
  fieldMissing: unknown[],
): boolean {
  const payloadLowConfidence = payload && (payload as any).low_confidence;
  if (payloadLowConfidence === true) return true;
  if (payloadLowConfidence === false) return false;

  const analysisSource = asString((payload as any).analysis_source);
  if (analysisSource === 'baseline_low_confidence') return true;

  const missing = Array.isArray(fieldMissing) ? fieldMissing : [];
  return missing.some((m) => String((m as any)?.field || '').toLowerCase().includes('currentroutine'));
}
