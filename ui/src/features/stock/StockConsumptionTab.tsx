import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import WeatherOverlayToggle from '@/features/weather/WeatherOverlayToggle';
import { useTemperatureOverlay } from '@/features/weather/overlay';
import ConsumptionBarChart from '@/components/charts/ConsumptionBarChart';
import type { ConsumptionPeriod } from '@/lib/api/stock';
import { useStockConsumption } from './hooks';
import { formatDate } from './format';

const PERIODS: ConsumptionPeriod[] = ['30d', '90d', '1y', 'all'];

interface StockConsumptionTabProps {
  itemId: string;
  unit: string;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-foreground">{value}</dd>
    </div>
  );
}

export default function StockConsumptionTab({ itemId, unit }: StockConsumptionTabProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = React.useState<ConsumptionPeriod>('90d');
  const { data, isLoading } = useStockConsumption(itemId, period);
  const showSkeleton = useDelayedLoading(isLoading && !data);

  // Le serveur ne renvoie des barres qu'à partir de deux relevés : une seule
  // lecture de niveau ne dit rien d'une consommation.
  const buckets = React.useMemo(() => data?.buckets ?? [], [data]);
  const granularity = data?.granularity ?? 'day';
  const hasCurve = data != null && buckets.length > 0;

  // Temperature overlay (parcours 18 lot 5) — reuses the electricity/water hook.
  const [showWeather, setShowWeather] = useSessionState<boolean>(`stock.consumption.showWeather`, false);
  const range = React.useMemo(() => {
    if (buckets.length === 0) return { from: '', to: '' };
    return { from: buckets[0].ts.slice(0, 10), to: buckets[buckets.length - 1].ts.slice(0, 10) };
  }, [buckets]);
  const { available: weatherAvailable, overlay: weatherOverlay } = useTemperatureOverlay({
    from: range.from,
    to: range.to,
    granularity,
    buckets,
    show: showWeather,
  });

  const series = React.useMemo(
    () => [{ key: 'consumed', label: t('stock.consumption.consumed'), color: 'hsl(var(--chart-1))' }],
    [t],
  );
  const chartBuckets = React.useMemo(
    () => buckets.map((b) => ({ ts: b.ts, values: { consumed: b.consumed } })),
    [buckets],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <FilterPill key={p} active={period === p} onClick={() => setPeriod(p)}>
            {t(`stock.consumption.periods.${p}`)}
          </FilterPill>
        ))}
        {hasCurve && weatherAvailable ? (
          <WeatherOverlayToggle active={showWeather} onToggle={setShowWeather} />
        ) : null}
      </div>

      {showSkeleton ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted sm:h-80" />
      ) : hasCurve ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={t('stock.consumption.rate')}
              value={
                data.rate_per_day != null
                  ? t('stock.consumption.rate_value', { rate: data.rate_per_day, unit })
                  : '—'
              }
            />
            <Metric
              label={t('stock.consumption.depletion')}
              value={
                data.projected_depletion_date
                  ? formatDate(data.projected_depletion_date)
                  : '—'
              }
            />
            <Metric
              label={t('stock.consumption.last_level')}
              value={`${data.last_level} ${unit}`}
            />
          </dl>

          <ConsumptionBarChart
            buckets={chartBuckets}
            series={series}
            granularity={granularity}
            unit={unit}
            overlay={weatherOverlay}
          />
        </>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          {t('stock.consumption.not_enough_data')}
        </p>
      )}
    </section>
  );
}
