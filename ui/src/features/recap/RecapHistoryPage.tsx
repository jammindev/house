import { Link, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Card, CardTitle } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { pushBack } from '@/lib/backNavigation';
import { useLatestRecap, useRecapHistory } from './hooks';
import { monthLabel } from './month';

export default function RecapHistoryPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const latestQuery = useLatestRecap();
  const historyQuery = useRecapHistory();

  const isLoading = latestQuery.isLoading || historyQuery.isLoading;
  const showSkeleton = useDelayedLoading(isLoading);

  const latest = latestQuery.data ?? null;
  // The freshest month gets the staging; the rest is a sober list — nobody replays
  // the story of March.
  const past = (historyQuery.data ?? []).filter(
    (recap) => recap.month !== latest?.month && recap.card_count > 0,
  );

  return (
    <>
      <PageHeader title={t('recap.title')} description={t('recap.description')} />

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : null}

      {isLoading ? null : !latest && past.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t('recap.empty')}
          description={t('recap.emptyDescription')}
        />
      ) : (
        <div className="space-y-5">
          {latest ? (
            <Link
              to={`/app/recap/${latest.month}`}
              state={pushBack(location)}
              className="group block text-foreground hover:text-primary"
            >
              <Card className="p-4">
                <CardTitle className="text-inherit capitalize [&>span:last-child]:group-hover:underline">
                  ✨ {monthLabel(latest.month)}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('recap.cardCount', { count: latest.card_count })}
                </p>
                <p className="mt-2 text-sm font-medium text-primary">{t('recap.open')}</p>
              </Card>
            </Link>
          ) : null}

          {past.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">{t('recap.history')}</h2>
              <div className="space-y-2">
                {past.map((recap) => (
                  <Link
                    key={recap.id}
                    to={`/app/recap/${recap.month}`}
                    state={pushBack(location)}
                    className="group block text-foreground hover:text-primary"
                  >
                    <Card className="flex items-center justify-between gap-3 p-3">
                      <CardTitle className="text-inherit capitalize [&>span:last-child]:group-hover:underline">
                        {monthLabel(recap.month)}
                      </CardTitle>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t('recap.cardCount', { count: recap.card_count })}
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
