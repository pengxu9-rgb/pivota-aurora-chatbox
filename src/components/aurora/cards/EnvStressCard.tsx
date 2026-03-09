import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Globe, ChevronRight, Search } from 'lucide-react';

import { EnvStressBreakdown } from '@/components/aurora/charts/EnvStressBreakdown';
import { EnvStressRadar } from '@/components/aurora/charts/EnvStressRadar';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { normalizeEnvStressUiModelV1 } from '@/lib/auroraUiContracts';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/types';
import type { CategorizedKitEntry, TravelProductLookupQuery } from '@/lib/auroraEnvStress';

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
  return language === 'CN' ? 'AI 推荐' : 'AI-suggested';
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
}

function pickFirstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function buildTravelLookupSearchQuery(language: Language, rawTerm: string | null | undefined) {
  const term = typeof rawTerm === 'string' ? rawTerm.trim() : '';
  if (!term) return language === 'CN' ? '护肤产品' : 'skincare';

  const normalized = term.toLowerCase();
  const englishHints = [
    'skincare',
    'sunscreen',
    'spf',
    'serum',
    'cream',
    'cleanser',
    'mask',
    'moisturizer',
    'moisturiser',
    'lotion',
    'balm',
    'gel',
    'essence',
    'toner',
    'ampoule',
    'mist',
  ];
  const chineseHints = ['护肤', '防晒', '面霜', '乳', '精华', '面膜', '喷雾', '洁面', '爽肤水', '修护', '保湿', '舒缓'];
  const hasSkincareHint =
    englishHints.some((hint) => normalized.includes(hint)) ||
    chineseHints.some((hint) => term.includes(hint));

  if (hasSkincareHint) return term;
  return language === 'CN' ? `${term} 护肤` : `${term} skincare`;
}

function buildConcernBrowseLookup(entry: CategorizedKitEntry, language: Language): TravelProductLookupQuery {
  const firstSuggestedProduct = entry.brand_suggestions?.find((item) => typeof item.product === 'string' && item.product.trim())?.product ?? null;
  const firstPreparation = entry.preparations.find((item) => typeof item.name === 'string' && item.name.trim())?.name ?? null;
  const preferBrand = entry.brand_suggestions?.find((item) => typeof item.brand === 'string' && item.brand.trim())?.brand ?? null;
  const searchSeed = pickFirstText(firstSuggestedProduct, firstPreparation, entry.title);

  return {
    searchQuery: buildTravelLookupSearchQuery(language, searchSeed),
    categoryTitle: entry.title,
    ingredientHints: entry.ingredient_logic,
    preferBrand,
  };
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

/* ---------- Section sub-components ---------- */

function ClimateAnalysisSection({
  language,
  travelReadiness,
  usesLiveWeather,
  usesClimateFallback,
  weatherSourceLabel,
  metricRows,
  compactSignals,
}: {
  language: Language;
  travelReadiness: Record<string, any>;
  usesLiveWeather: boolean;
  usesClimateFallback: boolean;
  weatherSourceLabel: string | null;
  metricRows: { key: string; label: string; value: string | null }[];
  compactSignals: string[];
}) {
  const visibleMetricRows = usesLiveWeather ? metricRows : [];
  const visibleCompactSignals = usesLiveWeather ? compactSignals : [];

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
        <div className="font-semibold text-foreground/90">
          {usesClimateFallback
            ? language === 'CN' ? '目的地气候概览' : 'Destination climate'
            : language === 'CN' ? '目的地差异' : 'Destination delta'}
        </div>
        <div className="mt-1">
          {language === 'CN' ? '目的地：' : 'Destination: '}
          {travelReadiness.destination_context?.destination || (language === 'CN' ? '未知' : 'Unknown')}
          {travelReadiness.destination_context?.start_date || travelReadiness.destination_context?.end_date
            ? ` (${travelReadiness.destination_context?.start_date || '-'} -> ${travelReadiness.destination_context?.end_date || '-'})`
            : ''}
        </div>
        {weatherSourceLabel ? (
          <div className="mt-1.5 inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-foreground/85">
            {weatherSourceLabel}
          </div>
        ) : null}
        {usesClimateFallback ? (
          <div className="mt-1.5">
            {language === 'CN'
              ? '实时天气暂不可用，以下按目的地气候特征给出定性建议。'
              : 'Live weather is unavailable, so the guidance below uses destination climate patterns.'}
          </div>
        ) : null}

        {visibleMetricRows.length ? (
          <ul className="mt-1.5 space-y-1">
            {visibleMetricRows.map((row) => (
              <li key={row.key}>
                <span className="font-medium text-foreground/90">{row.label}:</span> {row.value}
              </li>
            ))}
          </ul>
        ) : null}

        {visibleCompactSignals.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {visibleCompactSignals.map((line) => (
              <span key={line} className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] text-foreground/85">
                {line}
              </span>
            ))}
          </div>
        ) : null}

        {travelReadiness.delta_vs_home?.summary_tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {travelReadiness.delta_vs_home.summary_tags.slice(0, 6).map((tag: string) => (
              <span key={tag} className="rounded-full border border-border/70 px-2 py-0.5 text-[10px]">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {usesLiveWeather && travelReadiness.forecast_window?.length ? (
        <details className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer select-none font-semibold text-foreground/90">
            {language === 'CN' ? '逐日天气预报（展开）' : 'Daily forecast (expand)'}
          </summary>
          <ul className="mt-1.5 space-y-0.5">
            {travelReadiness.forecast_window.slice(0, 7).map((day: any, idx: number) => (
              <li key={`fc_${idx}_${day.date}`} className="flex gap-1.5">
                <span className="font-medium text-foreground/90 shrink-0">{day.date}</span>
                <span>
                  {typeof day.temp_low_c === 'number' || typeof day.temp_high_c === 'number'
                    ? `${day.temp_low_c ?? '-'}° ~ ${day.temp_high_c ?? '-'}°C`
                    : ''}
                  {day.condition_text ? ` · ${day.condition_text}` : ''}
                  {typeof day.precip_mm === 'number' && day.precip_mm > 0 ? ` · ${day.precip_mm}mm` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {travelReadiness.alerts?.length ? (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50/30 p-2.5 text-[11px] text-muted-foreground">
          <div className="font-semibold text-amber-700">
            {language === 'CN' ? '天气预警' : 'Weather alerts'}
          </div>
          <ul className="mt-1.5 space-y-1">
            {travelReadiness.alerts.slice(0, 2).map((alert: any, idx: number) => (
              <li key={`alert_${idx}`}>
                {alert.severity ? <span className="font-medium text-amber-700">{alert.severity} </span> : null}
                {alert.title || alert.summary || ''}
                {alert.action_hint ? <div className="mt-0.5">{alert.action_hint}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function ConcernCard({
  entry,
  language,
  index,
  onProductLookup,
}: {
  entry: CategorizedKitEntry;
  language: Language;
  index: number;
  onProductLookup?: (query: TravelProductLookupQuery) => void;
}) {
  const handlePrepClick = (prepName: string) => {
    onProductLookup?.({
      searchQuery: buildTravelLookupSearchQuery(language, prepName),
      categoryTitle: entry.title,
      ingredientHints: entry.ingredient_logic,
    });
  };

  const handleBrowseProducts = () => {
    onProductLookup?.(buildConcernBrowseLookup(entry, language));
  };

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-foreground/90">{entry.title}</div>
        {entry.climate_link ? (
          <span className="shrink-0 rounded-full border border-blue-300/60 bg-blue-50/40 px-1.5 py-0.5 text-[9px] text-blue-700">
            {entry.climate_link}
          </span>
        ) : null}
      </div>

      {entry.why ? (
        <div className="mt-1.5 text-foreground/80">{entry.why}</div>
      ) : null}

      {entry.ingredient_logic ? (
        <div className="mt-1 text-muted-foreground/80 italic">{entry.ingredient_logic}</div>
      ) : null}

      {entry.preparations.length ? (
        <div className="mt-2">
          <div className="text-[10px] font-medium text-foreground/70 uppercase tracking-wide">
            {language === 'CN' ? '准备清单' : 'What to prepare'}
          </div>
          <ul className="mt-1 space-y-0.5">
            {entry.preparations.map((prep, pIdx) => (
              <li
                key={`prep_${pIdx}_${prep.name}`}
                role={onProductLookup ? 'button' : undefined}
                tabIndex={onProductLookup ? 0 : undefined}
                onClick={() => handlePrepClick(prep.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePrepClick(prep.name);
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg',
                  onProductLookup && 'cursor-pointer hover:bg-muted/40 px-1.5 py-1 -mx-1.5 transition-colors',
                )}
              >
                <span className="text-foreground/90 shrink-0">•</span>
                <span className="flex-1 min-w-0">
                  <span className="text-foreground/90">{prep.name}</span>
                  {prep.detail ? <span className="text-muted-foreground/70"> — {prep.detail}</span> : null}
                </span>
                {onProductLookup ? <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {onProductLookup ? (
        <button
          type="button"
          onClick={handleBrowseProducts}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-[10px] font-medium text-foreground/70 transition-colors hover:bg-muted/40"
        >
          <Search className="h-3 w-3" />
          {language === 'CN'
            ? `浏览推荐产品${entry.brand_suggestions?.length ? ` (${entry.brand_suggestions.length})` : ''}`
            : `Browse products${entry.brand_suggestions?.length ? ` (${entry.brand_suggestions.length})` : ''}`}
        </button>
      ) : entry.brand_suggestions?.length ? (
        <Accordion type="single" collapsible className="mt-2 w-full">
          <AccordionItem value={`brands_${index}`} className="border-b-0">
            <AccordionTrigger className="py-1.5 text-[10px] font-medium text-foreground/70 hover:no-underline">
              {language === 'CN'
                ? `查看推荐品牌 (${entry.brand_suggestions.length})`
                : `View suggested products (${entry.brand_suggestions.length})`}
            </AccordionTrigger>
            <AccordionContent className="pb-1 pt-0">
              <ul className="space-y-1.5">
                {entry.brand_suggestions.map((bs, bIdx) => (
                  <li key={`bs_${bIdx}_${bs.brand || bs.product}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground/90">
                        {bs.product || bs.brand || (language === 'CN' ? '未知' : 'Unknown')}
                        {bs.product && bs.brand ? ` · ${bs.brand}` : ''}
                      </span>
                      {bs.match_status ? (
                        <span className="shrink-0 rounded-full border border-amber-300/60 bg-amber-50/40 px-1.5 py-0.5 text-[9px] text-amber-700">
                          {formatBrandMatchStatus(language, bs.match_status)}
                        </span>
                      ) : null}
                    </div>
                    {bs.reason ? <div className="text-muted-foreground/70">{bs.reason}</div> : null}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}

function ConcernRecommendationsSection({
  language,
  travelReadiness,
  sections,
  onProductLookup,
}: {
  language: Language;
  travelReadiness: Record<string, any>;
  sections: StructuredSections;
  onProductLookup?: (query: TravelProductLookupQuery) => void;
}) {
  const categorizedKit: CategorizedKitEntry[] | undefined = travelReadiness.categorized_kit;
  const hasCategorizedKit = Array.isArray(categorizedKit) && categorizedKit.length > 0;

  if (hasCategorizedKit) {
    return (
      <>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/60 px-0.5">
          {language === 'CN' ? '护肤关注事项' : 'Skincare concerns & preparation'}
        </div>
        {categorizedKit!.map((entry, idx) => (
          <ConcernCard key={entry.id || `ck_${idx}`} entry={entry} language={language} index={idx} onProductLookup={onProductLookup} />
        ))}

        <BuyingChannelsFooter language={language} travelReadiness={travelReadiness} />
      </>
    );
  }

  /* ---------- Fallback: old flat layout for backwards compat ---------- */
  const travelKitLines = safeStringArray(sections.travel_kit).length
    ? safeStringArray(sections.travel_kit)
    : safeStringArray(sections.product_guidance).length
      ? safeStringArray(sections.product_guidance)
      : safeStringArray(sections.packing_list);

  return (
    <>
      {travelReadiness.personal_focus?.length ? (
        <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
          <div className="font-semibold text-foreground/90">
            {language === 'CN' ? '你要重点注意' : 'Personal focus'}
          </div>
          <ul className="mt-1.5 space-y-1">
            {travelReadiness.personal_focus.slice(0, 1).map((item: any, idx: number) => (
              <li key={`${idx}_${item.focus || item.what_to_do || 'focus'}`}>
                {item.focus ? <div className="text-foreground/90">{item.focus}</div> : null}
                {item.what_to_do ? <div>{item.what_to_do}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Legacy shopping preview */}
      <LegacyShoppingPreview language={language} travelReadiness={travelReadiness} />

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
    </>
  );
}

function LegacyShoppingPreview({
  language,
  travelReadiness,
}: {
  language: Language;
  travelReadiness: Record<string, any>;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
      <div className="font-semibold text-foreground/90">
        {language === 'CN' ? '建议买什么' : 'Shopping preview'}
      </div>
      {travelReadiness.shopping_preview?.products?.length ? (
        <ul className="mt-1.5 space-y-1.5">
          {travelReadiness.shopping_preview.products.slice(0, 3).map((item: Record<string, unknown>, idx: number) => {
            const sourceLabel = item.product_source === 'llm_generated' || item.product_source === 'llm_only'
              ? (language === 'CN' ? 'AI 推荐' : 'AI-suggested')
              : item.product_source === 'rule_fallback'
                ? (language === 'CN' ? '通用建议' : 'General recommendation')
                : null;
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
            {travelReadiness.shopping_preview.brand_candidates.slice(0, 6).map((item: any, idx: number) => (
              <li key={`${idx}_${item.brand || 'brand'}`}>
                <span className="text-foreground/90">{item.brand || (language === 'CN' ? '未知品牌' : 'Unknown brand')}</span>
                {item.match_status ? ` · ${formatBrandMatchStatus(language, item.match_status)}` : ''}
                {item.reason ? ` · ${item.reason}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <BuyingChannelsFooter language={language} travelReadiness={travelReadiness} />
    </div>
  );
}

function BuyingChannelsFooter({
  language,
  travelReadiness,
}: {
  language: Language;
  travelReadiness: Record<string, any>;
}) {
  const hasBuying = travelReadiness.shopping_preview?.buying_channels?.length;
  const hasStores = travelReadiness.store_examples?.length;
  if (!hasBuying && !hasStores) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
      <div className="font-semibold text-foreground/90">
        {language === 'CN' ? '在哪里买' : 'Where to buy'}
      </div>
      {hasBuying ? (
        <div className="mt-1">
          {travelReadiness.shopping_preview.buying_channels.join(' · ')}
          {travelReadiness.shopping_preview.city_hint ? ` (${travelReadiness.shopping_preview.city_hint})` : ''}
        </div>
      ) : null}
      {hasStores ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer select-none font-semibold text-foreground/90">
            {language === 'CN' ? '示例门店' : 'Example stores'}
          </summary>
          <ul className="mt-1 space-y-0.5">
            {travelReadiness.store_examples.slice(0, 3).map((store: any, idx: number) => (
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
  );
}

function SituationalAdviceSection({
  language,
  travelReadiness,
  sections,
}: {
  language: Language;
  travelReadiness: Record<string, any>;
  sections: StructuredSections;
}) {
  const hasPersonalFocus = travelReadiness.personal_focus?.length > 0;
  const hasJetlag = travelReadiness.jetlag_sleep?.sleep_tips?.length || travelReadiness.jetlag_sleep?.mask_tips?.length;
  const hasFlightDay = safeStringArray(sections.flight_day_plan).length > 0;
  const hasActiveHandling = safeStringArray(sections.active_handling).length > 0;
  const hasTroubleshooting = safeStringArray(sections.troubleshooting).length > 0;
  const hasAdaptive = travelReadiness.adaptive_actions?.length > 0;
  const hasCategorizedKit = Array.isArray(travelReadiness.categorized_kit) && travelReadiness.categorized_kit.length > 0;

  const hasAnything = (hasCategorizedKit && hasPersonalFocus) || hasJetlag || hasFlightDay || hasActiveHandling || hasTroubleshooting || hasAdaptive;
  if (!hasAnything) return null;

  return (
    <Accordion type="multiple" className="w-full space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-foreground/60 px-0.5 pt-1">
        {language === 'CN' ? '出行情景建议' : 'Situational advice'}
      </div>

      {hasCategorizedKit && hasPersonalFocus ? (
        <AccordionItem value="personal_focus" className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <AccordionTrigger className="px-2.5 py-2 text-[11px] font-semibold text-foreground/90 hover:no-underline">
            {language === 'CN' ? '个人重点关注' : 'Personal focus'}
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2 pt-0 text-[11px] text-muted-foreground">
            <ul className="space-y-1">
              {travelReadiness.personal_focus.slice(0, 3).map((item: any, idx: number) => (
                <li key={`pf_${idx}`}>
                  {item.focus ? <div className="text-foreground/90">{item.focus}</div> : null}
                  {item.why ? <div className="text-muted-foreground/80">{item.why}</div> : null}
                  {item.what_to_do ? <div>{item.what_to_do}</div> : null}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {hasJetlag ? (
        <AccordionItem value="jetlag" className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <AccordionTrigger className="px-2.5 py-2 text-[11px] font-semibold text-foreground/90 hover:no-underline">
            {language === 'CN' ? '时差与睡眠' : 'Jet lag & sleep'}
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2 pt-0 text-[11px] text-muted-foreground">
            <div>
              {language === 'CN' ? '时区差：' : 'Timezone diff: '}
              {typeof travelReadiness.jetlag_sleep?.hours_diff === 'number'
                ? `${travelReadiness.jetlag_sleep.hours_diff}h`
                : language === 'CN' ? '未知' : 'Unknown'}
              {travelReadiness.jetlag_sleep?.risk_level ? ` (${travelReadiness.jetlag_sleep.risk_level})` : ''}
            </div>
            {travelReadiness.jetlag_sleep?.sleep_tips?.length ? (
              <div className="mt-1">• {travelReadiness.jetlag_sleep.sleep_tips[0]}</div>
            ) : null}
            {travelReadiness.jetlag_sleep?.mask_tips?.length ? (
              <div className="mt-1">• {travelReadiness.jetlag_sleep.mask_tips[0]}</div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {hasFlightDay ? (
        <AccordionItem value="flight_day" className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <AccordionTrigger className="px-2.5 py-2 text-[11px] font-semibold text-foreground/90 hover:no-underline">
            {language === 'CN' ? '飞行日计划' : 'Flight day plan'}
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2 pt-0 text-[11px] text-muted-foreground">
            <ul className="space-y-1">
              {safeStringArray(sections.flight_day_plan).slice(0, 4).map((line, idx) => (
                <li key={`fd_${idx}`}>• {line}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {hasActiveHandling ? (
        <AccordionItem value="active_handling" className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <AccordionTrigger className="px-2.5 py-2 text-[11px] font-semibold text-foreground/90 hover:no-underline">
            {language === 'CN' ? '活性成分管理' : 'Active handling'}
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2 pt-0 text-[11px] text-muted-foreground">
            <ul className="space-y-1">
              {safeStringArray(sections.active_handling).slice(0, 3).map((line, idx) => (
                <li key={`ah_${idx}`}>• {line}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {hasTroubleshooting ? (
        <AccordionItem value="troubleshooting" className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <AccordionTrigger className="px-2.5 py-2 text-[11px] font-semibold text-foreground/90 hover:no-underline">
            {language === 'CN' ? '应急处理' : 'Quick troubleshooting'}
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2 pt-0 text-[11px] text-muted-foreground">
            <ul className="space-y-1">
              {safeStringArray(sections.troubleshooting).slice(0, 3).map((line, idx) => (
                <li key={`ts_${idx}`}>• {line}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}

      {hasAdaptive ? (
        <AccordionItem value="adaptive" className="rounded-xl border border-border/70 bg-muted/20 overflow-hidden">
          <AccordionTrigger className="px-2.5 py-2 text-[11px] font-semibold text-foreground/90 hover:no-underline">
            {language === 'CN' ? '适配动作' : 'Adaptive actions'}
          </AccordionTrigger>
          <AccordionContent className="px-2.5 pb-2 pt-0 text-[11px] text-muted-foreground">
            <ul className="space-y-1">
              {travelReadiness.adaptive_actions.slice(0, 4).map((item: any, idx: number) => (
                <li key={`action_${idx}`}>
                  {item.why ? <div>{item.why}</div> : null}
                  {item.what_to_do ? <div className="text-foreground/90">{item.what_to_do}</div> : null}
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ) : null}
    </Accordion>
  );
}

/* ---------- Main component ---------- */

export function EnvStressCard({
  payload,
  language,
  onOpenCheckin,
  onOpenRecommendations,
  onRefineRoutine,
  onProductLookup,
}: {
  payload: unknown;
  language: Language;
  onOpenCheckin?: () => void;
  onOpenRecommendations?: () => void;
  onRefineRoutine?: () => void;
  onProductLookup?: (query: TravelProductLookupQuery) => void;
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
  const hasDrivers = model?.radar?.some((r: Record<string, unknown>) => Array.isArray(r.drivers) && r.drivers.length > 0) ?? false;
  const missingInputs = Array.isArray(travelReadiness?.confidence?.missing_inputs)
    ? travelReadiness.confidence?.missing_inputs
    : [];
  const missingRecentLogs = Boolean(
    missingInputs.includes('recent_logs') || model?.notes?.some((n) => typeof n === 'string' && n.includes('recent_logs')),
  );
  const envSource = String(travelReadiness?.destination_context?.env_source || '').trim().toLowerCase();
  const usesLiveWeather = envSource === 'weather_api';
  const usesClimateFallback = Boolean(travelReadiness) && envSource !== '' && envSource !== 'weather_api';
  const weatherSourceLabel = usesLiveWeather
    ? language === 'CN' ? '实时天气' : 'Live weather'
    : usesClimateFallback
      ? language === 'CN' ? '气候常模估算' : 'Climate baseline estimate'
      : null;

  const metricRows = useMemo(
    () =>
      [
        { key: 'temperature', label: language === 'CN' ? '温度' : 'Temperature', value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.temperature) },
        { key: 'humidity', label: language === 'CN' ? '湿度' : 'Humidity', value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.humidity) },
        { key: 'uv', label: language === 'CN' ? '紫外线' : 'UV', value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.uv) },
        { key: 'wind', label: language === 'CN' ? '风' : 'Wind', value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.wind) },
        { key: 'precip', label: language === 'CN' ? '降水' : 'Precipitation', value: formatDeltaLine(language, travelReadiness?.delta_vs_home?.precip) },
      ].filter((row) => Boolean(row.value)),
    [language, travelReadiness],
  );

  const compactSignals = useMemo(
    () =>
      [
        formatCompactSignal({ language, metric: travelReadiness?.delta_vs_home?.temperature, labelCn: '温差', labelEn: 'Temp' }),
        formatCompactSignal({ language, metric: travelReadiness?.delta_vs_home?.humidity, labelCn: '湿度', labelEn: 'Humidity' }),
        formatCompactSignal({ language, metric: travelReadiness?.delta_vs_home?.uv, labelCn: 'UV', labelEn: 'UV' }),
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
          {/* --- ESS score & radar --- */}
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
                ) : <span />}
              </div>
              {tierDescription ? (
                <div className="text-[11px] text-muted-foreground/85">{tierDescription}</div>
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

          {/* --- SECTION 1: Climate Analysis --- */}
          {travelReadiness ? (
            <>
              <ClimateAnalysisSection
                language={language}
                travelReadiness={travelReadiness}
                usesLiveWeather={usesLiveWeather}
                usesClimateFallback={usesClimateFallback}
                weatherSourceLabel={weatherSourceLabel}
                metricRows={metricRows}
                compactSignals={compactSignals}
              />

              {/* --- SECTION 2: Concern-based Recommendations --- */}
              <ConcernRecommendationsSection
                language={language}
                travelReadiness={travelReadiness}
                sections={sections}
                onProductLookup={onProductLookup}
              />

              {/* --- SECTION 3: Situational Advice --- */}
              <SituationalAdviceSection
                language={language}
                travelReadiness={travelReadiness}
                sections={sections}
              />

              {/* --- CTA buttons --- */}
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

          {/* --- Check-in nudge --- */}
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
