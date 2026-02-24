import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';

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

type TravelReadinessSummaryLike = {
  delta_vs_home?: {
    baseline_status?: string | null;
    summary_tags?: string[];
  };
};

function formatNumber(value: unknown, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const base = 10 ** digits;
  const rounded = Math.round(value * base) / base;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

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
  return language === 'CN' ? 'LLM 候选' : 'LLM candidate';
}

function buildTravelConclusion(
  language: Language,
  travelReadiness: TravelReadinessSummaryLike | undefined,
) {
  const baselineStatus = String(travelReadiness?.delta_vs_home?.baseline_status || '').trim().toLowerCase();
  if (baselineStatus === 'baseline_unavailable') {
    return language === 'CN'
      ? '常驻地基线不足，本次按目的地阈值给出稳妥方案。'
      : 'Home baseline is unavailable, so this plan uses destination-first thresholds.';
  }

  const summaryTags = Array.isArray(travelReadiness?.delta_vs_home?.summary_tags)
    ? travelReadiness?.delta_vs_home?.summary_tags
    : [];
  const tags = summaryTags.map((tag) => String(tag || '').trim().toLowerCase());
  const hasTag = (token: string) => tags.includes(token);

  if (hasTag('higher_uv') && hasTag('more_humid')) {
    return language === 'CN'
      ? '目的地更湿且 UV 更高，建议轻保湿 + 严格防晒补涂。'
      : 'Destination is more humid with higher UV; use lighter hydration and strict sunscreen reapplication.';
  }
  if (hasTag('higher_uv')) {
    return language === 'CN'
      ? '核心风险是 UV 压力上升，请提高防晒档位并固定补涂频率。'
      : 'The primary risk is higher UV pressure; raise SPF tier and keep a fixed reapplication cadence.';
  }
  if (hasTag('more_humid')) {
    return language === 'CN'
      ? '核心变化是湿度上升，白天建议更轻薄、夜间强调修护。'
      : 'The key change is higher humidity; keep AM layers lighter and PM repair stronger.';
  }
  if (hasTag('colder') || hasTag('drier') || hasTag('windier')) {
    return language === 'CN'
      ? '目的地偏冷/偏干/偏风，建议提高屏障修护和保湿频次。'
      : 'Destination trends colder/drier/windier; increase barrier repair and moisturizer frequency.';
  }
  return language === 'CN'
    ? '与常驻地差异有限，维持基础流程并做轻量调整即可。'
    : 'Conditions are close to home; keep your base routine and apply light adjustments.';
}

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
  const travelReadiness = model?.travel_readiness;
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

  const forecastRows = Array.isArray(travelReadiness?.forecast_window)
    ? travelReadiness.forecast_window.filter(Boolean).slice(0, 7)
    : [];
  const travelAlerts = Array.isArray(travelReadiness?.alerts)
    ? travelReadiness.alerts.filter(Boolean).slice(0, 4)
    : [];
  const recoBundle = Array.isArray(travelReadiness?.reco_bundle)
    ? travelReadiness.reco_bundle.filter(Boolean).slice(0, 4)
    : [];
  const storeExamples = Array.isArray(travelReadiness?.store_examples)
    ? travelReadiness.store_examples.filter(Boolean).slice(0, 4)
    : [];
  const keyDeltaRows = metricRows.slice(0, 3);
  const conclusionLine = buildTravelConclusion(language, travelReadiness);

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
              {model?.radar?.length ? (
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
                  {language === 'CN' ? '旅行结论' : 'Travel snapshot'}
                </div>
                <div className="mt-1">
                  {language === 'CN' ? '目的地：' : 'Destination: '}
                  {travelReadiness.destination_context?.destination || (language === 'CN' ? '未知' : 'Unknown')}
                  {travelReadiness.destination_context?.start_date || travelReadiness.destination_context?.end_date
                    ? ` (${travelReadiness.destination_context?.start_date || '-'} -> ${travelReadiness.destination_context?.end_date || '-'})`
                    : ''}
                </div>
                {keyDeltaRows.length ? (
                  <div className="mt-1.5">
                    <div className="font-medium text-foreground/90">
                      {language === 'CN' ? '关键差异（前 3）' : 'Key deltas (top 3)'}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {keyDeltaRows.map((row) => (
                        <li key={row.key}>
                          <span className="font-medium text-foreground/90">{row.label}:</span> {row.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-2 rounded-lg border border-border/60 bg-background/70 px-2 py-1.5 text-foreground/90">
                  {conclusionLine}
                </div>
                {(onOpenRecommendations || onRefineRoutine) ? (
                  <div className="mt-2 flex flex-wrap gap-2">
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

              {forecastRows.length ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  <div className="font-semibold text-foreground/90">
                    {language === 'CN' ? '逐日天气（目的地）' : 'Daily forecast (destination)'}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {forecastRows.slice(0, 2).map((row, idx) => {
                      const low = formatNumber(row.temp_low_c, 1);
                      const high = formatNumber(row.temp_high_c, 1);
                      const uv = formatNumber(row.uv_max, 1);
                      const humidity = formatNumber(row.humidity_mean, 0);
                      return (
                        <li key={`${idx}_${row.date || 'forecast'}`}>
                          <div className="text-foreground/90">
                            {row.date || (language === 'CN' ? '未知日期' : 'Unknown date')}
                            {high || low ? ` · ${low ?? '-'}~${high ?? '-'}C` : ''}
                            {typeof row.condition_text === 'string' && row.condition_text.trim() ? ` · ${row.condition_text}` : ''}
                          </div>
                          {(uv || humidity) ? (
                            <div>
                              {uv ? `UV ${uv}` : ''}
                              {uv && humidity ? ' · ' : ''}
                              {humidity ? `${language === 'CN' ? '湿度' : 'Humidity'} ${humidity}%` : ''}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {forecastRows.length > 2 ? (
                    <details className="mt-1 text-[11px]">
                      <summary className="cursor-pointer select-none text-muted-foreground">
                        {language === 'CN' ? '展开完整预报' : 'Show full forecast'}
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {forecastRows.slice(2).map((row, idx) => (
                          <li key={`full_${idx}_${row.date || 'forecast'}`}>
                            <span className="text-foreground/90">
                              {row.date || (language === 'CN' ? '未知日期' : 'Unknown date')}
                            </span>
                            {typeof row.temp_low_c === 'number' || typeof row.temp_high_c === 'number'
                              ? ` · ${formatNumber(row.temp_low_c, 1) ?? '-'}~${formatNumber(row.temp_high_c, 1) ?? '-'}C`
                              : ''}
                            {typeof row.condition_text === 'string' && row.condition_text.trim() ? ` · ${row.condition_text}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground/90">
                  {language === 'CN' ? '官方预警' : 'Official alerts'}
                </div>
                {travelAlerts.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {travelAlerts.slice(0, 2).map((item, idx) => (
                      <li key={`alert_${idx}_${item.title || item.provider || 'alert'}`}>
                        <div className="text-foreground/90">
                          {item.title || (language === 'CN' ? '预警' : 'Alert')}
                          {item.severity ? ` · ${item.severity}` : ''}
                        </div>
                        {item.summary ? <div>{item.summary}</div> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1.5">
                    {language === 'CN'
                      ? '当前未检索到官方天气预警。'
                      : 'No official weather alert currently.'}
                  </div>
                )}
              </div>

              <details className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                <summary className="cursor-pointer select-none font-semibold text-foreground/90">
                  {language === 'CN' ? '更多旅行细节（展开）' : 'More travel details (expand)'}
                </summary>
                <div className="mt-2 space-y-2.5">
                  {travelReadiness.personal_focus?.length ? (
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
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
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
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

                  {recoBundle.length ? (
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <div className="font-semibold text-foreground/90">
                        {language === 'CN' ? '动作与产品策略' : 'Action and product strategy'}
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {recoBundle.slice(0, 2).map((item, idx) => (
                          <li key={`bundle_${idx}_${item.trigger || item.action || 'bundle'}`}>
                            {item.trigger ? <div className="text-foreground/90">{item.trigger}</div> : null}
                            {item.action ? <div>{item.action}</div> : null}
                            {item.product_types?.length ? (
                              <div>
                                {language === 'CN' ? '建议品类：' : 'Product types: '}
                                {item.product_types.join(' · ')}
                              </div>
                            ) : null}
                            {item.reapply_rule ? <div>{item.reapply_rule}</div> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                    <div className="font-semibold text-foreground/90">
                      {language === 'CN' ? '建议买什么' : 'Shopping preview'}
                    </div>
                    {travelReadiness.shopping_preview?.products?.length ? (
                      <ul className="mt-1.5 space-y-1">
                        {travelReadiness.shopping_preview.products.slice(0, 1).map((item, idx) => (
                          <li key={`${idx}_${item.product_id || item.name || 'product'}`}>
                            <div className="text-foreground/90">
                              {item.name}
                              {item.brand ? ` · ${item.brand}` : ''}
                            </div>
                            {item.reasons?.length ? <div>{item.reasons.join(' · ')}</div> : null}
                          </li>
                        ))}
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
                    {travelReadiness.shopping_preview?.note ? (
                      <div className="mt-1">{travelReadiness.shopping_preview.note}</div>
                    ) : null}
                  </div>

                  {storeExamples.length ? (
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <div className="font-semibold text-foreground/90">
                        {language === 'CN' ? '示例门店' : 'Store examples'}
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {storeExamples.slice(0, 3).map((item, idx) => (
                          <li key={`store_${idx}_${item.name || item.address || 'store'}`}>
                            <div className="text-foreground/90">
                              {item.name || (language === 'CN' ? '门店' : 'Store')}
                              {item.type ? ` · ${item.type}` : ''}
                            </div>
                            {item.address ? <div>{item.address}</div> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {travelReadiness.adaptive_actions?.length ? (
                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <div className="font-semibold text-foreground/90">
                        {language === 'CN' ? '适配动作' : 'Adaptive actions'}
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {travelReadiness.adaptive_actions.slice(0, 4).map((item, idx) => (
                          <li key={`action_${idx}`}>
                            {item.why ? <div>{item.why}</div> : null}
                            {item.what_to_do ? <div className="text-foreground/90">{item.what_to_do}</div> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </details>
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
