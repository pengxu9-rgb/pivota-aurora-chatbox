import { describe, expect, it } from 'vitest';

import { t } from '@/lib/i18n';

describe('profile sheet i18n', () => {
  it('resolves profile sheet prompt keys for EN and CN', () => {
    expect(t('profile.sheet.title', 'EN')).toBe('Edit skin profile');
    expect(t('profile.sheet.title', 'CN')).toBe('编辑肤况资料');

    expect(t('profile.sheet.helper', 'EN')).toBe('Updating these details helps me tune safety and recommendation accuracy.');
    expect(t('profile.sheet.helper', 'CN')).toBe('补充这些信息可提升建议的安全性与准确度。');

    expect(t('profile.sheet.section.skinBasics', 'EN')).toBe('Skin basics');
    expect(t('profile.sheet.section.skinBasics', 'CN')).toBe('基础肤况');

    expect(t('profile.sheet.section.healthContext', 'EN')).toBe('Health context');
    expect(t('profile.sheet.section.healthContext', 'CN')).toBe('健康背景');

    expect(t('profile.sheet.section.travel', 'EN')).toBe('Travel context');
    expect(t('profile.sheet.section.travel', 'CN')).toBe('出行环境');

    expect(t('profile.sheet.section.concerns', 'EN')).toBe('Concerns & goals');
    expect(t('profile.sheet.section.concerns', 'CN')).toBe('关注目标');

    expect(t('profile.sheet.section.preferences', 'EN')).toBe('Lifestyle notes');
    expect(t('profile.sheet.section.preferences', 'CN')).toBe('生活方式备注');

    expect(t('profile.sheet.cta.save', 'EN')).toBe('Save');
    expect(t('profile.sheet.cta.save', 'CN')).toBe('保存');
  });
});
