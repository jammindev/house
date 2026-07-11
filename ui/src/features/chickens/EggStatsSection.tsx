import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import Sparkline from '@/components/Sparkline';
import { useEggStats } from './hooks';

/**
 * Laying trends (US-4): today, 7/30-day averages, month total + 30-day sparkline.
 * Days without a log are missing (null), not zero — they are skipped in the line.
 */
export default function EggStatsSection() {
  const { t } = useTranslation();
  const { data: stats } = useEggStats();

  if (!stats) return null;
  const hasAny = stats.total > 0;

  const points = stats.series
    .filter((point) => point.count != null)
    .map((point) => ({ t: `${point.date}T12:00:00`, v: point.count as number }));

  return (
    <Card className="p-4">
      <CardTitle className="text-sm text-muted-foreground">
        {`🥚 ${t('chickens.eggs.stats_title')}`}
      </CardTitle>
      {!hasAny ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('chickens.eggs.stats_empty')}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('chickens.eggs.stat_today')} value={stats.today ?? '—'} />
            <Stat label={t('chickens.eggs.stat_avg7')} value={stats.avg_7d ?? '—'} />
            <Stat label={t('chickens.eggs.stat_avg30')} value={stats.avg_30d ?? '—'} />
            <Stat label={t('chickens.eggs.stat_month')} value={stats.month_total} />
          </div>
          {points.length >= 2 ? (
            <div className="mt-3 text-primary">
              <Sparkline points={points} width={280} height={40} className="w-full" />
            </div>
          ) : null}
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
