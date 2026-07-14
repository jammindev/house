import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Granularity } from '@/lib/period';

// Generic stacked bar chart for time-bucketed consumption (electricity, water…).
// Values arrive already converted to their display unit; each series is one
// stacked bar segment. Single-series charts hide the legend.

export interface ConsumptionChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ConsumptionChartBucket {
  ts: string;
  values: Record<string, number>;
}

// Optional secondary series drawn as a line on a right-hand axis (e.g. the
// temperature overlay, parcours 17 Lot 6). Points are matched to buckets by ts.
export interface ConsumptionChartOverlay {
  key: string;
  label: string;
  color: string;
  unit: string;
  points: { ts: string; value: number }[];
}

function formatTick(ts: string, granularity: Granularity, locale: string): string {
  const date = new Date(ts);
  switch (granularity) {
    case 'hour':
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    case 'day':
      return date.toLocaleDateString(locale, { day: 'numeric' });
    case 'month':
      return date.toLocaleDateString(locale, { month: 'short' });
    case 'year':
      return date.toLocaleDateString(locale, { year: 'numeric' });
  }
}

function formatLabel(ts: string, granularity: Granularity, locale: string): string {
  const date = new Date(ts);
  switch (granularity) {
    case 'hour':
      return date.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    case 'day':
      return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    case 'month':
      return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    case 'year':
      return date.toLocaleDateString(locale, { year: 'numeric' });
  }
}

interface ConsumptionBarChartProps {
  buckets: ConsumptionChartBucket[];
  series: ConsumptionChartSeries[];
  granularity: Granularity;
  unit: string;
  /** Optional line on a right-hand axis (e.g. temperature). */
  overlay?: ConsumptionChartOverlay;
}

export default function ConsumptionBarChart({
  buckets,
  series,
  granularity,
  unit,
  overlay,
}: ConsumptionBarChartProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  const data = React.useMemo(() => {
    const overlayByTs = new Map((overlay?.points ?? []).map((p) => [p.ts, p.value]));
    return buckets.map((bucket) => ({
      ts: bucket.ts,
      ...bucket.values,
      ...(overlay ? { [overlay.key]: overlayByTs.get(bucket.ts) ?? null } : {}),
    }));
  }, [buckets, overlay]);

  const seriesLabel = React.useCallback(
    (key: string) => {
      if (overlay && key === overlay.key) return overlay.label;
      return series.find((s) => s.key === key)?.label ?? key;
    },
    [series, overlay],
  );

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={(ts: string) => formatTick(ts, granularity, locale)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            yAxisId="main"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={44}
            unit={` ${unit}`}
          />
          {overlay && (
            <YAxis
              yAxisId="overlay"
              orientation="right"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={40}
              unit={` ${overlay.unit}`}
            />
          )}
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(ts) => formatLabel(String(ts), granularity, locale)}
            formatter={(value, name) => {
              const u = overlay && name === overlay.key ? overlay.unit : unit;
              return [`${String(value)} ${u}`, seriesLabel(String(name))];
            }}
          />
          {(series.length > 1 || overlay) && (
            <Legend formatter={(value: string) => seriesLabel(value)} wrapperStyle={{ fontSize: 12 }} />
          )}
          {series.map((s, index) => (
            <Bar
              key={s.key}
              yAxisId="main"
              dataKey={s.key}
              stackId="consumption"
              fill={s.color}
              radius={index === series.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
          {overlay && (
            <Line
              yAxisId="overlay"
              type="monotone"
              dataKey={overlay.key}
              stroke={overlay.color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
