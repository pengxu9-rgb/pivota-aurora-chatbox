import { describe, expect, it } from 'vitest';

import { isPhotoUsableForDiagnosis, normalizePhotoQcStatus } from '@/lib/photoQc';

describe('photoQc normalization', () => {
  it('normalizes passed aliases', () => {
    expect(normalizePhotoQcStatus('passed')).toBe('passed');
    expect(normalizePhotoQcStatus('PASS')).toBe('passed');
    expect(normalizePhotoQcStatus('ok')).toBe('passed');
  });

  it('normalizes degraded aliases', () => {
    expect(normalizePhotoQcStatus('degraded')).toBe('degraded');
    expect(normalizePhotoQcStatus('warning')).toBe('degraded');
    expect(normalizePhotoQcStatus('LOW')).toBe('degraded');
  });

  it('normalizes failed aliases', () => {
    expect(normalizePhotoQcStatus('fail')).toBe('failed');
    expect(normalizePhotoQcStatus('rejected')).toBe('failed');
    expect(normalizePhotoQcStatus('bad')).toBe('failed');
  });

  it('marks usable diagnosis statuses correctly', () => {
    expect(isPhotoUsableForDiagnosis('passed')).toBe(true);
    expect(isPhotoUsableForDiagnosis('warn')).toBe(true);
    expect(isPhotoUsableForDiagnosis('failed')).toBe(false);
    expect(isPhotoUsableForDiagnosis('pending')).toBe(false);
    expect(isPhotoUsableForDiagnosis(null)).toBe(false);
  });
});
