import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import WeatherOverlayToggle from '@/features/weather/WeatherOverlayToggle';
import { useTemperatureOverlay } from '@/features/weather/overlay';
import type { ConsumptionPeriod } from '@/lib/api/stock';
import { useStockConsumption } from './hooks';
import { formatDate } from './format';
import { canOverlayWeather } from './levelCurve';
import StockLevelChart from './StockLevelChart';
import StockReadingsList from './StockReadingsList';

const PERIODS: ConsumptionPeriod[] = ['30d', '90d', '1y', 'all'];

// Jusqu'où la projection a le droit de dépasser le dernier relevé. Une fenêtre
// de 30 jours suivie de dix ans de pointillé n'affiche plus l'historique qu'on
// était venu lire ; l'horizon suit donc ce qu'on regarde.
const HORIZON_DAYS: Record<ConsumptionPeriod, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: 365,
};

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

  // Le serveur ne renvoie une courbe qu'à partir de deux relevés : une seule
  // lecture de niveau ne dit rien d'une consommation.
  const levels = React.useMemo(() => data?.levels ?? [], [data]);
  const hasCurve = data != null && levels.length > 0;

  // Temperature overlay (parcours 18 lot 5) — reuses the electricity/water hook.
  const [showWeather, setShowWeather] = useSessionState<boolean>(`stock.consumption.showWeather`, false);
  const range = React.useMemo(() => {
    if (levels.length === 0) return { from: '', to: '' };
    return { from: levels[0].ts.slice(0, 10), to: levels[levels.length - 1].ts.slice(0, 10) };
  }, [levels]);
  const { available: weatherAvailable, overlay: weatherOverlay } = useTemperatureOverlay({
    from: range.from,
    to: range.to,
    granularity: 'day',
    buckets: levels,
    show: showWeather,
  });

  // La météo ne se superpose qu'à une courbe qui a de quoi lui répondre : entre
  // deux relevés la pente est constante par construction, donc une température
  // qui varie chaque jour n'y trouverait rien à corréler.
  const weatherFits = weatherAvailable && canOverlayWeather(data?.points.length ?? 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <FilterPill key={p} active={period === p} onClick={() => setPeriod(p)}>
            {t(`stock.consumption.periods.${p}`)}
          </FilterPill>
        ))}
        {hasCurve && weatherFits ? (
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

          <StockLevelChart
            levels={levels}
            readings={data.points}
            depletionDate={data.projected_depletion_date}
            horizonDays={HORIZON_DAYS[period]}
            unit={unit}
            overlay={weatherFits ? weatherOverlay : undefined}
          />
        </>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          {t('stock.consumption.not_enough_data')}
        </p>
      )}

      {/* Hors du bloc conditionnel : c'est justement quand il n'y a qu'un seul
          relevé — donc pas de courbe — qu'on a besoin de le corriger. */}
      <StockReadingsList itemId={itemId} unit={unit} />
    </section>
  );
}
