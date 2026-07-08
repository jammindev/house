import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardTitle } from '@/design-system/card';
import Sparkline from '@/components/Sparkline';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useWaterConsumptionSummary, useWaterReadings } from '@/features/water/hooks';
import { isoDate } from './hooks';

const WINDOW_DAYS = 30;

export default function WaterCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - WINDOW_DAYS);

  const { data: readings = [], isLoading: readingsLoading } = useWaterReadings();
  const hasHistory = readings.length >= 2;
  const { data: summary, isLoading: summaryLoading } = useWaterConsumptionSummary({
    granularity: 'day',
    date_from: isoDate(from),
    date_to: isoDate(to),
    enabled: hasHistory,
  });
  const showSkeleton = useDelayedLoading(readingsLoading || (hasHistory && summaryLoading));

  if (showSkeleton) return <Card className="h-36 animate-pulse bg-muted p-4" />;
  if (!hasHistory || !summary || summary.total_l === 0) return null;

  const avgPerDay = Math.round(summary.total_l / WINDOW_DAYS);
  const points = summary.buckets.map((bucket) => ({ t: bucket.ts, v: bucket.total_l }));

  return (
    <Link to="/app/water" state={pushBack(location)} className="group block h-full">
      <Card className="flex h-full flex-col p-4 transition-colors hover:border-border hover:bg-muted/20">
        <CardTitle className="text-sm text-muted-foreground">
          💧 {t('dashboard.metrics.water.title')}
        </CardTitle>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {t('dashboard.metrics.water.avg', { liters: avgPerDay })}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('dashboard.metrics.water.total', {
            m3: (summary.total_l / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }),
          })}
        </p>
        <div className="mt-auto pt-3 text-primary">
          <Sparkline points={points} width={220} height={40} className="w-full" />
        </div>
      </Card>
    </Link>
  );
}
