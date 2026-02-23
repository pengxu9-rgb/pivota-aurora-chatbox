import { describe, expect, it } from 'vitest';

import { deriveQuickProfileStatus, formatQuickProfileSummary, isQuickProfileComplete } from '@/lib/profileCompletion';

describe('profileCompletion', () => {
  it('treats unknown values as answered', () => {
    const profile = {
      skinType: 'unknown',
      sensitivity: 'unknown',
      goals: ['acne'],
    };
    expect(isQuickProfileComplete(profile)).toBe(true);
    expect(deriveQuickProfileStatus(profile, false)).toBe('complete_guest');
  });

  it('returns incomplete when core fields are missing', () => {
    const profile = { skinType: 'oily', goals: ['acne'] };
    expect(isQuickProfileComplete(profile)).toBe(false);
    expect(deriveQuickProfileStatus(profile, true)).toBe('incomplete');
  });

  it('formats concise summary for UI', () => {
    const profile = {
      skinType: 'oily',
      sensitivity: 'high',
      goals: ['acne', 'barrier'],
    };
    expect(formatQuickProfileSummary(profile, 'EN')).toContain('Skin: oily');
    expect(formatQuickProfileSummary(profile, 'CN')).toContain('肤质：oily');
  });
});

