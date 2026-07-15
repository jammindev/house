import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ConsumptionChartOverlay } from '@/components/charts/ConsumptionBarChart';
import type { StockConsumptionPoint } from '@/lib/api/stock';

interface StockConsumptionChartProps {
  points: StockConsumptionPoint[];
  unit: string;
  /** Optional secondary series on a right-hand axis (temperature — parcours 18 lot 5). */
  overlay?: ConsumptionChartOverlay;
}

// Stock level over time: a descending line (consumption) with instantaneous
// upward jumps (restocks). Purpose-built line chart (not the bucketed bar chart
// shared by electricity/water) but overlay-compatible for the temperature layer.
export default function StockConsumptionChart({ points, unit, overlay }: StockConsumptionChartProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  const data = React.useMemo(() => {
    const overlayByDate = new Map((overlay?.points ?? []).map((p) => [p.ts.slice(0, 10), p.value]));
    return points.map((p) => ({
      date: p.date,
      quantity: p.quantity,
      ...(overlay ? { [overlay.key]: overlayByDate.get(p.date.slice(0, 10)) ?? null } : {}),
    }));
  }, [points, overlay]);

  const formatTick = React.useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    [locale],
  );
  const formatLabel = React.useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  );

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatTick}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            yAxisId="main"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={44}
            unit={` ${unit}`}
            allowDecimals={false}
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
            cursor={{ stroke: 'hsl(var(--border))' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(iso) => formatLabel(String(iso))}
            formatter={(value, name) => {
              const u = overlay && name === overlay.key ? overlay.unit : unit;
              const label = overlay && name === overlay.key ? overlay.label : String(name);
              return [`${String(value)} ${u}`, label];
            }}
          />
          {overlay && <Legend wrapperStyle={{ fontSize: 12 }} />}
          <Area
            yAxisId="main"
            type="linear"
            dataKey="quantity"
            stroke="hsl(var(--chart-1))"
            fill="hsl(var(--chart-1))"
            fillOpacity={0.12}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
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
