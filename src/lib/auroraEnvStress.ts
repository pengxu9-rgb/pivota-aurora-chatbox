export type EnvStressContributorV1 = {
  key: string;
  weight?: number; // 0..1 (optional)
  note?: string;
};

export type EnvStressInputV1 = {
  schema_version: 'aurora.env_stress.v1';
  profile: {
    skin_type?: string | null;
    barrier_status?: string | null;
    sensitivity?: string | null;
    goals?: string[];
    region?: string | null;
  };
  recent_logs?: Array<{
    date: string; // YYYY-MM-DD
    redness?: number | null; // 0..5 or 0..100
    hydration?: number | null; // 0..5 or 0..100
    acne?: number | null; // 0..5 or 0..100
  }>;
  env?: Record<string, unknown>;
};

export type EnvStressOutputV1 = {
  schema_version: 'aurora.env_stress.v1';
  ess: number | null; // 0..100; null if insufficient inputs
  tier: string | null;
  contributors: EnvStressContributorV1[];
  missing_inputs: string[];
  generated_at: string; // ISO timestamp
};

export type RadarDatumV1 = { axis: string; value: number }; // value: 0..100

export type TravelMetricDelta = {
  home: number | null;
  destination: number | null;
  delta: number | null;
  unit?: string | null;
};

export type TravelReadinessItem = {
  why?: string;
  what_to_do?: string;
};

export type TravelReadinessPersonalFocusItem = {
  focus?: string;
  why?: string;
  what_to_do?: string;
};

export type TravelReadinessProductPreviewItem = {
  rank?: number;
  product_id?: string | null;
  name?: string;
  brand?: string | null;
  category?: string | null;
  reasons?: string[];
  price?: number | null;
  currency?: string | null;
};

export type TravelReadinessBrandMatchStatus = 'kb_verified' | 'catalog_verified' | 'llm_only';

export type TravelReadinessBrandCandidateItem = {
  brand?: string;
  match_status?: TravelReadinessBrandMatchStatus;
  reason?: string | null;
};

export type TravelReadinessV1 = {
  destination_context?: {
    destination?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    env_source?: string | null;
    epi?: number | null;
  };
  delta_vs_home?: {
    temperature?: TravelMetricDelta;
    humidity?: TravelMetricDelta;
    uv?: TravelMetricDelta;
    wind?: TravelMetricDelta;
    precip?: TravelMetricDelta;
    summary_tags?: string[];
    baseline_status?: string | null;
  };
  adaptive_actions?: TravelReadinessItem[];
  personal_focus?: TravelReadinessPersonalFocusItem[];
  jetlag_sleep?: {
    tz_home?: string | null;
    tz_destination?: string | null;
    hours_diff?: number | null;
    risk_level?: string | null;
    sleep_tips?: string[];
    mask_tips?: string[];
  };
  shopping_preview?: {
    products?: TravelReadinessProductPreviewItem[];
    brand_candidates?: TravelReadinessBrandCandidateItem[];
    buying_channels?: string[];
    city_hint?: string | null;
    note?: string | null;
  };
  confidence?: {
    level?: string | null;
    missing_inputs?: string[];
    improve_by?: string[];
  };
};

export type EnvStressUiModelV1 = {
  schema_version: 'aurora.ui.env_stress.v1';
  ess: number | null;
  tier: string | null;
  radar: RadarDatumV1[];
  notes: string[];
  travel_readiness?: TravelReadinessV1;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function clamp100(value: number) {
  return clamp(value, 0, 100);
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

function normalizeScale05(value: unknown): number | null {
  const n = coerceNumber(value);
  if (n == null) return null;

  // Support 0..5 or 0..100 inputs.
  const v = n > 5 ? n / 20 : n;
  return clamp(v, 0, 5);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeBarrierFactor(raw: string): { factor: number; label: string } {
  const v = raw.trim().toLowerCase();
  if (!v) return { factor: 0.45, label: 'unknown' };
  if (v.includes('impaired') || v.includes('irrit') || v.includes('unstable') || v.includes('刺痛') || v.includes('泛红')) {
    return { factor: 0.7, label: 'impaired' };
  }
  if (v.includes('healthy') || v.includes('stable') || v.includes('ok') || v.includes('稳定')) {
    return { factor: 0.2, label: 'healthy' };
  }
  return { factor: 0.45, label: 'unknown' };
}

function normalizeSensitivityFactor(raw: string): { factor: number; label: string } {
  const v = raw.trim().toLowerCase();
  if (!v) return { factor: 0.5, label: 'unknown' };
  if (v === 'low' || v.includes('低')) return { factor: 0.2, label: 'low' };
  if (v === 'medium' || v === 'mid' || v.includes('中')) return { factor: 0.45, label: 'medium' };
  if (v === 'high' || v.includes('高')) return { factor: 0.7, label: 'high' };
  return { factor: 0.5, label: 'unknown' };
}

function pickLatestLog(
  logs: NonNullable<EnvStressInputV1['recent_logs']>,
): NonNullable<EnvStressInputV1['recent_logs']>[number] | null {
  const filtered = logs.filter((l) => l && isIsoDate(l.date));
  if (!filtered.length) return null;
  return [...filtered].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ?? null;
}

function inferTier(ess: number): 'Low' | 'Moderate' | 'High' {
  if (ess < 35) return 'Low';
  if (ess < 65) return 'Moderate';
  return 'High';
}

type EnvStressFactor = { key: string; factor: number; note: string };

function computeEnvStressFactors(input: EnvStressInputV1): {
  missing_inputs: string[];
  factors: EnvStressFactor[];
  hasAnySignal: boolean;
} {
  const missing_inputs: string[] = [];

  const profile = isPlainObject(input.profile) ? input.profile : {};
  const barrierStatusRaw = hasText(profile.barrier_status) ? profile.barrier_status : '';
  const sensitivityRaw = hasText(profile.sensitivity) ? profile.sensitivity : '';

  const hasAnyProfileSignal = Boolean(
    barrierStatusRaw ||
      sensitivityRaw ||
      (Array.isArray(profile.goals) && profile.goals.length),
  );

  if (!barrierStatusRaw) missing_inputs.push('profile.barrier_status');
  if (!sensitivityRaw) missing_inputs.push('profile.sensitivity');

  const logs = Array.isArray(input.recent_logs) ? input.recent_logs : [];
  const latestLog = logs.length ? pickLatestLog(logs) : null;

  const redness05 = latestLog ? normalizeScale05(latestLog.redness) : null;
  const hydration05 = latestLog ? normalizeScale05(latestLog.hydration) : null;
  const acne05 = latestLog ? normalizeScale05(latestLog.acne) : null;

  const hasAnyLogSignal = redness05 != null || hydration05 != null || acne05 != null;
  if (!hasAnyLogSignal) missing_inputs.push('recent_logs');

  const envProvided = Object.prototype.hasOwnProperty.call(input, 'env');
  const envObj = isPlainObject(input.env) ? input.env : null;
  if (envProvided && (!envObj || Object.keys(envObj).length === 0)) missing_inputs.push('env.*');

  const factors: EnvStressFactor[] = [];

  if (barrierStatusRaw) {
    const b = normalizeBarrierFactor(barrierStatusRaw);
    factors.push({ key: 'barrier', factor: b.factor, note: `barrier_status=${b.label}` });
  }

  if (sensitivityRaw) {
    const s = normalizeSensitivityFactor(sensitivityRaw);
    factors.push({ key: 'sensitivity', factor: s.factor, note: `sensitivity=${s.label}` });
  }

  if (redness05 != null) {
    factors.push({
      key: 'redness',
      factor: clamp01(redness05 / 5),
      note: `recent_redness=${round1(redness05)}/5`,
    });
  }

  if (hydration05 != null) {
    factors.push({
      key: 'hydration',
      factor: clamp01(1 - hydration05 / 5),
      note: `recent_hydration=${round1(hydration05)}/5 (lower hydration => higher stress)`,
    });
  }

  if (acne05 != null) {
    factors.push({
      key: 'acne',
      factor: clamp01(acne05 / 5),
      note: `recent_acne=${round1(acne05)}/5`,
    });
  }

  const hasAnySignal = hasAnyProfileSignal || hasAnyLogSignal || (envObj && Object.keys(envObj).length > 0);

  return { missing_inputs, factors, hasAnySignal: Boolean(hasAnySignal) };
}

export function calculateStressScore(
  input: EnvStressInputV1,
  opts: { now?: Date } = {},
): EnvStressOutputV1 {
  const nowIso = (opts.now ?? new Date()).toISOString();
  const { missing_inputs, factors, hasAnySignal } = computeEnvStressFactors(input);

  if (!hasAnySignal) {
    return {
      schema_version: 'aurora.env_stress.v1',
      ess: null,
      tier: null,
      contributors: [
        {
          key: 'missing_inputs',
          note: 'Insufficient signals to compute ESS (need profile/log/env inputs).',
        },
      ],
      missing_inputs,
      generated_at: nowIso,
    };
  }

  const baseWeights: Record<string, number> = {
    barrier: 0.35,
    sensitivity: 0.25,
    redness: 0.2,
    hydration: 0.1,
    acne: 0.1,
  };

  const weightSum = factors.reduce((acc, f) => acc + (baseWeights[f.key] ?? 0), 0);
  const normalizedWeightSum = weightSum > 0 ? weightSum : factors.length;

  const weighted =
    factors.reduce((acc, f) => {
      const w = weightSum > 0 ? (baseWeights[f.key] ?? 0) / normalizedWeightSum : 1 / normalizedWeightSum;
      return acc + clamp01(f.factor) * w;
    }, 0) * 100;

  const ess = round1(clamp100(weighted));
  const tier = inferTier(ess);

  const contributors: EnvStressContributorV1[] = factors.map((f) => {
    const w = weightSum > 0 ? (baseWeights[f.key] ?? 0) / normalizedWeightSum : 1 / normalizedWeightSum;
    return { key: f.key, weight: round1(w), note: f.note };
  });

  if (contributors.length === 0) {
    contributors.push({ key: 'missing_inputs', weight: 0, note: 'No usable factors; computed with fallback assumptions.' });
  }

  return {
    schema_version: 'aurora.env_stress.v1',
    ess,
    tier,
    contributors,
    missing_inputs,
    generated_at: nowIso,
  };
}

function titleCase(value: string) {
  const t = value.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function buildEnvStressUiModelFromInputV1(
  input: EnvStressInputV1,
  opts: { now?: Date } = {},
): EnvStressUiModelV1 {
  const result = calculateStressScore(input, { now: opts.now });
  const { factors } = computeEnvStressFactors(input);

  if (result.ess == null) {
    return {
      schema_version: 'aurora.ui.env_stress.v1',
      ess: null,
      tier: null,
      radar: [],
      notes: ['Insufficient signals to compute ESS.'],
    };
  }

  const radar: RadarDatumV1[] = factors
    .map((f) => ({ axis: titleCase(f.key), value: clamp100(Math.round(clamp01(f.factor) * 100)) }))
    .slice(0, 8);

  const notes = (result.contributors ?? [])
    .map((c) => (typeof c.note === 'string' ? c.note.trim() : ''))
    .filter(Boolean)
    .slice(0, 4);

  return {
    schema_version: 'aurora.ui.env_stress.v1',
    ess: result.ess,
    tier: result.tier,
    radar,
    notes,
  };
}

export function toEnvStressInputV1(params: {
  profile: Record<string, unknown> | null;
  recent_logs?: Array<Record<string, unknown>>;
}): EnvStressInputV1 {
  const profile = params.profile ?? {};
  return {
    schema_version: 'aurora.env_stress.v1',
    profile: {
      skin_type: typeof profile.skinType === 'string' ? profile.skinType : null,
      barrier_status: typeof profile.barrierStatus === 'string' ? profile.barrierStatus : null,
      sensitivity: typeof profile.sensitivity === 'string' ? profile.sensitivity : null,
      goals: Array.isArray(profile.goals) ? (profile.goals.filter((g: unknown) => typeof g === 'string') as string[]) : undefined,
      region: typeof profile.region === 'string' ? profile.region : null,
    },
    recent_logs: (params.recent_logs ?? [])
      .map((l) => {
        if (!l || typeof l !== 'object') return null;
        const date = typeof (l as any).date === 'string' ? String((l as any).date) : '';
        if (!isIsoDate(date)) return null;
        return {
          date,
          redness: (l as any).redness ?? null,
          hydration: (l as any).hydration ?? null,
          acne: (l as any).acne ?? null,
        };
      })
      .filter(Boolean) as EnvStressInputV1['recent_logs'],
  };
}
