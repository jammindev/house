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
import type { ConsumptionSummary, EnergyRegister, Granularity } from '@/lib/api/electricity';

const REGISTER_COLORS: Record<EnergyRegister, string> = {
  base: 'hsl(var(--chart-2))',
  hp: 'hsl(var(--chart-1))',
  hc: 'hsl(var(--chart-4))',
};

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

interface ConsumptionChartProps {
  summary: ConsumptionSummary;
  granularity: Granularity;
}

export default function ConsumptionChart({ summary, granularity }: ConsumptionChartProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const registers = React.useMemo(() => {
    const seen = new Set<EnergyRegister>();
    for (const bucket of summary.buckets) {
      for (const key of Object.keys(bucket.registers)) seen.add(key as EnergyRegister);
    }
    return (['base', 'hp', 'hc'] as EnergyRegister[]).filter((r) => seen.has(r));
  }, [summary.buckets]);

  const data = React.useMemo(
    () =>
      summary.buckets.map((bucket) => ({
        ts: bucket.ts,
        estimated: bucket.estimated_wh,
        ...Object.fromEntries(
          registers.map((r) => [r, Math.round((bucket.registers[r] ?? 0) / 10) / 100]),
        ),
      })),
    [summary.buckets, registers],
  );

  const registerLabel = React.useCallback(
    (register: string) => t(`electricity.consumption.register.${register}`),
    [t],
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
            unit=" kWh"
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
            formatter={(value, name) => [`${String(value)} kWh`, registerLabel(String(name))]}
          />
          {registers.length > 1 && (
            <Legend formatter={(value: string) => registerLabel(value)} wrapperStyle={{ fontSize: 12 }} />
          )}
          {registers.map((register) => (
            <Bar
              key={register}
              dataKey={register}
              stackId="energy"
              fill={REGISTER_COLORS[register]}
              radius={registers.indexOf(register) === registers.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
