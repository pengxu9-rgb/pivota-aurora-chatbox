import { describe, it, expect } from "vitest";

import { normalizeConflictHeatmapUiModelV1, normalizeEnvStressUiModelV1 } from "@/lib/auroraUiContracts";

describe("aurora ui contracts", () => {
  it("UI-001 clamps radar values to 0..100", () => {
    const input = {
      schema_version: "aurora.ui.env_stress.v1",
      ess: 88,
      tier: "TODO(report)",
      radar: [
        { axis: "Hydration", value: 120 },
        { axis: "Sensitivity", value: -5 },
      ],
      notes: ["..."],
    };

    const { model, didWarn } = normalizeEnvStressUiModelV1(input);
    expect(model).not.toBeNull();
    expect(didWarn).toBe(false);

    expect(model?.radar.find((r) => r.axis === "Hydration")?.value).toBe(100);
    expect(model?.radar.find((r) => r.axis === "Sensitivity")?.value).toBe(0);
  });

  it("UI-002 falls back for non-finite values and warns", () => {
    const input = {
      schema_version: "aurora.ui.env_stress.v1",
      ess: null,
      tier: null,
      radar: [{ axis: "Hydration", value: "NaN" }],
      notes: [],
    };

    const { model, didWarn } = normalizeEnvStressUiModelV1(input);
    expect(model).not.toBeNull();
    expect(didWarn).toBe(true);
    expect(model?.radar[0]?.value).toBe(0);
  });

  it("UI-003 normalizes heatmap contract defensively", () => {
    const input = {
      schema_version: "aurora.ui.conflict_heatmap.v1",
      state: "has_conflicts",
      title_i18n: { en: "Conflict heatmap", zh: "冲突热力图" },
      axes: {
        rows: {
          axis_id: "steps",
          type: "routine_steps",
          max_items: 16,
          items: [
            {
              index: 0,
              step_key: "step_0",
              label_i18n: { en: "Cleanser", zh: "洁面" },
              short_label_i18n: { en: "Clean", zh: "洁面" },
            },
            {
              index: 1,
              step_key: "step_1",
              label_i18n: { en: "Treatment", zh: "精华" },
              short_label_i18n: { en: "Treat", zh: "精华" },
            },
          ],
        },
        cols: {
          axis_id: "steps",
          type: "routine_steps",
          max_items: 16,
          items: [
            {
              index: 0,
              step_key: "step_0",
              label_i18n: { en: "Cleanser", zh: "洁面" },
              short_label_i18n: { en: "Clean", zh: "洁面" },
            },
            {
              index: 1,
              step_key: "step_1",
              label_i18n: { en: "Treatment", zh: "精华" },
              short_label_i18n: { en: "Treat", zh: "精华" },
            },
          ],
        },
        diagonal_policy: "empty",
      },
      severity_scale: {
        min: 0,
        max: 3,
        meaning: "0 none, 1 low, 2 warn, 3 block",
        labels_i18n: { en: ["None", "Low", "Warn", "Block"], zh: ["无", "低", "警告", "阻断"] },
      },
      cells: {
        encoding: "sparse",
        default_severity: 0,
        max_items: 64,
        items: [
          {
            cell_id: "cell_0_1",
            row_index: 0,
            col_index: 1,
            severity: 99,
            rule_ids: ["retinoid_x_acids"],
            headline_i18n: { en: "Retinoid × acids", zh: "维A类 × 酸类" },
            why_i18n: { en: "Avoid stacking.", zh: "不要同晚叠加。" },
            recommendations: [{ en: "Alternate nights.", zh: "错开晚用。" }],
          },
        ],
      },
      unmapped_conflicts: [{ rule_id: "unknown_rule", severity: -3, message_i18n: { en: "—", zh: "—" } }],
      footer_note_i18n: { en: "Info only.", zh: "仅供参考。" },
      generated_from: { routine_simulation_schema_version: "aurora.conflicts.v1", routine_simulation_safe: false, conflict_count: 1 },
    };

    const model = normalizeConflictHeatmapUiModelV1(input);
    expect(model).not.toBeNull();
    expect(model?.state).toBe("has_conflicts");
    expect(model?.cells.items[0]?.severity).toBe(3);
    expect(model?.unmapped_conflicts[0]?.severity).toBe(0);
  });
});
