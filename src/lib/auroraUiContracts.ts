import type {
  EnvStressUiModelV1,
  RadarDatumV1,
} from '@/lib/auroraEnvStress';

export type ConflictHeatmapUiModelV1 = {
  schema_version: 'aurora.ui.conflict_heatmap.v1';
  state: 'unavailable' | 'no_conflicts' | 'has_conflicts' | 'has_conflicts_partial';
  title_i18n: { en: string; zh: string } | null;
  subtitle_i18n: { en: string; zh: string } | null;
  axes: {
    rows: {
      axis_id: string;
      type: string;
      max_items: number;
      items: Array<{
        index: number;
        step_key: string;
        label_i18n: { en: string; zh: string };
        short_label_i18n: { en: string; zh: string };
      }>;
    };
    cols: {
      axis_id: string;
      type: string;
      max_items: number;
      items: Array<{
        index: number;
        step_key: string;
        label_i18n: { en: string; zh: string };
        short_label_i18n: { en: string; zh: string };
      }>;
    };
    diagonal_policy: string;
  };
  severity_scale: {
    min: number;
    max: number;
    meaning: string;
    labels_i18n: { en: string[]; zh: string[] };
  };
  cells: {
    encoding: 'sparse';
    default_severity: number;
    items: Array<{
      cell_id: string;
      row_index: number;
      col_index: number;
      severity: 0 | 1 | 2 | 3;
      rule_ids: string[];
      headline_i18n: { en: string; zh: string };
      why_i18n: { en: string; zh: string };
      recommendations: Array<{ en: string; zh: string }>;
    }>;
    max_items: number;
  };
  unmapped_conflicts: Array<{
    rule_id: string;
    severity: 0 | 1 | 2 | 3;
    message_i18n: { en: string; zh: string };
  }>;
  footer_note_i18n: { en: string; zh: string } | null;
  generated_from: {
    routine_simulation_schema_version: string;
    routine_simulation_safe: boolean;
    conflict_count: number;
  } | null;
};

export type UiRenderingConstraintsV1 = {
  schema_version: 'aurora.ui.constraints.v1';
  value_range: '0..100';
  nan_policy: 'clamp_to_0_and_warn';
  max_axes: 8;
  max_notes: 4;
};

export const UI_RENDERING_CONSTRAINTS_V1: UiRenderingConstraintsV1 = {
  schema_version: 'aurora.ui.constraints.v1',
  value_range: '0..100',
  nan_policy: 'clamp_to_0_and_warn',
  max_axes: 8,
  max_notes: 4,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function coerceNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceInt(value: unknown): number | null {
  const n = coerceNumber(value);
  if (n == null) return null;
  const i = Math.trunc(n);
  return Number.isFinite(i) ? i : null;
}

function clamp0to100(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normalizeI18nTextV1(value: unknown, maxLen = 220): { en: string; zh: string } {
  const fallback = { en: '—', zh: '—' };
  if (!isPlainObject(value)) return fallback;

  const enRaw = typeof value.en === 'string' ? value.en.trim() : '';
  const zhRaw = typeof value.zh === 'string' ? value.zh.trim() : '';
  const en = (enRaw || zhRaw || fallback.en).slice(0, maxLen);
  const zh = (zhRaw || enRaw || fallback.zh).slice(0, maxLen);
  return { en, zh };
}

function clampSeverityV1(value: unknown): 0 | 1 | 2 | 3 {
  const n = coerceInt(value);
  if (n == null) return 0;
  if (n <= 0) return 0;
  if (n >= 3) return 3;
  return n as 1 | 2;
}

export function normalizeRadarSeriesV1(value: unknown): { radar: RadarDatumV1[]; didWarn: boolean } {
  const out: RadarDatumV1[] = [];
  let didWarn = false;

  if (!Array.isArray(value)) return { radar: out, didWarn };

  for (const item of value) {
    if (!isPlainObject(item)) continue;
    const axis = typeof item.axis === 'string' ? item.axis.trim() : '';
    if (!axis) continue;

    const rawValue = item.value;
    const n = coerceNumber(rawValue);
    if (n == null) didWarn = true;

    out.push({ axis: axis.slice(0, 40), value: clamp0to100(n ?? 0) });
    if (out.length >= UI_RENDERING_CONSTRAINTS_V1.max_axes) break;
  }

  return { radar: out, didWarn };
}

export function normalizeNotesV1(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const t = item.trim();
    if (!t) continue;
    out.push(t.slice(0, 220));
    if (out.length >= UI_RENDERING_CONSTRAINTS_V1.max_notes) break;
  }
  return out;
}

export function normalizeEnvStressUiModelV1(value: unknown): { model: EnvStressUiModelV1 | null; didWarn: boolean } {
  if (!isPlainObject(value)) return { model: null, didWarn: false };
  if (value.schema_version !== 'aurora.ui.env_stress.v1') return { model: null, didWarn: false };

  const essRaw = coerceNumber(value.ess);
  const ess = essRaw == null ? null : clamp0to100(essRaw);

  const tier = typeof value.tier === 'string' ? value.tier.trim().slice(0, 40) || null : null;
  const notes = normalizeNotesV1(value.notes);

  const { radar, didWarn } = normalizeRadarSeriesV1(value.radar);

  return {
    model: { schema_version: 'aurora.ui.env_stress.v1', ess, tier, radar, notes },
    didWarn,
  };
}

export function normalizeConflictHeatmapUiModelV1(value: unknown): ConflictHeatmapUiModelV1 | null {
  if (!isPlainObject(value)) return null;
  if (value.schema_version !== 'aurora.ui.conflict_heatmap.v1') return null;

  const stateRaw = typeof value.state === 'string' ? value.state.trim() : '';
  const state =
    stateRaw === 'no_conflicts' || stateRaw === 'has_conflicts' || stateRaw === 'has_conflicts_partial'
      ? stateRaw
      : 'unavailable';

  const title_i18n = value.title_i18n ? normalizeI18nTextV1(value.title_i18n, 80) : null;
  const subtitle_i18n = value.subtitle_i18n ? normalizeI18nTextV1(value.subtitle_i18n, 120) : null;
  const footer_note_i18n = value.footer_note_i18n ? normalizeI18nTextV1(value.footer_note_i18n, 220) : null;

  const axesObj = isPlainObject(value.axes) ? value.axes : {};
  const rowsObj = isPlainObject(axesObj.rows) ? axesObj.rows : {};
  const colsObj = isPlainObject(axesObj.cols) ? axesObj.cols : {};

  const maxAxisItems = 16;
  const normalizeAxis = (axis: Record<string, unknown>) => {
    const axis_id = typeof axis.axis_id === 'string' ? axis.axis_id.trim().slice(0, 40) : 'steps';
    const type = typeof axis.type === 'string' ? axis.type.trim().slice(0, 40) : 'routine_steps';
    const max_items = coerceInt(axis.max_items);
    const itemsRaw = Array.isArray(axis.items) ? axis.items : [];
    const items: ConflictHeatmapUiModelV1['axes']['rows']['items'] = [];

    for (const item of itemsRaw) {
      if (!isPlainObject(item)) continue;
      const index = coerceInt(item.index);
      if (index == null || index < 0) continue;

      const step_key = typeof item.step_key === 'string' ? item.step_key.trim().slice(0, 80) : `step_${index}`;
      const label_i18n = normalizeI18nTextV1(item.label_i18n, 80);
      const short_label_i18n = normalizeI18nTextV1(item.short_label_i18n, 32);

      items.push({ index, step_key, label_i18n, short_label_i18n });
      if (items.length >= maxAxisItems) break;
    }

    return { axis_id, type, max_items: max_items ?? items.length, items };
  };

  const rows = normalizeAxis(rowsObj);
  const cols = normalizeAxis(colsObj);
  const diagonal_policy =
    typeof axesObj.diagonal_policy === 'string' ? axesObj.diagonal_policy.trim().slice(0, 40) : 'empty';

  const severityObj = isPlainObject(value.severity_scale) ? value.severity_scale : {};
  const sevMin = coerceInt(severityObj.min);
  const sevMax = coerceInt(severityObj.max);
  const meaning = typeof severityObj.meaning === 'string' ? severityObj.meaning.trim().slice(0, 120) : '0..3 severity scale';
  const labelsRaw = isPlainObject(severityObj.labels_i18n) ? severityObj.labels_i18n : {};
  const labelsEn = Array.isArray(labelsRaw.en) ? labelsRaw.en.map((v) => (typeof v === 'string' ? v.trim().slice(0, 24) : '')) : [];
  const labelsZh = Array.isArray(labelsRaw.zh) ? labelsRaw.zh.map((v) => (typeof v === 'string' ? v.trim().slice(0, 24) : '')) : [];

  const severity_scale: ConflictHeatmapUiModelV1['severity_scale'] = {
    min: sevMin ?? 0,
    max: sevMax ?? 3,
    meaning,
    labels_i18n: {
      en: labelsEn.length ? labelsEn.slice(0, 4) : ['None', 'Low', 'Warn', 'Block'],
      zh: labelsZh.length ? labelsZh.slice(0, 4) : ['无', '低', '警告', '阻断'],
    },
  };

  const cellsObj = isPlainObject(value.cells) ? value.cells : {};
  const encoding = (typeof cellsObj.encoding === 'string' ? cellsObj.encoding.trim() : 'sparse') === 'sparse' ? 'sparse' : 'sparse';
  const default_severity = coerceInt(cellsObj.default_severity) ?? 0;
  const max_items = coerceInt(cellsObj.max_items) ?? 64;
  const maxCells = 64;
  const maxRuleIds = 3;
  const maxRecs = 3;

  const cellsRaw = Array.isArray(cellsObj.items) ? cellsObj.items : [];
  const cells: ConflictHeatmapUiModelV1['cells']['items'] = [];
  const stepsCount = Math.min(rows.items.length || cols.items.length || 0, maxAxisItems);
  for (const item of cellsRaw) {
    if (!isPlainObject(item)) continue;
    const row_index = coerceInt(item.row_index);
    const col_index = coerceInt(item.col_index);
    if (row_index == null || col_index == null) continue;
    if (row_index < 0 || col_index < 0) continue;
    if (stepsCount > 0 && (row_index >= stepsCount || col_index >= stepsCount)) continue;
    if (row_index === col_index) continue;

    const cell_id = typeof item.cell_id === 'string' ? item.cell_id.trim().slice(0, 80) : `cell_${row_index}_${col_index}`;
    const severity = clampSeverityV1(item.severity);
    const rule_ids = Array.isArray(item.rule_ids)
      ? item.rule_ids
          .map((v) => (typeof v === 'string' ? v.trim().slice(0, 80) : ''))
          .filter(Boolean)
          .slice(0, maxRuleIds)
      : [];

    const headline_i18n = normalizeI18nTextV1(item.headline_i18n, 80);
    const why_i18n = normalizeI18nTextV1(item.why_i18n, 220);
    const recsRaw = Array.isArray(item.recommendations) ? item.recommendations : [];
    const recommendations = recsRaw
      .map((r) => normalizeI18nTextV1(r, 160))
      .slice(0, maxRecs);

    cells.push({
      cell_id,
      row_index,
      col_index,
      severity,
      rule_ids,
      headline_i18n,
      why_i18n,
      recommendations,
    });
    if (cells.length >= Math.min(maxCells, max_items)) break;
  }
  cells.sort((a, b) => (a.row_index - b.row_index) || (a.col_index - b.col_index));

  const unmappedRaw = Array.isArray(value.unmapped_conflicts) ? value.unmapped_conflicts : [];
  const unmapped_conflicts: ConflictHeatmapUiModelV1['unmapped_conflicts'] = [];
  for (const item of unmappedRaw) {
    if (!isPlainObject(item)) continue;
    const rule_id = typeof item.rule_id === 'string' ? item.rule_id.trim().slice(0, 80) : '';
    if (!rule_id) continue;
    const severity = clampSeverityV1(item.severity);
    const message_i18n = normalizeI18nTextV1(item.message_i18n, 220);
    unmapped_conflicts.push({ rule_id, severity, message_i18n });
    if (unmapped_conflicts.length >= 10) break;
  }

  const generatedObj = isPlainObject(value.generated_from) ? value.generated_from : null;
  const generated_from = generatedObj
    ? {
        routine_simulation_schema_version:
          typeof generatedObj.routine_simulation_schema_version === 'string'
            ? generatedObj.routine_simulation_schema_version.trim().slice(0, 80)
            : 'unknown',
        routine_simulation_safe: generatedObj.routine_simulation_safe === true,
        conflict_count: coerceInt(generatedObj.conflict_count) ?? 0,
      }
    : null;

  return {
    schema_version: 'aurora.ui.conflict_heatmap.v1',
    state,
    title_i18n,
    subtitle_i18n,
    axes: { rows, cols, diagonal_policy },
    severity_scale,
    cells: { encoding, default_severity, items: cells, max_items },
    unmapped_conflicts,
    footer_note_i18n,
    generated_from,
  };
}
