import { describe, it, expect } from 'vitest';

import { humanizeKbNote } from '@/lib/auroraKbHumanize';

describe('aurora kb humanize', () => {
  it('maps known kb tokens', () => {
    expect(humanizeKbNote('high_irritation', 'EN')).toMatch(/irritation/i);
    expect(humanizeKbNote('high_irritation', 'CN')).toMatch(/刺激|刺痛|爆皮/);
  });

  it('keeps unknown tokens unchanged', () => {
    expect(humanizeKbNote('unknown_flag_123', 'EN')).toBe('unknown_flag_123');
  });

  it('humanizes pipe-delimited notes', () => {
    const out = humanizeKbNote('No added fragrance listed | strong_acid | high_irritation | fungal_acne', 'EN');
    expect(out).toContain('No added fragrance listed');
    expect(out).toMatch(/Strong acid|irritation|Fungal acne/i);
    expect(out).toContain(' · ');
  });
});

