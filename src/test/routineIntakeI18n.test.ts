import { describe, expect, it } from 'vitest';

import { t } from '@/lib/i18n';

describe('routine intake i18n', () => {
  it('resolves core routine sheet keys for EN and CN', () => {
    expect(t('routine.sheet.title', 'EN')).toBe('Add your AM/PM products (more accurate)');
    expect(t('routine.sheet.title', 'CN')).toBe('填写你在用的 AM/PM 产品（更准）');

    expect(t('routine.cta.saveAnalyze', 'EN')).toBe('Save & analyze');
    expect(t('routine.cta.saveAnalyze', 'CN')).toBe('保存并分析');

    expect(t('routine.cta.baselineOnly', 'EN')).toBe('Use baseline only');
    expect(t('routine.cta.baselineOnly', 'CN')).toBe('先给基线');

    expect(t('routine.cta.baselineOnly.userText', 'EN')).toBe('Skip and analyze (low confidence)');
    expect(t('routine.cta.baselineOnly.userText', 'CN')).toBe('直接分析（低置信度）');
  });
});
