import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { buttonVariants } from '@/design-system/button';
import { cn } from '@/lib/utils';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useTrackers } from '@/features/trackers/hooks';

const MAX_ITEMS = 4;
const CRITICAL_DAYS = 7;

export default function RunwaysCard() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { data: trackers = [], isLoading } = useTrackers();
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) return <Card className="h-36 animate-pulse bg-muted p-4" />;

  const runways = trackers
    .filter((tracker) => tracker.kind === 'consumption' && tracker.is_active && tracker.runway_days !== null)
    .sort((a, b) => parseFloat(a.runway_days as string) - parseFloat(b.runway_days as string))
    .slice(0, MAX_ITEMS);

  if (runways.length === 0) return null;

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-sm text-muted-foreground">
          ⏳ {t('dashboard.metrics.runways.title')}
        </CardTitle>
        <Link
          to="/app/trackers"
          state={pushBack(location)}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <div className="mt-2 space-y-1.5">
        {runways.map((tracker) => {
          const days = Math.round(parseFloat(tracker.runway_days as string));
          const critical = days <= CRITICAL_DAYS;
          return (
            <Link
              key={tracker.id}
              to={`/app/trackers/${tracker.id}`}
              state={pushBack(location)}
              className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 truncate text-sm text-foreground">
                {tracker.emoji ? `${tracker.emoji} ` : ''}
                {tracker.name}
              </span>
              <span
                className={cn(
                  'shrink-0 text-sm font-semibold tabular-nums',
                  critical ? 'text-destructive' : 'text-foreground',
                )}
                title={
                  tracker.runway_until
                    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                        new Date(`${tracker.runway_until}T00:00:00`),
                      )
                    : undefined
                }
              >
                {t('dashboard.metrics.runways.days', { count: days })}
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
