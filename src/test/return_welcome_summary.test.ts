import { describe, it, expect } from 'vitest';

import { buildReturnWelcomeSummary } from '@/lib/returnWelcomeSummary';

describe('return welcome summary', () => {
  it('parses currentRoutine JSON string and returns readable plan + sensitivity fallback (EN)', () => {
    const profile = {
      goals: ['acne', 'pores'],
      sensitivity: 'medium',
      barrierStatus: 'impaired',
      currentRoutine: JSON.stringify({
        schema_version: 'aurora.routine_intake.v1',
        am: [
          { step: 'cleanser', product: 'Biotherm force cleanser' },
          { step: 'treatment', product: 'Lab daily rescue water lotion' },
          { step: 'moisturizer', product: 'Biotherm Aquasource Cream' },
          { step: 'spf', product: 'none' },
        ],
        pm: [
          { step: 'cleanser', product: 'Biotherm force cleanser' },
          { step: 'treatment', product: 'Lab daily rescue water lotion' },
          { step: 'moisturizer', product: 'Biotherm Aquasource Cream' },
        ],
      }),
      updated_at: '2026-02-01T00:00:00.000Z',
    };

    const summary = buildReturnWelcomeSummary({
      profile,
      recent_logs: [{ date: '2026-02-06' }],
      checkin_due: true,
      language: 'EN',
      nowMs: Date.parse('2026-02-07T00:00:00.000Z'),
    });

    expect(summary.goal_primary).toBe('acne');
    expect(summary.plan_am_short).toEqual([
      'Cleanser: Biotherm force cleanser',
      'Treatment: Lab daily rescue water lotion',
      'Moisturizer: Biotherm Aquasource Cream',
      'SPF',
    ]);
    expect(summary.plan_pm_short?.[0]).toContain('Cleanser:');
    expect(summary.sensitivities).toEqual(['Sensitivity: Medium']);
    expect(summary.days_since_last).toBe(1);
    expect(summary.checkin_due).toBe(true);
  });

  it('uses CN step labels and contraindications when present (CN)', () => {
    const profile = {
      goals: ['brightening'],
      sensitivity: 'low',
      contraindications: ['fragrance', 'alcohol'],
      currentRoutine: {
        schema_version: 'aurora.routine_intake.v1',
        am: [{ step: 'cleanser', product: '温和洁面' }],
        pm: [{ step: 'treatment', product: 'A 醇' }],
      },
    };

    const summary = buildReturnWelcomeSummary({
      profile,
      recent_logs: [],
      checkin_due: false,
      language: 'CN',
      nowMs: Date.parse('2026-02-07T00:00:00.000Z'),
    });

    expect(summary.goal_primary).toBe('brightening');
    expect(summary.plan_am_short?.[0]).toContain('洁面');
    expect(summary.plan_pm_short?.[0]).toContain('功效');
    expect(summary.sensitivities).toEqual(['fragrance', 'alcohol']);
    expect(summary.checkin_due).toBe(false);
  });
});
