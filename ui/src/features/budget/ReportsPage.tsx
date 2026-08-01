import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import { Card, CardTitle } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { formatMonthKey } from '@/lib/format';
import type { BudgetReport } from '@/lib/api/budget';
import { useBudgetReports, useLatestBudgetReport } from './hooks';

function ReportCard({ report, featured }: { report: BudgetReport; featured?: boolean }) {
  return (
    <Card className="p-4">
      <CardTitle className="capitalize">{formatMonthKey(report.month)}</CardTitle>
      <p className={`mt-2 whitespace-pre-line text-sm ${featured ? 'text-foreground' : 'text-muted-foreground'}`}>
        {report.text}
      </p>
    </Card>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const latestQuery = useLatestBudgetReport();
  const historyQuery = useBudgetReports();

  const showSkeleton = useDelayedLoading(latestQuery.isLoading || historyQuery.isLoading);
  const latest = latestQuery.data ?? null;
  const history = (historyQuery.data ?? []).filter((r) => r.month !== latest?.month);

  return (
    <>
      <BackLink fallback="/app/money?tab=budgets" fallbackLabel={t('budget.title')} />
      <PageHeader title={t('report.title')} description={t('report.description')} />

      {showSkeleton ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : null}

      {!latestQuery.isLoading && !historyQuery.isLoading ? (
        !latest && history.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t('report.empty')}
            description={t('report.emptyDescription')}
          />
        ) : (
          <div className="space-y-5">
            {latest ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">{t('report.latest')}</h2>
                <ReportCard report={latest} featured />
              </div>
            ) : null}

            {history.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">{t('report.history')}</h2>
                <div className="space-y-2">
                  {history.map((r) => (
                    <ReportCard key={r.id} report={r} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </>
  );
}
