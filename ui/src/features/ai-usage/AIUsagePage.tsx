import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import KpiCards from './KpiCards';
import RecentCallsTable from './RecentCallsTable';
import UsageHistogram from './UsageHistogram';
import {
  useAIUsageHistogram,
  useAIUsageRecent,
  useAIUsageSummary,
  useIsHouseholdOwner,
} from './hooks';

export default function AIUsagePage() {
  const { t } = useTranslation();
  const isOwner = useIsHouseholdOwner();

  const [featureFilter, setFeatureFilter] = useSessionState<string | null>(
    'aiUsage.feature',
    null,
  );

  const summaryQuery = useAIUsageSummary();
  const histogramQuery = useAIUsageHistogram(30);
  const recentQuery = useAIUsageRecent(featureFilter);

  const showSkeleton = useDelayedLoading(
    isOwner === undefined || summaryQuery.isLoading || histogramQuery.isLoading,
  );

  if (isOwner === false) {
    return (
      <div>
        <PageHeader title={t('aiUsage.title')} description={t('aiUsage.description')} />
        <Card className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
          <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
          {t('aiUsage.ownersOnly')}
        </Card>
      </div>
    );
  }

  if (showSkeleton) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('aiUsage.title')} description={t('aiUsage.description')} />
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const features = histogramQuery.data?.features ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title={t('aiUsage.title')} description={t('aiUsage.description')} />

      {summaryQuery.data ? <KpiCards summary={summaryQuery.data} /> : null}
      {histogramQuery.data ? <UsageHistogram histogram={histogramQuery.data} /> : null}

      <div>
        <div className="flex flex-wrap items-center gap-1.5 pb-3">
          <p className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('aiUsage.recent.title')}
          </p>
          <FilterPill active={featureFilter === null} onClick={() => setFeatureFilter(null)}>
            {t('aiUsage.recent.allFeatures')}
          </FilterPill>
          {features.map((feature) => (
            <FilterPill
              key={feature}
              active={featureFilter === feature}
              onClick={() => setFeatureFilter(feature)}
            >
              {feature}
            </FilterPill>
          ))}
        </div>
        <RecentCallsTable calls={recentQuery.data ?? []} />
      </div>
    </div>
  );
}
