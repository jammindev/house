import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardTitle } from '@/design-system/card';
import Sparkline from '@/components/Sparkline';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useConsumptionSummary, useMeters } from '@/features/electricity/hooks';
import { isoDate } from './hooks';

const WINDOW_DAYS = 30;

function windowRange(): { date_from: string; date_to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - WINDOW_DAYS);
  return { date_from: isoDate(from), date_to: isoDate(to) };
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ElectricityCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: meters = [], isLoading: metersLoading } = useMeters();
  const meterId = meters[0]?.id ?? '';
  const { data: summary, isLoading: summaryLoading } = useConsumptionSummary({
    meter: meterId,
    granularity: 'day',
    ...windowRange(),
  });
  const showSkeleton = useDelayedLoading(metersLoading || (Boolean(meterId) && summaryLoading));

  if (showSkeleton) return <Card className="h-36 animate-pulse bg-muted p-4" />;
  if (!meterId || !summary || summary.total_wh === 0) return null;

  const totalKwh = summary.total_wh / 1000;
  const points = summary.buckets.map((bucket) => ({ t: bucket.ts, v: bucket.total_wh }));

  return (
    <Link to="/app/electricity" state={pushBack(location)} className="group block h-full">
      <Card className="flex h-full flex-col p-4 transition-colors hover:border-border hover:bg-muted/20">
        <CardTitle className="text-sm text-muted-foreground">
          ⚡ {t('dashboard.metrics.electricity.title')}
        </CardTitle>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {t('dashboard.metrics.electricity.total', { kwh: Math.round(totalKwh) })}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {summary.total_cost_eur !== null
            ? t('dashboard.metrics.electricity.cost', { amount: formatEur(summary.total_cost_eur) })
            : t('dashboard.metrics.last30Days')}
        </p>
        <div className="mt-auto pt-3 text-primary">
          <Sparkline points={points} width={220} height={40} className="w-full" />
        </div>
      </Card>
    </Link>
  );
}
