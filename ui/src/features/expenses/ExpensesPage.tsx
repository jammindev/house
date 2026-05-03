import * as React from 'react';
import { Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import { interactionKeys } from '@/features/interactions/hooks';
import { useExpenseSummary } from './hooks';
import ExpenseSummaryCards from './ExpenseSummaryCards';
import ExpenseFilters from './ExpenseFilters';
import { resolvePeriod, type PeriodRange } from './period';
import ExpenseList from './ExpenseList';

export default function ExpensesPage() {
  const { t } = useTranslation();

  const [period, setPeriod] = useSessionState<PeriodRange>('expenses.period', { preset: 'currentMonth' });
  const [supplier, setSupplier] = useSessionState<string>('expenses.supplier', '');
  const [kind, setKind] = useSessionState<string>('expenses.kind', '');

  const range = React.useMemo(() => resolvePeriod(period), [period]);
  const filters = React.useMemo(
    () => ({
      from: range.from,
      to: range.to,
      ...(supplier ? { supplier } : {}),
      ...(kind ? { kind } : {}),
    }),
    [range.from, range.to, supplier, kind],
  );

  const summaryQuery = useExpenseSummary(filters);

  const listFilters = React.useMemo(
    () => ({
      type: 'expense' as const,
      ...(kind ? { kind } : {}),
      ...(supplier ? { supplier } : {}),
      // Period filter on list reuses occurred_at, but the summary endpoint uses
      // strict from/to — for the list we keep the same range for visual coherence.
      // The list endpoint filter param is `start_date`/`end_date` per views.py:71.
      ...(range.from ? { start_date: range.from } : {}),
      ...(range.to ? { end_date: range.to } : {}),
      limit: 50,
    }),
    [kind, supplier, range.from, range.to],
  );

  const listQuery = useQuery({
    queryKey: interactionKeys.list(listFilters),
    queryFn: () => fetchInteractions(listFilters as Parameters<typeof fetchInteractions>[0]),
  });

  const items: InteractionListItem[] = listQuery.data?.items ?? [];
  const isLoading = summaryQuery.isLoading || listQuery.isLoading;
  const showSkeleton = useDelayedLoading(isLoading);
  const summary = summaryQuery.data;

  const supplierOptions = React.useMemo(() => {
    if (!summary) return [];
    return summary.by_supplier.filter((row) => row.supplier).map((row) => row.supplier).slice(0, 8);
  }, [summary]);

  const kindOptions = React.useMemo(() => {
    if (!summary) return [];
    return summary.by_kind.filter((row) => row.kind).map((row) => row.kind);
  }, [summary]);

  return (
    <>
      <PageHeader title={t('expenses.title')} description={t('expenses.description')} />

      <div className="space-y-5">
        <ExpenseFilters
          period={period}
          onPeriodChange={setPeriod}
          supplier={supplier}
          onSupplierChange={setSupplier}
          kind={kind}
          onKindChange={setKind}
          supplierOptions={supplierOptions}
          kindOptions={kindOptions}
        />

        {showSkeleton ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        ) : null}

        {!isLoading && summary ? (
          <>
            <ExpenseSummaryCards summary={summary} />
            {items.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={t('expenses.empty')}
                description={t('expenses.emptyDescription')}
              />
            ) : (
              <ExpenseList items={items} />
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
