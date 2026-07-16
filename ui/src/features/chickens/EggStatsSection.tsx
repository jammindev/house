import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import { useSessionState } from '@/lib/useSessionState';
import { EGG_STATS_PERIODS, type EggStatsPeriod } from '@/lib/api/chickens';
import EggChart from './EggChart';
import { useEggStats } from './hooks';

/**
 * Laying trends + curve (Lot 6.1). A day without a log is unknown, never zero:
 * averages divide by logged days only, the coverage line shows how many days
 * were recorded, and the chart breaks the line at gaps.
 */
export default function EggStatsSection() {
  const { t } = useTranslation();
  const [period, setPeriod] = useSessionState<EggStatsPeriod>('chickens.eggStats.period', 30);
  const { data: stats } = useEggStats(period);

  if (!stats) return null;
  const hasAny = stats.total > 0;
  const { coverage } = stats;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-sm text-muted-foreground">
          {`🥚 ${t('chickens.eggs.stats_title')}`}
        </CardTitle>
        <div className="flex gap-1">
          {EGG_STATS_PERIODS.map((p) => (
            <FilterPill key={p} active={period === p} onClick={() => setPeriod(p)}>
              {t(`chickens.eggs.period.${p}`)}
            </FilterPill>
          ))}
        </div>
      </div>

      {!hasAny ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('chickens.eggs.stats_empty')}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('chickens.eggs.stat_today')} value={stats.today ?? '—'} />
            <Stat label={t('chickens.eggs.stat_period_total')} value={stats.period_total} />
            <Stat label={t('chickens.eggs.stat_period_avg')} value={stats.period_avg ?? '—'} />
            <Stat
              label={t('chickens.eggs.stat_best')}
              value={stats.best_day ? stats.best_day.count : '—'}
            />
          </div>

          <div className="mt-3">
            <EggChart series={stats.series} className="h-24 w-full" />
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {t('chickens.eggs.coverage', {
              logged: coverage.logged_days,
              total: coverage.total_days,
            })}
          </p>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
