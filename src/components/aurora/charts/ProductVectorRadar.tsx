import React, { useMemo } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from 'recharts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type ProductVectorAxis = 'Hydration' | 'Anti-Aging' | 'Acne Control' | 'Brightening' | 'Value';

export type ProductVector = Record<ProductVectorAxis, number>;

export type ProductVectorContributors = Partial<Record<ProductVectorAxis, string[]>>;

export interface ProductVectorRadarProps {
  className?: string;
  title?: string;
  productLabel?: string;
  idealLabel?: string;
  productVector: ProductVector;
  idealVector: ProductVector;
  contributors?: ProductVectorContributors;
  summary?: string;
  matchScore?: number; // 0-100
}

type ChartRow = {
  axisKey: ProductVectorAxis;
  axisLabel: string;
  product: number;
  ideal: number;
  ingredients: string[];
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeMatchScore(product: ProductVector, ideal: ProductVector) {
  const axes: ProductVectorAxis[] = ['Hydration', 'Anti-Aging', 'Acne Control', 'Brightening', 'Value'];
  const diffs = axes.map((k) => Math.abs(clampPercent(product[k]) - clampPercent(ideal[k])) / 100);
  const mismatch = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return clampPercent((1 - mismatch) * 100);
}

function generateSummary(product: ProductVector, ideal: ProductVector) {
  const axes: ProductVectorAxis[] = ['Hydration', 'Anti-Aging', 'Acne Control', 'Brightening', 'Value'];
  const deltas = axes.map((k) => ({ axis: k, delta: clampPercent(product[k]) - clampPercent(ideal[k]), abs: Math.abs(clampPercent(product[k]) - clampPercent(ideal[k])) }));

  const best = [...deltas].sort((a, b) => a.abs - b.abs)[0];
  const worst = [...deltas].sort((a, b) => b.abs - a.abs)[0];
  const lowerThanIdeal = [...deltas].filter((d) => d.delta < 0).sort((a, b) => b.abs - a.abs)[0];

  if (!best || !worst) return 'Vector summary unavailable.';

  if (lowerThanIdeal) {
    return `High match on ${best.axis}, but lower on ${lowerThanIdeal.axis} than your ideal profile.`;
  }

  return `High match on ${best.axis}. Overall differences are small across your ideal profile.`;
}

function ProductVectorTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  const ingredients = Array.isArray(row.ingredients) ? row.ingredients.slice(0, 3) : [];

  return (
    <div className="rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-card backdrop-blur">
      <div className="text-xs font-semibold text-foreground">{row.axisLabel}</div>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>
          Product: <span className="font-semibold text-foreground">{clampPercent(row.product)}</span>
        </span>
        <span>
          Ideal: <span className="font-semibold text-foreground">{clampPercent(row.ideal)}</span>
        </span>
      </div>

      {ingredients.length ? (
        <div className="mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Top ingredients</div>
          <ul className="mt-1 space-y-0.5 text-[11px] text-foreground">
            {ingredients.map((ing) => (
              <li key={ing} className="truncate">
                {ing}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ProductVectorRadar({
  className,
  title = 'Vector Radar',
  productLabel = 'Product',
  idealLabel = 'Your Ideal',
  productVector,
  idealVector,
  contributors,
  summary,
  matchScore,
}: ProductVectorRadarProps) {
  const axes: ProductVectorAxis[] = ['Hydration', 'Anti-Aging', 'Acne Control', 'Brightening', 'Value'];

  const data: ChartRow[] = useMemo(() => {
    return axes.map((axisKey) => ({
      axisKey,
      axisLabel: axisKey,
      product: clampPercent(productVector[axisKey]),
      ideal: clampPercent(idealVector[axisKey]),
      ingredients: (contributors?.[axisKey] ?? []).slice(0, 3),
    }));
  }, [contributors, idealVector, productVector]);

  const computedMatch = useMemo(() => (typeof matchScore === 'number' ? clampPercent(matchScore) : computeMatchScore(productVector, idealVector)), [idealVector, matchScore, productVector]);
  const computedSummary = useMemo(() => (summary && summary.trim() ? summary.trim() : generateSummary(productVector, idealVector)), [idealVector, productVector, summary]);

  return (
    <Card className={cn('w-full bg-card/90 backdrop-blur-sm border-border/70 shadow-card', className)}>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="mt-0.5 text-sm font-semibold text-foreground">
              {productLabel} vs {idealLabel}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr,0.9fr] sm:items-center">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data} outerRadius="78%">
                <PolarGrid gridType="circle" stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <PolarAngleAxis
                  dataKey="axisLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={false}
                  tickLine={false}
                  axisLine={false}
                />
                <Radar
                  name={productLabel}
                  dataKey="product"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.5}
                  isAnimationActive
                />
                <Radar
                  name={idealLabel}
                  dataKey="ideal"
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  fill="transparent"
                  fillOpacity={0}
                  isAnimationActive={false}
                />
                <Tooltip cursor={false} content={<ProductVectorTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vector Match Score</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{computedMatch}% Match</div>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{computedSummary}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
