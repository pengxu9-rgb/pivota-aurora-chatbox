import { describe, expect, it } from 'vitest';

import { t } from '@/lib/i18n';

describe('checkin sheet i18n', () => {
  it('resolves core check-in keys for EN and CN', () => {
    expect(t('checkin.sheet.title', 'EN')).toBe('Daily check-in');
    expect(t('checkin.sheet.title', 'CN')).toBe('今日打卡');

    expect(t('checkin.sheet.helper', 'EN')).toBe(
      'A quick daily log helps me adjust suggestions based on your current skin response.',
    );
    expect(t('checkin.sheet.helper', 'CN')).toBe('记录今天的皮肤状态，我会据此动态调整后续建议。');

    expect(t('checkin.metric.redness.helper', 'EN')).toBe('0 = none, 5 = very noticeable.');
    expect(t('checkin.metric.redness.helper', 'CN')).toBe('0 = 无，5 = 非常明显。');

    expect(t('checkin.metric.acne.helper', 'EN')).toBe('0 = clear, 5 = very inflamed.');
    expect(t('checkin.metric.acne.helper', 'CN')).toBe('0 = 基本无，5 = 炎症明显。');

    expect(t('checkin.metric.hydration.helper', 'EN')).toBe('0 = very dry, 5 = very hydrated.');
    expect(t('checkin.metric.hydration.helper', 'CN')).toBe('0 = 很干，5 = 很水润。');

    expect(t('checkin.cta.save', 'EN')).toBe('Save');
    expect(t('checkin.cta.save', 'CN')).toBe('保存');
  });
});
