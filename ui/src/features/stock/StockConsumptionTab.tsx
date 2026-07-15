import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { ConsumptionPeriod } from '@/lib/api/stock';
import { useStockConsumption } from './hooks';
import { formatDate } from './format';
import StockConsumptionChart from './StockConsumptionChart';

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

  const hasCurve = data != null && data.points_count >= 2;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <FilterPill key={p} active={period === p} onClick={() => setPeriod(p)}>
            {t(`stock.consumption.periods.${p}`)}
          </FilterPill>
        ))}
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

          <StockConsumptionChart points={data.points} unit={unit} />
        </>
      ) : (
        <p className="text-sm italic text-muted-foreground">
          {t('stock.consumption.not_enough_data')}
        </p>
      )}
    </section>
  );
}
