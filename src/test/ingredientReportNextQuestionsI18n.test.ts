import { describe, expect, it } from 'vitest';

import { t } from '@/lib/i18n';

describe('ingredient report next-questions i18n', () => {
  it('resolves bilingual keys for next-questions block', () => {
    expect(t('ingredientReport.nextQuestions.title', 'EN')).toBe('Next questions');
    expect(t('ingredientReport.nextQuestions.title', 'CN')).toBe('下一步问题');

    expect(t('ingredientReport.nextQuestions.helper', 'EN')).toBe(
      'Add your goal and sensitivity, and I can score ingredient suitability/match for your skin more accurately.',
    );
    expect(t('ingredientReport.nextQuestions.helper', 'CN')).toBe(
      '补充你的目标和皮肤耐受后，我会更准确评估这个成分与你肤况的适用性/匹配度。',
    );

    expect(t('ingredientReport.nextQuestions.completeProfile', 'EN')).toBe('Complete profile');
    expect(t('ingredientReport.nextQuestions.completeProfile', 'CN')).toBe('完善肤况');

    expect(t('ingredientReport.nextQuestions.saved', 'EN')).toBe(
      'Saved your goal and sensitivity. Next ingredient guidance will prioritize skin-fit relevance.',
    );
    expect(t('ingredientReport.nextQuestions.saved', 'CN')).toBe('已记录你的目标与皮肤耐受，后续会优先按成分适配度给建议。');
  });
});
