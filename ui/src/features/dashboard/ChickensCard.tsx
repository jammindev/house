import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardTitle } from '@/design-system/card';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { formatQty } from '@/features/stock/format';
import { useFlockSummary } from '@/features/chickens/hooks';

export default function ChickensCard() {
  const { t } = useTranslation();
  const location = useLocation();
  const { data: summary, isLoading } = useFlockSummary();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) return <Card className="h-36 animate-pulse bg-muted p-4" />;
  if (!summary || !summary.has_data) return null;

  return (
    <Link to="/app/chickens" state={pushBack(location)} className="group block h-full">
      <Card className="flex h-full flex-col p-4 transition-colors hover:border-border hover:bg-muted/20">
        <CardTitle className="text-sm text-muted-foreground">
          🐔 {t('dashboard.metrics.chickens.title')}
        </CardTitle>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {t('dashboard.metrics.chickens.eggs_today', { count: summary.eggs_today ?? 0 })}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('dashboard.metrics.chickens.eggs_7d', { count: summary.eggs_7d })}
          {' · '}
          {t('dashboard.metrics.chickens.flock', { count: summary.active_count })}
        </p>
        {summary.feed ? (
          <p className="mt-auto pt-3 text-xs text-muted-foreground">
            {t('dashboard.metrics.chickens.feed_stock', {
              quantity: formatQty(summary.feed.quantity, summary.feed.unit),
            })}
            {['low_stock', 'out_of_stock'].includes(summary.feed.status) ? (
              <span className="font-medium text-destructive">
                {' · '}
                {t(`stock.status.${summary.feed.status}`)}
              </span>
            ) : null}
          </p>
        ) : null}
      </Card>
    </Link>
  );
}
