import { describe, it, expect } from 'vitest';

import { normalizeConflicts, tI18n } from '@/lib/conflictNormalize';

describe('conflict normalization', () => {
  it('tI18n falls back in correct order', () => {
    expect(tI18n({ en: 'Hello', zh: '你好' }, 'zh')).toBe('你好');
    expect(tI18n({ en: 'Hello', zh: '' }, 'zh')).toBe('Hello');
    expect(tI18n({ en: '', zh: '你好' }, 'en')).toBe('你好');
    expect(tI18n({ fr: 'Salut' }, 'en')).toBe('Salut');
    expect(tI18n(null, 'en')).toBe('');
  });

  it('normalizeConflicts merges strict match and takes higher severity', () => {
    const response = {
      cards: [
        {
          type: 'routine_simulation',
          payload: {
            safe: false,
            summary: 'x',
            conflicts: [
              { severity: 'warn', rule_id: 'retinoid_x_acids', message: 'Avoid stacking', step_indices: [0, 1] },
            ],
          },
        },
        {
          type: 'conflict_heatmap',
          payload: {
            schema_version: 'aurora.ui.conflict_heatmap.v1',
            state: 'has_conflicts',
            title_i18n: { en: 'Conflict heatmap', zh: '冲突热力图' },
            subtitle_i18n: { en: 'v1', zh: 'v1' },
            axes: {
              rows: {
                axis_id: 'steps',
                type: 'routine_steps',
                max_items: 16,
                items: [
                  { index: 0, step_key: 'step_0', label_i18n: { en: 'PM Treatment', zh: '晚间活性' }, short_label_i18n: { en: 'PM', zh: '晚' } },
                  { index: 1, step_key: 'step_1', label_i18n: { en: 'TEST Add-on', zh: '加用' }, short_label_i18n: { en: 'Add', zh: '加' } },
                ],
              },
              cols: { axis_id: 'steps', type: 'routine_steps', max_items: 16, items: [] },
              diagonal_policy: 'empty',
            },
            severity_scale: { min: 0, max: 3, meaning: '0..3', labels_i18n: { en: ['None', 'Low', 'Warn', 'Block'], zh: ['无', '低', '警告', '阻断'] } },
            cells: {
              encoding: 'sparse',
              default_severity: 0,
              max_items: 64,
              items: [
                {
                  cell_id: 'cell_0_1',
                  row_index: 0,
                  col_index: 1,
                  severity: 3,
                  rule_ids: ['retinoid_x_acids'],
                  headline_i18n: { en: 'Retinoid × acids', zh: '维A类 × 酸类' },
                  why_i18n: { en: 'High irritation risk', zh: '刺激风险较高' },
                  recommendations: [{ en: 'Alternate nights.', zh: '错开晚用。' }],
                },
              ],
            },
            unmapped_conflicts: [],
            footer_note_i18n: { en: 'Info only', zh: '仅供参考' },
            generated_from: { routine_simulation_schema_version: 'aurora.conflicts.v1', routine_simulation_safe: false, conflict_count: 1 },
          },
        },
      ],
    };

    const conflicts = normalizeConflicts(response, 'en');
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].id).toBe('retinoid_x_acids_0_1');
    expect(conflicts[0].severity).toBe('block');
    expect(conflicts[0].steps.aLabel).toBe('PM Treatment');
    expect(conflicts[0].steps.bLabel).toBe('TEST Add-on');
    expect(conflicts[0].headline).toBe('Retinoid × acids');
    expect(conflicts[0].why).toBe('High irritation risk');
    expect(conflicts[0].recommendations?.[0]).toBe('Alternate nights.');
    expect(conflicts[0].meta?.matchQuality).toBe('strict');
  });

  it('normalizeConflicts supports weak match (pair only)', () => {
    const response = {
      cards: [
        {
          type: 'routine_simulation',
          payload: {
            safe: false,
            summary: 'x',
            conflicts: [{ severity: 'warn', rule_id: 'retinoid_x_acids', message: 'x', step_indices: [1, 0] }],
          },
        },
        {
          type: 'conflict_heatmap',
          payload: {
            schema_version: 'aurora.ui.conflict_heatmap.v1',
            state: 'has_conflicts',
            axes: { rows: { axis_id: 'steps', type: 'routine_steps', max_items: 16, items: [] }, cols: { axis_id: 'steps', type: 'routine_steps', max_items: 16, items: [] }, diagonal_policy: 'empty' },
            severity_scale: { min: 0, max: 3, meaning: '0..3', labels_i18n: { en: ['None', 'Low', 'Warn', 'Block'], zh: ['无', '低', '警告', '阻断'] } },
            cells: {
              encoding: 'sparse',
              default_severity: 0,
              max_items: 64,
              items: [
                {
                  cell_id: 'cell_0_1',
                  row_index: 0,
                  col_index: 1,
                  severity: 2,
                  rule_ids: ['other_rule'],
                  headline_i18n: { en: 'Some other rule', zh: '其他规则' },
                  why_i18n: { en: 'x', zh: 'x' },
                  recommendations: [],
                },
              ],
            },
            unmapped_conflicts: [],
            footer_note_i18n: null,
            generated_from: { routine_simulation_schema_version: 'aurora.conflicts.v1', routine_simulation_safe: false, conflict_count: 1 },
          },
        },
      ],
    };

    const conflicts = normalizeConflicts(response, 'en');
    expect(conflicts.length).toBe(2);
    const target = conflicts.find((c) => c.id === 'retinoid_x_acids_0_1');
    expect(target?.meta?.matchQuality).toBe('weak');
  });

  it('normalizeConflicts falls back step labels when axes missing', () => {
    const response = {
      cards: [
        {
          type: 'routine_simulation',
          payload: {
            safe: false,
            summary: 'x',
            conflicts: [{ severity: 'block', rule_id: 'retinoid_x_acids', message: 'x', step_indices: [0, 1] }],
          },
        },
        { type: 'conflict_heatmap', payload: { schema_version: 'aurora.ui.conflict_heatmap.v1', state: 'has_conflicts' } },
      ],
    };

    const conflicts = normalizeConflicts(response, 'en');
    expect(conflicts[0]?.steps?.aLabel).toBe('Step 1');
    expect(conflicts[0]?.steps?.bLabel).toBe('Step 2');
  });
});

