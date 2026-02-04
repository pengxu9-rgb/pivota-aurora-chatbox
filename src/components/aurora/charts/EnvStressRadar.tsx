import React, { useEffect, useMemo } from 'react';
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

import type { EnvStressUiModelV1, RadarDatumV1 } from '@/lib/auroraEnvStress';
import { normalizeRadarSeriesV1 } from '@/lib/auroraUiContracts';

type ChartRow = RadarDatumV1 & { axisLabel: string };

function EnvStressTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartRow | undefined;
  if (!row) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-card backdrop-blur">
      <div className="text-xs font-semibold text-foreground">{row.axisLabel}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        Value: <span className="font-semibold text-foreground">{Math.round(row.value)}</span>
      </div>
    </div>
  );
}

export function EnvStressRadar({ model }: { model: EnvStressUiModelV1 }) {
  const { radar, didWarn } = useMemo(() => normalizeRadarSeriesV1(model.radar), [model.radar]);

  useEffect(() => {
    if (didWarn) console.warn('[aurora.ui] radar values normalized (clamp/NaN policy applied)');
  }, [didWarn]);

  const data: ChartRow[] = useMemo(
    () => radar.map((r) => ({ ...r, axisLabel: r.axis })),
    [radar],
  );

  if (!data.length) return null;

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="78%" accessibilityLayer>
          <PolarGrid gridType="circle" stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <PolarAngleAxis
            dataKey="axisLabel"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} tickLine={false} axisLine={false} />
          <Radar
            name="Stress"
            dataKey="value"
            stroke="#f97316"
            fill="#f97316"
            fillOpacity={0.38}
            isAnimationActive
          />
          <Tooltip cursor={false} content={<EnvStressTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

