export type NormalizedPhotoQcStatus = 'passed' | 'degraded' | 'failed' | 'pending' | 'unknown';

export function normalizePhotoQcStatus(value: unknown): NormalizedPhotoQcStatus {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'unknown';

  if (raw === 'passed' || raw === 'pass' || raw === 'ok') return 'passed';
  if (raw === 'degraded' || raw === 'warn' || raw === 'warning' || raw === 'low') return 'degraded';
  if (raw === 'fail' || raw === 'failed' || raw === 'reject' || raw === 'rejected' || raw === 'bad') return 'failed';
  if (raw === 'pending' || raw === 'processing' || raw === 'checking') return 'pending';

  return 'unknown';
}

export function isPhotoUsableForDiagnosis(status: unknown): boolean {
  const normalized = normalizePhotoQcStatus(status);
  return normalized === 'passed' || normalized === 'degraded';
}
