import * as React from 'react';
import { useTranslation } from 'react-i18next';
import ConsumptionBarChart from '@/components/charts/ConsumptionBarChart';
import type { ConsumptionSummary, EnergyRegister, Granularity } from '@/lib/api/electricity';

const REGISTER_COLORS: Record<EnergyRegister, string> = {
  base: 'hsl(var(--chart-2))',
  hp: 'hsl(var(--chart-1))',
  hc: 'hsl(var(--chart-4))',
};

interface ConsumptionChartProps {
  summary: ConsumptionSummary;
  granularity: Granularity;
}

// Electricity wrapper of the shared ConsumptionBarChart: one stacked series per
// register present in the data, Wh converted to kWh.
export default function ConsumptionChart({ summary, granularity }: ConsumptionChartProps) {
  const { t } = useTranslation();

  const registers = React.useMemo(() => {
    const seen = new Set<EnergyRegister>();
    for (const bucket of summary.buckets) {
      for (const key of Object.keys(bucket.registers)) seen.add(key as EnergyRegister);
    }
    return (['base', 'hp', 'hc'] as EnergyRegister[]).filter((r) => seen.has(r));
  }, [summary.buckets]);

  const series = React.useMemo(
    () =>
      registers.map((register) => ({
        key: register,
        label: t(`electricity.consumption.register.${register}`),
        color: REGISTER_COLORS[register],
      })),
    [registers, t],
  );

  const buckets = React.useMemo(
    () =>
      summary.buckets.map((bucket) => ({
        ts: bucket.ts,
        values: Object.fromEntries(
          registers.map((r) => [r, Math.round((bucket.registers[r] ?? 0) / 10) / 100]),
        ),
      })),
    [summary.buckets, registers],
  );

  return <ConsumptionBarChart buckets={buckets} series={series} granularity={granularity} unit="kWh" />;
}
