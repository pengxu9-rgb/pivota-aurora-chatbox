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

  it("UI-003 keeps heatmap contract as placeholder", () => {
    const input = {
      schema_version: "aurora.ui.conflict_heatmap.v1",
      "TODO(report)": "define matrix axes + buckets + colors",
    };

    expect(normalizeConflictHeatmapUiModelV1(input)).toEqual({ schema_version: "aurora.ui.conflict_heatmap.v1" });
  });
});

