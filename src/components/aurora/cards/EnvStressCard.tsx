import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

import { EnvStressBreakdown } from '@/components/aurora/charts/EnvStressBreakdown';
import { EnvStressRadar } from '@/components/aurora/charts/EnvStressRadar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { normalizeEnvStressUiModelV1 } from '@/lib/auroraUiContracts';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/types';

type MetricDelta = {
  home?: number | null;
  destination?: number | null;
  delta?: number | null;
  unit?: string | null;
};

function formatDeltaLine(language: Language, metric: MetricDelta | undefined) {
  if (!metric) return null;
  const home = typeof metric.home === 'number' ? metric.home : null;
  const destination = typeof metric.destination === 'number' ? metric.destination : null;
  const delta = typeof metric.delta === 'number' ? metric.delta : null;
  const unit = typeof metric.unit === 'string' && metric.unit.trim() ? metric.unit.trim() : '';
  if (home == null && destination == null && delta == null) return null;
  if (language === 'CN') return `常驻地 ${home ?? '-'}${unit} -> 目的地 ${destination ?? '-'}${unit} (Δ ${delta ?? '-'}${unit})`;
  return `Home ${home ?? '-'}${unit} -> Destination ${destination ?? '-'}${unit} (delta ${delta ?? '-'}${unit})`;
}

function formatCompactSignal({
  language,
  metric,
  labelCn,
  labelEn,
}: {
  language: Language;
  metric?: MetricDelta;
  labelCn: string;
  labelEn: string;
}) {
  if (!metric || typeof metric.delta !== 'number') return null;
  const unit = typeof metric.unit === 'string' ? metric.unit : '';
  const signed = metric.delta > 0 ? `+${Math.round(metric.delta * 10) / 10}` : `${Math.round(metric.delta * 10) / 10}`;
  return `${language === 'CN' ? labelCn : labelEn} ${signed}${unit}`;
}

function formatBrandMatchStatus(language: Language, status?: string | null) {
  const token = typeof status === 'string' ? status.trim() : '';
  if (token === 'kb_verified') return language === 'CN' ? 'KB 已验证' : 'KB verified';
  if (token === 'catalog_verified') return language === 'CN' ? '目录已验证' : 'Catalog verified';
  return language === 'CN' ? 'AI 推荐，未经商品库验证' : 'AI-suggested, not verified in our catalog';
}

function formatProductSource(language: Language, source?: string | null) {
  const token = typeof source === 'string' ? source.trim() : '';
  if (token === 'catalog') return null;
  if (token === 'llm_generated' || token === 'llm_only') {
    return language === 'CN' ? 'AI 推荐' : 'AI-suggested';
  }
  if (token === 'rule_fallback') {
    return language === 'CN' ? '通用建议' : 'General recommendation';
  }
  return null;
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}

type StructuredSections = {
  seasonal_context?: string[];
  key_deltas?: string[];
  routine_adjustments?: string[];
  flight_day_plan?: string[];
  active_handling?: string[];
  phased_plan?: string[];
  packing_list?: string[];
  travel_kit?: string[];
  product_guidance?: string[];
  troubleshooting?: string[];
};

export function EnvStressCard({
  payload,
  language,
  onOpenCheckin,
  onOpenRecommendations,
  onRefineRoutine,
}: {
  payload: unknown;
  language: Language;
  onOpenCheckin?: () => void;
  onOpenRecommendations?: () => void;
  onRefineRoutine?: () => void;
}) {
  const { model, didWarn } = normalizeEnvStressUiModelV1(payload);

  useEffect(() => {
    if (didWarn) console.warn('[aurora.ui] env_stress model normalized (clamp/NaN policy applied)');
  }, [didWarn]);

  const ess = model?.ess;
  const tier = model?.tier;
  const tierDescription = typeof (model as Record<string, unknown>)?.tier_description === 'string'
    ? (model as Record<string, unknown>).tier_description as string
    : null;
  const travelReadiness = model?.travel_readiness;
  const sections: StructuredSections = (travelReadiness as Record<string, unknown>)?.structured_sections as StructuredSections ?? {};
  const travelKitLines = safeStringArray(sections.travel_kit).length
    ? safeStringArray(sections.travel_kit)
    : safeStringArray(sections.product_guidance).length
      ? safeStringArray(sections.product_guidance)
      : safeStringArray(sections.packing_list);
  const hasDrivers = model?.radar?.some((r: Record<string, unknown>) => Array.isArray(r.drivers) && r.drivers.length > 0) ?? false;
  const missingInputs = Array.isArray(travelReadiness?.confidence?.missing_inputs)
    ? travelReadiness.confidence?.missing_inputs
    : [];
  const missingRecentLogs = Boolean(
    missingInputs.includes('recent_logs') || model?.notes?.some((n) => typeof n === 'string' && n.includes('recent_logs')),
  );

  const metricRows = useMemo(
    () =>
      [
        {
          key: 'temperature',
          label: language === 'CN' ? '温度' : 'Temperature',
          value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.temperature),
        },
        {
          key: 'humidity',
          label: language === 'CN' ? '湿度' : 'Humidity',
          value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.humidity),
        },
        {
          key: 'uv',
          label: language === 'CN' ? '紫外线' : 'UV',
          value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.uv),
        },
        {
          key: 'wind',
          label: language === 'CN' ? '风' : 'Wind',
          value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.wind),
        },
        {
          key: 'precip',
          label: language === 'CN' ? '降水' : 'Precipitation',
          value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.precip),
        },
      ].filter((row) => Boolean(row.value)),
    [language, travelReadiness],
  );

  const compactSignals = useMemo(
    () =>
      [
        formatCompactSignal({
          language,
          metric: travelReadiness?.delta_vs_home?.temperature,
          labelCn: '温差',
          labelEn: 'Temp',
        }),
        formatCompactSignal({
          language,
          metric: travelReadiness?.delta_vs_home?.humidity,
          labelCn: '湿度',
          labelEn: 'Humidity',
        }),
        formatCompactSignal({
          language,
          metric: travelReadiness?.delta_vs_home?.uv,
          labelCn: 'UV',
          labelEn: 'UV',
        }),
      ].filter(Boolean) as string[],
    [language, travelReadiness],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full"
    >
      <Card className={cn('w-full max-w-sm bg-white/90 backdrop-blur-sm shadow-elevated', 'border border-border/70')}>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {language === 'EN' ? 'Environment Stress' : '环境压力'}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {language === 'EN'
                    ? 'A bounded, explainable stress signal (ESS).'
                    : '可解释、可降级的压力信号（ESS）。'}
                </div>
              </div>
            </div>

            {typeof ess === 'number' ? (
              <div className="text-right">
                <div className="text-[11px] text-muted-foreground">{language === 'EN' ? 'ESS' : 'ESS'}</div>
                <div className="text-sm font-semibold text-foreground">{Math.round(ess)}/100</div>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-2.5 p-4 pt-0">
          {typeof ess === 'number' ? (
            <>
              <Progress
                value={Math.max(0, Math.min(100, Math.round(ess)))}
                className="h-2 bg-muted/50"
                indicatorClassName="bg-orange-500"
                aria-label="Environment stress score"
              />
              <div className="flex items-center justify-between">
                {tier ? (
                  <div className="text-[11px] text-muted-foreground">
                    {language === 'EN' ? 'Tier:' : '等级：'} {tier}
                  </div>
                ) : (
                  <span />
                )}
                {compactSignals.length ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {compactSignals.slice(0, 3).map((line) => (
                      <span key={line} className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] text-foreground/85">
                        {line}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {tierDescription ? (
                <div className="text-[11px] text-muted-foreground/85">
                  {tierDescription}
                </div>
              ) : null}
              {model?.radar?.length && hasDrivers ? (
                <EnvStressBreakdown
                  data={{
                    total: typeof ess === 'number' ? Math.round(ess) : 0,
                    tier: tier || 'Medium',
                    tierDescription: tierDescription || '',
                    components: (model.radar as Array<{ axis: string; value: number; drivers?: string[] }>).map((r) => ({
                      name: r.axis,
                      score: Math.round(r.value),
                      drivers: Array.isArray(r.drivers) ? r.drivers : [],
                    })),
                  }}
                />
              ) : model?.radar?.length ? (
                <details className="rounded-xl border border-border/70 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-medium text-foreground/90">
                    {language === 'CN' ? '为什么是这个分数（展开）' : 'Why this score (expand)'}
                  </summary>
                  <div className="mt-2">
                    <EnvStressRadar model={model} />
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-[11px] text-muted-foreground">
              {model?.notes?.[0] ??
                (language === 'EN'
                  ? 'Environment stress is unavailable for this reply.'
                  : '本次回复未拿到环境压力数据。')}
            </div>
          )}

          {travelReadiness ? (
            <>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground/90">
                  {language === 'CN' ? '目的地差异' : 'Destination delta'}
                </div>
                <div className="mt-1">
                  {language === 'CN' ? '目的地：' : 'Destination: '}
                  {travelReadiness.destination_context?.destination || (language === 'CN' ? '未知' : 'Unknown')}
                  {travelReadiness.destination_context?.start_date || travelReadiness.destination_context?.end_date
                    ? ` (${travelReadiness.destination_context?.start_date || '-'} -> ${travelReadiness.destination_context?.end_date || '-'})`
                    : ''}
                </div>
                {metricRows.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {metricRows.slice(0, 2).map((row) => (
                      <li key={row.key}>
                        <span className="font-medium text-foreground/90">{row.label}:</span> {row.value}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {metricRows.length > 2 ? (
                  <details className="mt-1 text-[11px]">
                    <summary className="cursor-pointer select-none text-muted-foreground">
                      {language === 'CN' ? '展开更多指标' : 'Show more metrics'}
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {metricRows.slice(2).map((row) => (
                        <li key={row.key}>
                          <span className="font-medium text-foreground/90">{row.label}:</span> {row.value}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {travelReadiness.delta_vs_home?.summary_tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {travelReadiness.delta_vs_home.summary_tags.slice(0, 6).map((tag) => (
                      <span key={tag} className="rounded-full border border-border/70 px-2 py-0.5 text-[10px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {travelReadiness.forecast_window?.length ? (
                <details className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-semibold text-foreground/90">
                    {language === 'CN' ? '逐日天气预报（展开）' : 'Daily forecast (expand)'}
                  </summary>
                  <ul className="mt-1.5 space-y-0.5">
                    {travelReadiness.forecast_window.slice(0, 7).map((day, idx) => (
                      <li key={`fc_${idx}_${day.date}`} className="flex gap-1.5">
                        <span className="font-medium text-foreground/90 shrink-0">{day.date}</span>
                        <span>
                          {typeof day.temp_low_c === 'number' || typeof day.temp_high_c === 'number'
                            ? `${day.temp_low_c ?? '-'}° ~ ${day.temp_high_c ?? '-'}°C`
                            : ''}
                          {day.condition_text ? ` · ${day.condition_text}` : ''}
                          {typeof day.precip_mm === 'number' && day.precip_mm > 0
                            ? ` · ${day.precip_mm}mm`
                            : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {travelReadiness.personal_focus?.length ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground/90">
                    {language === 'CN' ? '你要重点注意' : 'Personal focus'}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {travelReadiness.personal_focus.slice(0, 1).map((item, idx) => (
                      <li key={`${idx}_${item.focus || item.what_to_do || 'focus'}`}>
                        {item.focus ? <div className="text-foreground/90">{item.focus}</div> : null}
                        {item.what_to_do ? <div>{item.what_to_do}</div> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(travelReadiness.jetlag_sleep?.sleep_tips?.length || travelReadiness.jetlag_sleep?.mask_tips?.length) ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground/90">
                    {language === 'CN' ? '时差与睡眠' : 'Jet lag and sleep'}
                  </div>
                  <div className="mt-1">
                    {language === 'CN' ? '时区差：' : 'Timezone diff: '}
                    {typeof travelReadiness.jetlag_sleep?.hours_diff === 'number'
                      ? `${travelReadiness.jetlag_sleep.hours_diff}h`
                      : language === 'CN'
                        ? '未知'
                        : 'Unknown'}
                    {travelReadiness.jetlag_sleep?.risk_level
                      ? ` (${travelReadiness.jetlag_sleep.risk_level})`
                      : ''}
                  </div>
                  {travelReadiness.jetlag_sleep?.sleep_tips?.length ? (
                    <div className="mt-1">• {travelReadiness.jetlag_sleep.sleep_tips[0]}</div>
                  ) : null}
                  {travelReadiness.jetlag_sleep?.mask_tips?.length ? (
                    <div className="mt-1">• {travelReadiness.jetlag_sleep.mask_tips[0]}</div>
                  ) : null}
                </div>
              ) : null}

              {travelReadiness.alerts?.length ? (
                <div className="rounded-xl border border-amber-400/50 bg-amber-50/30 p-2.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-amber-700">
                    {language === 'CN' ? '天气预警' : 'Weather alerts'}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {travelReadiness.alerts.slice(0, 2).map((alert, idx) => (
                      <li key={`alert_${idx}`}>
                        {alert.severity ? <span className="font-medium text-amber-700">{alert.severity} </span> : null}
                        {alert.title || alert.summary || ''}
                        {alert.action_hint ? <div className="mt-0.5">{alert.action_hint}</div> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground/90">
                  {language === 'CN' ? '建议买什么' : 'Shopping preview'}
                </div>
                {travelReadiness.shopping_preview?.products?.length ? (
                  <ul className="mt-1.5 space-y-1.5">
                    {travelReadiness.shopping_preview.products.slice(0, 3).map((item: Record<string, unknown>, idx: number) => {
                      const sourceLabel = formatProductSource(language, item.product_source as string | undefined);
                      const matchLabel = formatBrandMatchStatus(language, item.match_status as string | undefined);
                      const badge = sourceLabel || matchLabel;
                      return (
                        <li key={`${idx}_${item.product_id || item.name || 'product'}`}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground/90">
                              {item.name as string}
                              {item.brand ? ` · ${item.brand as string}` : ''}
                            </span>
                            {badge ? (
                              <span className="shrink-0 rounded-full border border-amber-300/60 bg-amber-50/40 px-1.5 py-0.5 text-[9px] text-amber-700">
                                {badge}
                              </span>
                            ) : null}
                          </div>
                          {(item.reasons as string[] | undefined)?.length ? <div>{(item.reasons as string[]).join(' · ')}</div> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="mt-1.5">
                    {language === 'CN'
                      ? '暂无单品预览。建议先准备：SPF 防晒 + 屏障面霜 + 补水修护面膜，然后一键生成完整推荐。'
                      : 'No product preview yet. Prepare SPF, a barrier cream, and a hydrating recovery mask, then generate full recommendations.'}
                  </div>
                )}
                {travelReadiness.shopping_preview?.brand_candidates?.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none font-semibold text-foreground/90">
                      {language === 'CN' ? '本地品牌候选' : 'Local brand candidates'}
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {travelReadiness.shopping_preview.brand_candidates.slice(0, 6).map((item, idx) => (
                        <li key={`${idx}_${item.brand || 'brand'}`}>
                          <span className="text-foreground/90">{item.brand || (language === 'CN' ? '未知品牌' : 'Unknown brand')}</span>
                          {item.match_status ? ` · ${formatBrandMatchStatus(language, item.match_status)}` : ''}
                          {item.reason ? ` · ${item.reason}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="mt-2 font-semibold text-foreground/90">
                  {language === 'CN' ? '在哪里买' : 'Where to buy'}
                </div>
                {travelReadiness.shopping_preview?.buying_channels?.length ? (
                  <div className="mt-1">
                    {travelReadiness.shopping_preview.buying_channels.join(' · ')}
                    {travelReadiness.shopping_preview.city_hint ? ` (${travelReadiness.shopping_preview.city_hint})` : ''}
                  </div>
                ) : null}
                {travelReadiness.store_examples?.length ? (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer select-none font-semibold text-foreground/90">
                      {language === 'CN' ? '示例门店' : 'Example stores'}
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {travelReadiness.store_examples.slice(0, 3).map((store, idx) => (
                        <li key={`store_${idx}_${store.name}`}>
                          <span className="text-foreground/90">{store.name}</span>
                          {store.type ? ` · ${store.type}` : ''}
                          {store.district ? ` (${store.district})` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {travelReadiness.shopping_preview?.note ? (
                  <div className="mt-1">{travelReadiness.shopping_preview.note}</div>
                ) : null}
              </div>

              {safeStringArray(sections.seasonal_context).length ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground/90">
                    {language === 'CN' ? '季节/环境提醒' : 'Seasonal / environmental notes'}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {safeStringArray(sections.seasonal_context).slice(0, 3).map((line, idx) => (
                      <li key={`sc_${idx}`}>• {line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {safeStringArray(sections.routine_adjustments).length ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground/90">
                    {language === 'CN' ? '护肤调整建议' : 'Routine adjustments'}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {safeStringArray(sections.routine_adjustments).slice(0, 4).map((line, idx) => (
                      <li key={`ra_${idx}`}>• {line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {safeStringArray(sections.phased_plan).length ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground/90">
                    {language === 'CN' ? '分阶段安排' : 'Phased plan'}
                  </div>
                  <ol className="mt-1.5 list-decimal pl-4 space-y-1">
                    {safeStringArray(sections.phased_plan).slice(0, 4).map((line, idx) => (
                      <li key={`pp_${idx}`}>{line}</li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {safeStringArray(sections.flight_day_plan).length ? (
                <details className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-semibold text-foreground/90">
                    {language === 'CN' ? '飞行日计划（展开）' : 'Flight day plan (expand)'}
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {safeStringArray(sections.flight_day_plan).slice(0, 4).map((line, idx) => (
                      <li key={`fd_${idx}`}>• {line}</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {safeStringArray(sections.active_handling).length ? (
                <details className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-semibold text-foreground/90">
                    {language === 'CN' ? '活性成分管理（展开）' : 'Active handling (expand)'}
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {safeStringArray(sections.active_handling).slice(0, 3).map((line, idx) => (
                      <li key={`ah_${idx}`}>• {line}</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {travelKitLines.length ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground/90">
                    {language === 'CN' ? '旅行护肤装备清单' : 'Travel skincare kit'}
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {travelKitLines.slice(0, 14).map((line, idx) => {
                      const categoryMatch = line.match(/^(【[^】]+】)\s*(.*)$/);
                      return (
                        <li key={`tk_${idx}`}>
                          {categoryMatch ? (
                            <>
                              <span className="font-semibold text-foreground/90">{categoryMatch[1]}</span>
                              {categoryMatch[2] ? ` ${categoryMatch[2]}` : ''}
                            </>
                          ) : (
                            `• ${line}`
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {safeStringArray(sections.troubleshooting).length ? (
                <details className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-semibold text-foreground/90">
                    {language === 'CN' ? '应急处理（展开）' : 'Quick troubleshooting (expand)'}
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {safeStringArray(sections.troubleshooting).slice(0, 3).map((line, idx) => (
                      <li key={`ts_${idx}`}>• {line}</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {travelReadiness.adaptive_actions?.length ? (
                <details className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <summary className="cursor-pointer select-none font-semibold text-foreground/90">
                    {language === 'CN' ? '适配动作（展开）' : 'Adaptive actions (expand)'}
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {travelReadiness.adaptive_actions.slice(0, 4).map((item, idx) => (
                      <li key={`action_${idx}`}>
                        {item.why ? <div>{item.why}</div> : null}
                        {item.what_to_do ? <div className="text-foreground/90">{item.what_to_do}</div> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {(onOpenRecommendations || onRefineRoutine) ? (
                <div className="flex flex-wrap gap-2">
                  {onOpenRecommendations ? (
                    <button
                      type="button"
                      className="chip-button chip-button-primary"
                      onClick={onOpenRecommendations}
                      aria-label={language === 'CN' ? '查看完整产品推荐' : 'See full recommendations'}
                    >
                      {language === 'CN' ? '查看完整产品推荐' : 'See full recommendations'}
                    </button>
                  ) : null}
                  {onRefineRoutine ? (
                    <button
                      type="button"
                      className="chip-button"
                      onClick={onRefineRoutine}
                      aria-label={language === 'CN' ? '用 AM/PM 补充细化' : 'Refine with AM/PM'}
                    >
                      {language === 'CN' ? '用 AM/PM 补充细化' : 'Refine with AM/PM'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {model?.notes?.length ? (
                <ul className="space-y-1 text-[11px] text-muted-foreground">
                  {model.notes.slice(0, 4).map((note, idx) => (
                    <li key={`${idx}_${note.slice(0, 24)}`} className="truncate">
                      • {note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}

          {missingRecentLogs && onOpenCheckin ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium text-foreground/90">
                    {language === 'CN' ? '想要更准？先做一次今日打卡。' : 'Want a more accurate signal? Add a quick check-in.'}
                  </div>
                  <div>
                    {language === 'CN'
                      ? '我们会用你近 7 天的趋势来调整建议。'
                      : 'We will use your last-7-day trend to tailor advice.'}
                  </div>
                </div>
                <button
                  type="button"
                  className="chip-button chip-button-primary"
                  onClick={onOpenCheckin}
                  aria-label={language === 'CN' ? '打开今日打卡' : 'Open daily check-in'}
                >
                  {language === 'CN' ? '去打卡' : 'Check-in'}
                </button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
