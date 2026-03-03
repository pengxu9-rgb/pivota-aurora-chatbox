import React from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';

type ComponentData = {
  name: string;
  score: number;
  drivers: string[];
};

type BreakdownData = {
  total: number;
  tier: string;
  tierDescription: string;
  components: ComponentData[];
};

function tierColor(score: number) {
  if (score >= 70) return '#E24A3B';
  if (score >= 40) return '#F0AD4E';
  return '#5CB85C';
}

function BreakdownTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ComponentData | undefined;
  if (!p) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-card backdrop-blur" style={{ maxWidth: 280 }}>
      <div className="text-xs font-semibold text-foreground">{p.name}: {p.score}/100</div>
      {p.drivers?.length ? (
        <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
          {p.drivers.map((d, i) => <div key={i}>• {d}</div>)}
        </div>
      ) : null}
    </div>
  );
}

export function EnvStressBreakdown({ data }: { data: BreakdownData }) {
  const chartData = data.components.map((c) => ({
    name: c.name,
    score: c.score,
    drivers: c.drivers,
  }));

  const barHeight = Math.max(160, data.components.length * 52);

  return (
    <div className="w-full rounded-xl border border-border/70 bg-muted/20 p-3">
      <div className="h-[var(--bar-height)]" style={{ '--bar-height': `${barHeight}px` } as React.CSSProperties}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number" domain={[0, 100]} tickCount={6} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={64} tick={{ fontSize: 11 }} />
            <Tooltip cursor={false} content={<BreakdownTooltip />} />
            <Bar dataKey="score" radius={[6, 6, 6, 6]} barSize={20}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={tierColor(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 space-y-2.5">
        {data.components.map((c) => (
          <div key={c.name}>
            <div className="text-[11px] font-semibold text-foreground/90">{c.name}</div>
            {c.drivers.length ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {c.drivers.slice(0, 3).map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] text-foreground/85"
                  >
                    {d}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
