import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Grid3X3 } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { normalizeConflictHeatmapUiModelV1 } from '@/lib/auroraUiContracts';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/types';

const EMPTY_ITEMS: any[] = [];
type HeatmapModel = NonNullable<ReturnType<typeof normalizeConflictHeatmapUiModelV1>>;
type HeatmapCell = HeatmapModel['cells']['items'][number];

export function ConflictHeatmapCard({
  payload,
  language,
  debug = false,
}: {
  payload: unknown;
  language: Language;
  debug?: boolean;
}) {
  const model = normalizeConflictHeatmapUiModelV1(payload);
  const cells = (model?.cells?.items ?? EMPTY_ITEMS) as HeatmapCell[];

  const pick = (v: { en: string; zh: string } | null | undefined): string => {
    if (!v) return '';
    return language === 'CN' ? (v.zh || v.en || '') : (v.en || v.zh || '');
  };

  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of cells) {
      map.set(`${cell.row_index}|${cell.col_index}`, cell);
    }
    return map;
  }, [cells]);

  const [selected, setSelected] = useState<null | { row: number; col: number }>(null);

  const selectedCell = useMemo(() => {
    if (!selected) return null;
    const direct = cellMap.get(`${selected.row}|${selected.col}`) ?? null;
    if (direct) return direct;
    return cellMap.get(`${selected.col}|${selected.row}`) ?? null;
  }, [cellMap, selected]);

  if (!model) return null;

  const steps = model.axes.rows.items.length ? model.axes.rows.items : model.axes.cols.items;
  const stepLabels = steps.map((s) => ({
    index: s.index,
    key: s.step_key,
    label: pick(s.short_label_i18n) || pick(s.label_i18n) || `Step ${s.index + 1}`,
    full: pick(s.label_i18n) || pick(s.short_label_i18n) || `Step ${s.index + 1}`,
  }));

  const severityTone = (severity: number) => {
    if (severity >= 3) return 'bg-red-500/80 border-red-600/40';
    if (severity === 2) return 'bg-orange-500/70 border-orange-600/40';
    if (severity === 1) return 'bg-amber-500/50 border-amber-600/30';
    return 'bg-muted/30 border-border/40';
  };

  const stateLabel = (() => {
    if (model.state === 'no_conflicts') return language === 'CN' ? '暂无冲突' : 'No conflicts';
    if (model.state === 'has_conflicts') return language === 'CN' ? '存在冲突' : 'Conflicts found';
    if (model.state === 'has_conflicts_partial') return language === 'CN' ? '部分冲突' : 'Partial';
    return language === 'CN' ? '不可用' : 'Unavailable';
  })();

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
            <div>
              <div className="text-sm font-semibold text-foreground">
                {pick(model.title_i18n) || (language === 'CN' ? '冲突热力图' : 'Conflict heatmap')}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {pick(model.subtitle_i18n) ||
                  (language === 'CN'
                    ? '步骤 × 步骤兼容性（V1）'
                    : 'Step × step compatibility (v1)')}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {stateLabel}
              {model.generated_from?.conflict_count != null ? (
                <span className="ml-2 opacity-80">{model.generated_from.conflict_count}</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {model.severity_scale.labels_i18n[
                language === 'CN' ? 'zh' : 'en'
              ]
                .slice(0, 4)
                .map((label, idx) => (
                  <div key={`${idx}_${label}`} className="flex items-center gap-1">
                    <span className={cn('h-3 w-3 rounded border', severityTone(idx), 'inline-block')} />
                    <span>{label}</span>
                  </div>
                ))}
            </div>
          </div>

          {model.state === 'unavailable' ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-[11px] text-muted-foreground">
              {language === 'CN'
                ? '当前没有足够的流程信息来生成热力图。'
                : 'Not enough routine information to build a heatmap yet.'}
            </div>
          ) : null}

          {model.state !== 'unavailable' && stepLabels.length ? (
            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
              <div className="overflow-x-auto">
                <table className="min-w-max border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-background/60 px-2 py-1 text-left text-[10px] font-semibold text-muted-foreground backdrop-blur">
                        {language === 'CN' ? '步骤' : 'Step'}
                      </th>
                      {stepLabels.map((s) => (
                        <th
                          key={`col_${s.key}`}
                          className="px-1 py-1 text-center text-[10px] font-semibold text-muted-foreground"
                          title={s.full}
                        >
                          <span className="inline-block max-w-[5.5rem] truncate">{s.label}</span>
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
                          const isActive = isUpper && severity > 0;
                          const isSelected = selected?.row === row.index && selected?.col === col.index;

                          return (
                            <td key={`c_${row.key}_${col.key}`} className="px-1 py-1">
                              {isUpper ? (
                                <button
                                  type="button"
                                  disabled={!isActive}
                                  onClick={() => setSelected({ row: row.index, col: col.index })}
                                  className={cn(
                                    'h-6 w-6 rounded border transition-colors',
                                    severityTone(severity),
                                    isActive ? 'hover:opacity-90' : 'opacity-40 cursor-default',
                                    isSelected ? 'ring-2 ring-primary/70 ring-offset-1 ring-offset-background' : '',
                                  )}
                                  aria-label={
                                    severity > 0
                                      ? `${row.full} × ${col.full}: ${pick(cell?.headline_i18n)}`
                                      : `${row.full} × ${col.full}`
                                  }
                                  title={severity > 0 ? pick(cell?.headline_i18n) : ''}
                                />
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

              {selectedCell ? (
                <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm text-foreground">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {language === 'CN' ? '说明' : 'Details'}
                  </div>
                  <div className="mt-1 font-semibold">{pick(selectedCell.headline_i18n)}</div>
                  <div className="mt-1 text-sm text-foreground/90">{pick(selectedCell.why_i18n)}</div>
                  {selectedCell.recommendations?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                      {selectedCell.recommendations.slice(0, 3).map((r, idx) => (
                        <li key={`${idx}_${r.en.slice(0, 20)}`}>{pick(r)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {model.unmapped_conflicts.length ? (
                <div className="mt-3 rounded-xl border border-border/60 bg-background/60 p-3">
                  <div className="text-xs font-semibold text-muted-foreground">{language === 'CN' ? '其他提示' : 'Other notes'}</div>
                  <ul className="mt-2 space-y-2 text-sm text-foreground/90">
                    {model.unmapped_conflicts.slice(0, 6).map((u) => (
                      <li key={u.rule_id} className="flex items-start gap-2">
                        <span className={cn('mt-0.5 inline-block h-3 w-3 shrink-0 rounded border', severityTone(u.severity))} />
                        <span className="min-w-0">
                          <span className="block">{pick(u.message_i18n)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {model.footer_note_i18n ? (
                <div className="mt-3 text-[11px] text-muted-foreground">{pick(model.footer_note_i18n)}</div>
              ) : null}
            </div>
          ) : null}

          {debug ? <div className="text-[11px] text-muted-foreground">{model.schema_version}</div> : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
