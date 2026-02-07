import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Filter, Grid3X3, ListChecks } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/types';
import { normalizeConflictHeatmapUiModelV1 } from '@/lib/auroraUiContracts';
import { normalizeConflicts, tI18n, type NormalizedConflict, type NormalizedConflictSeverity } from '@/lib/conflictNormalize';

type EnvelopeMeta = {
  request_id?: string;
  trace_id?: string;
  events?: Array<Record<string, unknown>>;
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(Boolean(mql.matches));
    onChange();
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

function severityRank(sev: NormalizedConflictSeverity): number {
  if (sev === 'block') return 3;
  if (sev === 'warn') return 2;
  return 1;
}

function severityLabel(sev: NormalizedConflictSeverity, language: Language) {
  if (sev === 'block') return language === 'CN' ? '阻断' : 'Block';
  if (sev === 'warn') return language === 'CN' ? '警告' : 'Warn';
  return language === 'CN' ? '低' : 'Low';
}

function severityBadgeVariant(sev: NormalizedConflictSeverity): React.ComponentProps<typeof Badge>['variant'] {
  if (sev === 'block') return 'destructive';
  if (sev === 'warn') return 'secondary';
  return 'outline';
}

function severityTone(sev: number) {
  if (sev >= 3) return 'bg-red-500/80 border-red-600/40';
  if (sev === 2) return 'bg-orange-500/70 border-orange-600/40';
  if (sev === 1) return 'bg-amber-500/50 border-amber-600/30';
  return 'bg-muted/30 border-border/40';
}

function dedupeStrings(values: string[]): string[] {
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

function safeText(value: string | null | undefined): string {
  const t = String(value || '').trim();
  return t;
}

export function CompatibilityInsightsCard({
  routineSimulationPayload,
  conflictHeatmapPayload,
  language,
  debug,
  meta,
}: {
  routineSimulationPayload: Record<string, unknown>;
  conflictHeatmapPayload: unknown;
  language: Language;
  debug: boolean;
  meta?: EnvelopeMeta;
}) {
  const locale = language === 'CN' ? 'zh' : 'en';
  const heatmapModel = useMemo(() => normalizeConflictHeatmapUiModelV1(conflictHeatmapPayload), [conflictHeatmapPayload]);
  const normalized = useMemo(
    () =>
      normalizeConflicts(
        {
          cards: [
            { type: 'routine_simulation', payload: routineSimulationPayload },
            { type: 'conflict_heatmap', payload: conflictHeatmapPayload as any },
          ],
        },
        locale,
      ),
    [conflictHeatmapPayload, locale, routineSimulationPayload],
  );

  // Source of truth: the merged/normalized set. Simulation/heatmap can disagree; we treat `normalized.length` as canonical.
  const safe = normalized.length === 0;
  const totalConflicts = normalized.length;
  const maxSeverity = normalized.reduce((acc, c) => Math.max(acc, severityRank(c.severity)), 0);

  const [severityFilter, setSeverityFilter] = useState<'all' | 'warn_plus' | 'block'>('all');
  const minSeverity = severityFilter === 'block' ? 3 : severityFilter === 'warn_plus' ? 2 : 1;

  const filteredConflicts = useMemo(
    () => (minSeverity <= 1 ? normalized : normalized.filter((c) => severityRank(c.severity) >= minSeverity)),
    [minSeverity, normalized],
  );

  const steps = heatmapModel?.axes?.rows?.items?.length
    ? heatmapModel.axes.rows.items
    : heatmapModel?.axes?.cols?.items?.length
      ? heatmapModel.axes.cols.items
      : [];

  const stepLabels = useMemo(() => {
    const pick = (v: unknown) => tI18n(v, locale);
    return steps.map((s) => ({
      index: s.index,
      key: s.step_key,
      label: pick(s.short_label_i18n) || pick(s.label_i18n) || (language === 'CN' ? `步骤 ${s.index + 1}` : `Step ${s.index + 1}`),
      full: pick(s.label_i18n) || pick(s.short_label_i18n) || (language === 'CN' ? `步骤 ${s.index + 1}` : `Step ${s.index + 1}`),
    }));
  }, [language, locale, steps]);

  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);
  const selected = useMemo(
    () => (selectedConflictId ? normalized.find((c) => c.id === selectedConflictId) ?? null : null),
    [normalized, selectedConflictId],
  );

  const [detailsOpen, setDetailsOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 900px)');

  const openDetailsFor = useCallback((id: string) => {
    setSelectedConflictId(id);
    setDetailsOpen(true);
    const el = document.getElementById(`conflict_${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const selectedPair = selected ? { a: selected.steps.a, b: selected.steps.b } : null;

  const recommendationsTop = useMemo(() => {
    const all = normalized.flatMap((c) => (Array.isArray(c.recommendations) ? c.recommendations : []));
    return dedupeStrings(all).slice(0, 3);
  }, [normalized]);

  const suggestionsRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToSuggestions = useCallback(() => {
    suggestionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const heatmapCells = Array.isArray(heatmapModel?.cells?.items) ? heatmapModel.cells.items : [];
  const cellMap = useMemo(() => {
    const map = new Map<string, (typeof heatmapCells)[number]>();
    for (const cell of heatmapCells) map.set(`${cell.row_index}|${cell.col_index}`, cell);
    return map;
  }, [heatmapCells]);

  const onCellPick = useCallback(
    (row: number, col: number) => {
      // Pick the best-matching conflict for this cell.
      const a = Math.min(row, col);
      const b = Math.max(row, col);
      const candidates = normalized.filter((c) => c.steps.a === a && c.steps.b === b);
      const picked = candidates.sort((x, y) => severityRank(y.severity) - severityRank(x.severity) || x.id.localeCompare(y.id))[0];
      if (picked) openDetailsFor(picked.id);
      else setDetailsOpen(true);
    },
    [normalized, openDetailsFor],
  );

  const title = safeText(tI18n(heatmapModel?.title_i18n, locale)) || (language === 'CN' ? '冲突检测' : 'Conflict check');
  const subtitle =
    safeText(tI18n(heatmapModel?.subtitle_i18n, locale)) ||
    (language === 'CN' ? '结论 → 建议 → 详情 → 证据（热力图）' : 'Conclusion → Recommendations → Details → Evidence');

  const footerNote = safeText(tI18n(heatmapModel?.footer_note_i18n, locale));

  const summaryTitle = safe || totalConflicts === 0
    ? language === 'CN'
      ? '未检测到冲突'
      : 'No conflicts detected'
    : language === 'CN'
      ? '检测到刺激/冲突风险'
      : 'Irritation/conflict risks detected';

  const summarySubtitle =
    safe || totalConflicts === 0
      ? language === 'CN'
        ? '目前看起来可以一起使用；如有刺痛/爆皮请降频并加强保湿。'
        : 'Looks compatible; if irritation occurs, reduce frequency and moisturize.'
      : language === 'CN'
        ? '建议先看“如何调整”，再结合热力图证据做取舍。'
        : 'Review “how to adjust” first, then use the heatmap evidence to decide.';

  const showInconsistencyWarning = debug && heatmapModel && Array.isArray(routineSimulationPayload.conflicts)
    ? (routineSimulationPayload.conflicts as unknown[]).length !== heatmapModel.generated_from?.conflict_count
    : false;

  const copyDebug = useCallback(async () => {
    if (!debug) return;
    const payload = {
      request_id: meta?.request_id ?? null,
      trace_id: meta?.trace_id ?? null,
      schema_version: heatmapModel?.schema_version ?? null,
      state: heatmapModel?.state ?? null,
      counts: {
        normalized: normalized.length,
        simulation: Array.isArray(routineSimulationPayload.conflicts) ? routineSimulationPayload.conflicts.length : null,
        heatmap_cells: heatmapCells.length,
        unmapped: heatmapModel?.unmapped_conflicts?.length ?? null,
      },
      max_severity: maxSeverity,
      warnings: showInconsistencyWarning ? ['inconsistent_conflict_counts'] : [],
      events: meta?.events ?? [],
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  }, [debug, heatmapCells.length, heatmapModel, maxSeverity, meta?.events, meta?.request_id, meta?.trace_id, normalized.length, routineSimulationPayload.conflicts, showInconsistencyWarning]);

  const renderDetailsBody = (conf: NormalizedConflict | null) => {
    const c = conf;
    if (!c) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          {language === 'CN' ? '点击热力图格子或列表条目查看详情。' : 'Tap a cell or a list item to view details.'}
        </div>
      );
    }

    const titleLine = c.headline || c.message || (language === 'CN' ? '冲突详情' : 'Conflict details');
    const why = c.why || '';
    const recs = Array.isArray(c.recommendations) ? c.recommendations : [];

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={severityBadgeVariant(c.severity)}>{severityLabel(c.severity, language)}</Badge>
              <div className="text-sm font-semibold text-foreground">{titleLine}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{c.steps.aLabel}</span>
              <span className="mx-1">×</span>
              <span className="font-medium text-foreground/80">{c.steps.bLabel}</span>
            </div>
          </div>
        </div>

        {why ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground/90">
            <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '原因' : 'Why'}</div>
            <div className="mt-1 leading-relaxed">{why}</div>
          </div>
        ) : null}

        {recs.length ? (
          <div className="rounded-xl border border-border/60 bg-background/60 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '建议' : 'Recommendations'}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
              {recs.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <details className="rounded-xl border border-border/60 bg-background/60 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            {language === 'CN' ? '规则 ID（调试）' : 'Rule IDs (debug)'}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.ruleIds.map((rid) => (
              <span key={rid} className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                {rid}
              </span>
            ))}
          </div>
          {debug ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              match: <span className="font-mono">{c.meta?.matchQuality ?? 'none'}</span>
            </div>
          ) : null}
        </details>
      </div>
    );
  };

  const heatmapLegendLabels = heatmapModel?.severity_scale?.labels_i18n?.[language === 'CN' ? 'zh' : 'en']?.slice(0, 4) ?? [
    language === 'CN' ? '无' : 'None',
    language === 'CN' ? '低' : 'Low',
    language === 'CN' ? '警告' : 'Warn',
    language === 'CN' ? '阻断' : 'Block',
  ];

  const ctaLabel = language === 'CN' ? '查看如何调整' : 'View how to adjust';

  const detailsTitle = language === 'CN' ? '冲突详情' : 'Conflict details';

  const heatmapAvailable = Boolean(heatmapModel && stepLabels.length);
  const showingMaxStepsHint = Boolean(
    heatmapModel &&
      ((heatmapModel.axes?.rows?.max_items === 16 && heatmapModel.axes?.rows?.items?.length === 16) ||
        (heatmapModel.axes?.cols?.max_items === 16 && heatmapModel.axes?.cols?.items?.length === 16)),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Card className={cn('w-full max-w-[42rem] bg-white/90 backdrop-blur-sm shadow-elevated', 'border border-border/70')}>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
              <Grid3X3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{title}</div>
              <div className="mt-1 text-[11px] text-muted-foreground truncate">{subtitle}</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-4">
          <div
            className={cn(
              'rounded-2xl border p-3',
              safe || totalConflicts === 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-orange-200 bg-orange-50/70',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {safe || totalConflicts === 0 ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-700" />
                )}
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-foreground">{summaryTitle}</div>
                  <div className="text-xs text-muted-foreground">{summarySubtitle}</div>
                </div>
              </div>

              {totalConflicts ? (
                <div className="shrink-0 text-right">
                  <div className="text-[11px] text-muted-foreground">{language === 'CN' ? '冲突数' : 'Conflicts'}</div>
                  <div className="text-sm font-semibold text-foreground">{totalConflicts}</div>
                </div>
              ) : null}
            </div>

            {!safe && totalConflicts ? (
              <div className="mt-3">
                <Button type="button" className="w-full" onClick={scrollToSuggestions} aria-label={ctaLabel}>
                  <ListChecks className="mr-2 h-4 w-4" />
                  {ctaLabel}
                </Button>
              </div>
            ) : null}
          </div>

          <div ref={suggestionsRef} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '建议' : 'Recommendations'}</div>
              <div className="text-[11px] text-muted-foreground">
                {language === 'CN' ? '优先可执行' : 'Actionable first'}
              </div>
            </div>

            {recommendationsTop.length ? (
              <ul className="space-y-2">
                {recommendationsTop.map((rec) => (
                  <li key={rec} className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/60 p-3 text-sm text-foreground/90">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-foreground/70" />
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground/80">{language === 'CN' ? '暂无强建议（上游未返回）' : 'No strong recommendations returned.'}</div>
                {safeText(String(routineSimulationPayload.summary || '')).trim() ? (
                  <div className="mt-1">{safeText(String(routineSimulationPayload.summary || '')).trim()}</div>
                ) : null}
              </div>
            )}
          </div>

          {totalConflicts ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">
                  {language === 'CN' ? '冲突详情' : 'Conflicts'}
                  <span className="ml-2 text-[11px] font-medium text-muted-foreground">{language === 'CN' ? `共 ${totalConflicts} 条` : `${totalConflicts} total`}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Filter className="h-3.5 w-3.5" />
                    {language === 'CN' ? '筛选' : 'Filter'}
                  </span>
                  <div className="flex overflow-hidden rounded-full border border-border/60 bg-muted/40">
                    {(
                      [
                        ['all', language === 'CN' ? '全部' : 'All'],
                        ['warn_plus', language === 'CN' ? '警告+' : 'Warn+'],
                        ['block', language === 'CN' ? '阻断' : 'Block'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={cn(
                          'px-3 py-1 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                          severityFilter === key ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/60',
                        )}
                        onClick={() => setSeverityFilter(key)}
                        aria-label={label}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Accordion type="single" collapsible className="rounded-2xl border border-border/60 bg-background/60">
                {filteredConflicts.map((c) => {
                  const titleLine = c.headline || c.message || (language === 'CN' ? '冲突' : 'Conflict');
                  const isSelected = selectedConflictId === c.id;
                  const stepA = c.steps.aShortLabel || c.steps.aLabel;
                  const stepB = c.steps.bShortLabel || c.steps.bLabel;

                  return (
                    <AccordionItem
                      key={c.id}
                      value={c.id}
                      id={`conflict_${c.id}`}
                      className={cn(isSelected ? 'bg-muted/20' : '', 'border-b border-border/40 px-3')}
                    >
                      <AccordionTrigger
                        className="py-3 hover:no-underline"
                        onClick={() => openDetailsFor(c.id)}
                        aria-label={language === 'CN' ? '打开冲突详情' : 'Open conflict details'}
                      >
                        <div className="flex w-full items-start justify-between gap-3 text-left">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={severityBadgeVariant(c.severity)}>{severityLabel(c.severity, language)}</Badge>
                              <span className="truncate text-sm font-semibold text-foreground">{titleLine}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">{stepA}</span>
                              <span className="text-muted-foreground/60">×</span>
                              <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5">{stepB}</span>
                              {debug && c.meta?.matchQuality && c.meta.matchQuality !== 'strict' ? (
                                <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono">
                                  match:{c.meta.matchQuality}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0">
                        <div className="space-y-2 pb-2">
                          {c.why ? (
                            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground/90">
                              <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '原因' : 'Why'}</div>
                              <div className="mt-1 leading-relaxed">{c.why}</div>
                            </div>
                          ) : null}

                          {Array.isArray(c.recommendations) && c.recommendations.length ? (
                            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                              <div className="text-[11px] font-semibold text-muted-foreground">{language === 'CN' ? '建议' : 'Recommendations'}</div>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                                {c.recommendations.map((r) => (
                                  <li key={r}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          <details className="rounded-xl border border-border/60 bg-background/60 p-3">
                            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                              {language === 'CN' ? '规则 ID（调试）' : 'Rule IDs (debug)'}
                            </summary>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {c.ruleIds.map((rid) => (
                                <span
                                  key={rid}
                                  className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground"
                                >
                                  {rid}
                                </span>
                              ))}
                            </div>
                          </details>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '证据（热力图）' : 'Evidence (heatmap)'}</div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {heatmapLegendLabels.map((label, idx) => (
                  <div key={`${idx}_${label}`} className="flex items-center gap-1">
                    <span className={cn('h-3 w-3 rounded border', severityTone(idx), 'inline-block')} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {!heatmapAvailable ? (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                {language === 'CN' ? '热力图不可用（上游缺字段）。' : 'Heatmap unavailable (upstream missing fields).'}
              </div>
            ) : (
              <TooltipProvider delayDuration={120}>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                  <div className="overflow-auto">
                    <table className="w-full border-separate border-spacing-1">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-20 bg-background/60 px-2 py-1 text-left text-[10px] font-semibold text-muted-foreground backdrop-blur">
                            {language === 'CN' ? '步骤' : 'Step'}
                          </th>
                          {stepLabels.map((s) => (
                            <th
                              key={`h_${s.key}`}
                              className="px-2 py-1 text-center text-[10px] font-semibold text-muted-foreground"
                              title={s.full}
                            >
                              <span className="inline-block max-w-[7rem] truncate">{s.label}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stepLabels.map((row) => (
                          <tr key={`row_${row.key}`}>
                            <th
                              className="sticky left-0 z-10 bg-background/60 px-2 py-1 text-left text-[10px] font-semibold text-muted-foreground backdrop-blur"
                              title={row.full}
                            >
                              <span className="inline-block max-w-[7rem] truncate">{row.label}</span>
                            </th>
                            {stepLabels.map((col) => {
                              const isUpper = col.index > row.index;
                              const key = `${row.index}|${col.index}`;
                              const cell = isUpper ? cellMap.get(key) : null;
                              const severity = cell?.severity ?? 0;
                              const activeByFilter = severity > 0 && severity >= minSeverity;
                              const isSelected = selectedPair && isUpper && selectedPair.a === row.index && selectedPair.b === col.index;

                              const headline = cell ? safeText(tI18n(cell.headline_i18n, locale)) : '';
                              const why = cell ? safeText(tI18n(cell.why_i18n, locale)) : '';
                              const tooltipText = [headline, why].filter(Boolean).join(' — ').slice(0, 220);

                              const button = (
                                <button
                                  type="button"
                                  disabled={!activeByFilter}
                                  onClick={() => onCellPick(row.index, col.index)}
                                  className={cn(
                                    'h-6 w-6 rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background',
                                    severityTone(severity),
                                    activeByFilter ? 'hover:opacity-90' : 'opacity-40 cursor-default',
                                    isSelected ? 'ring-2 ring-primary/70 ring-offset-1 ring-offset-background' : '',
                                  )}
                                  aria-label={
                                    severity > 0 ? `${row.full} × ${col.full}: ${headline || 'conflict'}` : `${row.full} × ${col.full}`
                                  }
                                />
                              );

                              return (
                                <td key={`c_${row.key}_${col.key}`} className="px-1 py-1">
                                  {isUpper ? (
                                    severity > 0 ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-[260px]">
                                          <div className="text-xs font-semibold">{headline || (language === 'CN' ? '冲突' : 'Conflict')}</div>
                                          <div className="mt-1 text-[11px] text-muted-foreground">
                                            {language === 'CN' ? '严重度：' : 'Severity: '}
                                            {heatmapLegendLabels[Math.min(3, Math.max(0, severity))] || severity}
                                          </div>
                                          {tooltipText ? <div className="mt-1 text-[11px]">{tooltipText}</div> : null}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      button
                                    )
                                  ) : (
                                    <div className="h-6 w-6" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {footerNote ? <div className="mt-3 text-[11px] text-muted-foreground">{footerNote}</div> : null}
                  {showingMaxStepsHint ? (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {language === 'CN' ? '仅展示前 16 步（V1 限制）。' : 'Showing only the first 16 steps (v1 limit).'}
                    </div>
                  ) : null}

                  {heatmapModel?.unmapped_conflicts?.length ? (
                    <div className="mt-3 rounded-xl border border-border/60 bg-background/60 p-3">
                      <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '未映射冲突' : 'Unmapped conflicts'}</div>
                      <ul className="mt-2 space-y-2 text-sm text-foreground/90">
                        {heatmapModel.unmapped_conflicts.slice(0, 6).map((u) => (
                          <li key={u.rule_id} className="flex items-start gap-2">
                            <span className={cn('mt-0.5 inline-block h-3 w-3 shrink-0 rounded border', severityTone(u.severity))} />
                            <span className="min-w-0">
                              <span className="block">{safeText(tI18n(u.message_i18n, locale))}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </TooltipProvider>
            )}
          </div>

          {debug ? (
            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '调试信息' : 'Debug'}</div>
                <Button variant="outline" size="sm" onClick={() => void copyDebug()} aria-label={language === 'CN' ? '复制调试信息' : 'Copy debug'}>
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  {language === 'CN' ? '复制' : 'Copy'}
                </Button>
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <div>
                  request_id: <span className="font-mono">{meta?.request_id || '—'}</span>
                </div>
                <div>
                  trace_id: <span className="font-mono">{meta?.trace_id || '—'}</span>
                </div>
                <div>
                  schema_version: <span className="font-mono">{heatmapModel?.schema_version || '—'}</span>
                </div>
                <div>
                  state: <span className="font-mono">{heatmapModel?.state || '—'}</span>
                </div>
                <div>
                  counts: normalized={normalized.length} · simulation={Array.isArray(routineSimulationPayload.conflicts) ? routineSimulationPayload.conflicts.length : '—'} · cells={heatmapCells.length} · unmapped={heatmapModel?.unmapped_conflicts?.length ?? 0}
                </div>
                {showInconsistencyWarning ? (
                  <div className="mt-1 rounded-xl border border-orange-200 bg-orange-50/70 p-2 text-orange-700">
                    {language === 'CN' ? '告警：simulation 与 heatmap conflict_count 不一致。' : 'Warning: simulation and heatmap conflict_count mismatch.'}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isDesktop ? (
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent side="right" className="w-[420px] sm:max-w-[420px]" aria-label={detailsTitle}>
            <SheetHeader>
              <SheetTitle>{detailsTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{renderDetailsBody(selected)}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DrawerContent aria-label={detailsTitle}>
            <DrawerHeader>
              <DrawerTitle>{detailsTitle}</DrawerTitle>
            </DrawerHeader>
            {renderDetailsBody(selected)}
          </DrawerContent>
        </Drawer>
      )}
    </motion.div>
  );
}
