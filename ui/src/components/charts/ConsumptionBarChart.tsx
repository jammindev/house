import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
}

export default function ConsumptionBarChart({
  buckets,
  series,
  granularity,
  unit,
}: ConsumptionBarChartProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  const data = React.useMemo(
    () => buckets.map((bucket) => ({ ts: bucket.ts, ...bucket.values })),
    [buckets],
  );

  const seriesLabel = React.useCallback(
    (key: string) => series.find((s) => s.key === key)?.label ?? key,
    [series],
  );

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={44}
            unit={` ${unit}`}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(ts) => formatLabel(String(ts), granularity, locale)}
            formatter={(value, name) => [`${String(value)} ${unit}`, seriesLabel(String(name))]}
          />
          {series.length > 1 && (
            <Legend formatter={(value: string) => seriesLabel(value)} wrapperStyle={{ fontSize: 12 }} />
          )}
          {series.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="consumption"
              fill={s.color}
              radius={index === series.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
