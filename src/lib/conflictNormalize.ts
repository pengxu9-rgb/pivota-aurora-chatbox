import { normalizeConflictHeatmapUiModelV1 } from '@/lib/auroraUiContracts';

type Locale = 'en' | 'zh';

export type NormalizedConflictSeverity = 'low' | 'warn' | 'block';

export type NormalizedConflict = {
  id: `${string}_${number}_${number}`;
  severity: NormalizedConflictSeverity;
  steps: {
    a: number;
    b: number;
    aLabel: string;
    bLabel: string;
    aShortLabel?: string;
    bShortLabel?: string;
  };
  message?: string;
  headline?: string;
  why?: string;
  recommendations?: string[];
  ruleIds: string[];
  meta?: { matchQuality: 'strict' | 'weak' | 'none' };
};

function normalizeLocale(locale: string | null | undefined): Locale {
  const raw = String(locale || '')
    .trim()
    .toLowerCase();
  if (raw === 'zh' || raw === 'cn' || raw === 'zh-cn' || raw.startsWith('zh')) return 'zh';
  return 'en';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function uniqStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = String(raw || '').trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function clampSeverity(value: unknown): 0 | 1 | 2 | 3 {
  const n = asInt(value);
  if (n == null) return 0;
  if (n <= 0) return 0;
  if (n >= 3) return 3;
  return n as 1 | 2;
}

function severityToLabel(sev: 0 | 1 | 2 | 3): NormalizedConflictSeverity {
  if (sev >= 3) return 'block';
  if (sev === 2) return 'warn';
  return 'low';
}

function severityStringToLevel(raw: unknown): 0 | 1 | 2 | 3 {
  const s = asString(raw).trim().toLowerCase();
  if (s === 'block') return 3;
  if (s === 'warn' || s === 'warning') return 2;
  if (s === 'low') return 1;
  if (s === 'none' || s === 'ok' || s === 'safe') return 0;
  // Unknown severity: treat as warn to stay conservative in UX.
  return 2;
}

function safeStepFallback(index: number, locale: Locale): string {
  const n = Math.max(0, index) + 1;
  return locale === 'zh' ? `步骤 ${n}` : `Step ${n}`;
}

export function tI18n(value: unknown, locale: string): string {
  const lang = normalizeLocale(locale);
  if (!isPlainObject(value)) return '';

  const primary = lang === 'zh' ? 'zh' : 'en';
  const secondary = lang === 'zh' ? 'en' : 'zh';

  const p = typeof value[primary] === 'string' ? value[primary].trim() : '';
  if (p) return p;
  const s = typeof value[secondary] === 'string' ? value[secondary].trim() : '';
  if (s) return s;

  for (const v of Object.values(value)) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    }
  }
  return '';
}

function findCard(cards: unknown[], predicate: (card: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  for (const raw of cards) {
    if (!isPlainObject(raw)) continue;
    if (predicate(raw)) return raw;
  }
  return null;
}

function looksLikeRoutineSimulationCard(card: Record<string, unknown>): boolean {
  return asString(card.type).trim().toLowerCase() === 'routine_simulation';
}

function looksLikeConflictHeatmapCard(card: Record<string, unknown>): boolean {
  const type = asString(card.type).trim().toLowerCase();
  if (type === 'conflict_heatmap' || type === 'heatmap') return true;
  if (type.includes('conflict_heatmap')) return true;
  const payload = isPlainObject(card.payload) ? card.payload : null;
  const schema = payload ? asString(payload.schema_version).trim() : '';
  return schema === 'aurora.ui.conflict_heatmap.v1';
}

function getStepLabelLookup(model: ReturnType<typeof normalizeConflictHeatmapUiModelV1>, locale: Locale) {
  const axisItems =
    model?.axes?.rows?.items?.length ? model.axes.rows.items : model?.axes?.cols?.items?.length ? model.axes.cols.items : [];
  const byIndex = new Map<number, { label: string; shortLabel: string }>();
  for (const item of axisItems) {
    const idx = typeof item.index === 'number' && Number.isFinite(item.index) ? Math.trunc(item.index) : null;
    if (idx == null || idx < 0) continue;
    const label = tI18n(item.label_i18n, locale) || safeStepFallback(idx, locale);
    const shortLabel = tI18n(item.short_label_i18n, locale) || '';
    byIndex.set(idx, { label, shortLabel });
  }
  return (index: number) => {
    const hit = byIndex.get(index);
    if (hit) return hit;
    return { label: safeStepFallback(index, locale), shortLabel: '' };
  };
}

export function normalizeConflicts(response: unknown, locale: string): NormalizedConflict[] {
  const lang = normalizeLocale(locale);

  const cards = (() => {
    if (isPlainObject(response) && Array.isArray((response as any).cards)) return (response as any).cards as unknown[];
    if (Array.isArray(response)) return response as unknown[];
    return [];
  })();

  const simCard = findCard(cards, looksLikeRoutineSimulationCard);
  const heatmapCard = findCard(cards, looksLikeConflictHeatmapCard);

  const simPayload = simCard && isPlainObject(simCard.payload) ? simCard.payload : null;
  const simConflicts = simPayload && Array.isArray((simPayload as any).conflicts) ? ((simPayload as any).conflicts as unknown[]) : [];

  const heatmapPayload = heatmapCard && isPlainObject(heatmapCard.payload) ? heatmapCard.payload : null;
  const model = normalizeConflictHeatmapUiModelV1(heatmapPayload);
  const getStepLabel = getStepLabelLookup(model, lang);

  const cells = Array.isArray(model?.cells?.items) ? model.cells.items : [];

  const cellByPair = new Map<string, (typeof cells)[number]>();
  const cellByPairRule = new Map<string, (typeof cells)[number]>();
  for (const cell of cells) {
    const a = asInt((cell as any).row_index);
    const b = asInt((cell as any).col_index);
    if (a == null || b == null || a < 0 || b < 0) continue;
    const key = `${a}|${b}`;
    cellByPair.set(key, cell);
    const ruleIds = Array.isArray((cell as any).rule_ids) ? ((cell as any).rule_ids as unknown[]) : [];
    for (const rawRule of ruleIds) {
      const rule = asString(rawRule).trim();
      if (!rule) continue;
      cellByPairRule.set(`${rule}|${key}`, cell);
    }
  }

  const out = new Map<string, NormalizedConflict>();

  const upsert = (conflict: NormalizedConflict) => {
    const prev = out.get(conflict.id);
    if (!prev) {
      out.set(conflict.id, conflict);
      return;
    }

    const order: Record<NormalizedConflictSeverity, number> = { low: 1, warn: 2, block: 3 };
    const severity = order[conflict.severity] > order[prev.severity] ? conflict.severity : prev.severity;
    const message = prev.message || conflict.message;
    const headline = prev.headline || conflict.headline;
    const why = prev.why || conflict.why;
    const recommendations = prev.recommendations?.length ? prev.recommendations : conflict.recommendations;
    const ruleIds = uniqStrings([...(prev.ruleIds || []), ...(conflict.ruleIds || [])]);
    const matchQuality = ((): NormalizedConflict['meta'] => {
      const rank = { strict: 3, weak: 2, none: 1 } as const;
      const a = prev.meta?.matchQuality ?? 'none';
      const b = conflict.meta?.matchQuality ?? 'none';
      return { matchQuality: rank[a] >= rank[b] ? a : b };
    })();

    out.set(conflict.id, {
      ...prev,
      severity,
      message,
      headline,
      why,
      recommendations,
      ruleIds,
      meta: matchQuality,
    });
  };

  for (const raw of simConflicts) {
    if (!isPlainObject(raw)) continue;
    const rule_id = asString((raw as any).rule_id || (raw as any).ruleId).trim();
    if (!rule_id) continue;
    const msg = asString((raw as any).message).trim() || undefined;

    const indicesRaw = Array.isArray((raw as any).step_indices) ? ((raw as any).step_indices as unknown[]) : [];
    const a0 = asInt(indicesRaw[0]);
    const b0 = asInt(indicesRaw[1]);
    if (a0 == null || b0 == null || a0 < 0 || b0 < 0) continue;
    const a = Math.min(a0, b0);
    const b = Math.max(a0, b0);

    const pairKey = `${a}|${b}`;
    const strictCell = cellByPairRule.get(`${rule_id}|${pairKey}`) ?? null;
    const weakCell = strictCell ? null : (cellByPair.get(pairKey) ?? null);
    const cell = strictCell ?? weakCell;

    const sevSim = severityStringToLevel((raw as any).severity);
    const sevCell = clampSeverity((cell as any)?.severity);
    const sev = Math.max(sevSim, sevCell) as 0 | 1 | 2 | 3;

    const aLabels = getStepLabel(a);
    const bLabels = getStepLabel(b);

    upsert({
      id: `${rule_id}_${a}_${b}`,
      severity: severityToLabel(sev),
      steps: {
        a,
        b,
        aLabel: aLabels.label,
        bLabel: bLabels.label,
        ...(aLabels.shortLabel ? { aShortLabel: aLabels.shortLabel } : {}),
        ...(bLabels.shortLabel ? { bShortLabel: bLabels.shortLabel } : {}),
      },
      ...(msg ? { message: msg } : {}),
      ...(cell ? { headline: tI18n((cell as any).headline_i18n, lang) || undefined } : {}),
      ...(cell ? { why: tI18n((cell as any).why_i18n, lang) || undefined } : {}),
      ...(cell
        ? {
            recommendations: (Array.isArray((cell as any).recommendations) ? (cell as any).recommendations : [])
              .map((r: unknown) => tI18n(r, lang))
              .map((s: string) => s.trim())
              .filter(Boolean),
          }
        : {}),
      ruleIds: uniqStrings([rule_id, ...(cell ? (Array.isArray((cell as any).rule_ids) ? (cell as any).rule_ids : []) : [])]),
      meta: { matchQuality: strictCell ? 'strict' : weakCell ? 'weak' : 'none' },
    });
  }

  for (const cell of cells) {
    const a = asInt((cell as any).row_index);
    const b = asInt((cell as any).col_index);
    if (a == null || b == null || a < 0 || b < 0) continue;
    const sevCell = clampSeverity((cell as any).severity);
    const aLabels = getStepLabel(a);
    const bLabels = getStepLabel(b);

    const ruleIds = Array.isArray((cell as any).rule_ids) ? ((cell as any).rule_ids as unknown[]) : [];
    for (const rawRule of ruleIds) {
      const rule = asString(rawRule).trim();
      if (!rule) continue;
      const id = `${rule}_${a}_${b}` as const;
      if (out.has(id)) continue;

      upsert({
        id,
        severity: severityToLabel(sevCell),
        steps: {
          a,
          b,
          aLabel: aLabels.label,
          bLabel: bLabels.label,
          ...(aLabels.shortLabel ? { aShortLabel: aLabels.shortLabel } : {}),
          ...(bLabels.shortLabel ? { bShortLabel: bLabels.shortLabel } : {}),
        },
        headline: tI18n((cell as any).headline_i18n, lang) || undefined,
        why: tI18n((cell as any).why_i18n, lang) || undefined,
        recommendations: (Array.isArray((cell as any).recommendations) ? (cell as any).recommendations : [])
          .map((r: unknown) => tI18n(r, lang))
          .map((s: string) => s.trim())
          .filter(Boolean),
        ruleIds: uniqStrings([rule, ...(Array.isArray((cell as any).rule_ids) ? ((cell as any).rule_ids as unknown[]) : [])]),
        meta: { matchQuality: 'none' },
      });
    }
  }

  const order: Record<NormalizedConflictSeverity, number> = { block: 3, warn: 2, low: 1 };
  return [...out.values()].sort((a, b) => (order[b.severity] - order[a.severity]) || a.id.localeCompare(b.id));
}

