import * as React from 'react';
import { Plus, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import EmptyState from '@/components/EmptyState';
import Pager from '@/components/Pager';
import { Button } from '@/design-system/button';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { usePager } from '@/lib/usePager';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import { interactionKeys } from '@/features/interactions/hooks';
import { useExpenseSummary } from '@/features/expenses/hooks';
import { useAccountFlow } from '@/features/banking/hooks';
import ExpenseSummaryCards from '@/features/expenses/ExpenseSummaryCards';
import ExpenseFilters from '@/features/expenses/ExpenseFilters';
import { resolvePeriod, type PeriodRange } from '@/features/expenses/period';
import ExpenseList from '@/features/expenses/ExpenseList';
import CashExpenseDialog from './CashExpenseDialog';

/**
 * Onglet « Dépenses » du module Argent (parcours 26, lot 2).
 * Anciennement `expenses/ExpensesPage`, `PageHeader` en moins.
 */
export default function ExpensesPanel() {
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
  // La même période, vue côté banque. Sert le taux de couverture — le seul pont
  // admis entre les deux mondes.
  const flowQuery = useAccountFlow(
    React.useMemo(
      () => ({
        ...(range.from ? { date_from: range.from } : {}),
        ...(range.to ? { date_to: range.to } : {}),
      }),
      [range.from, range.to],
    ),
  );

  // Même mécanique que le journal, et pour la même raison : c'est un registre,
  // il grandit sans fin. Le serveur plafonne d'ailleurs cette liste à 100 par
  // requête — une fenêtre qu'on agrandit s'y serait arrêtée sans le dire.
  const pager = usePager(50, `${kind}|${supplier}|${range.from}|${range.to}`);

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
      limit: pager.limit,
      offset: pager.offset,
    }),
    [kind, supplier, range.from, range.to, pager.limit, pager.offset],
  );

  const listQuery = useQuery({
    queryKey: interactionKeys.list(listFilters),
    queryFn: () => fetchInteractions(listFilters as Parameters<typeof fetchInteractions>[0]),
  });

  const items: InteractionListItem[] = listQuery.data?.items ?? [];

  // Une page qui s'est vidée sous les doigts (dépenses supprimées pendant la
  // lecture) ramène à la première : rester sur une page vide afficherait « aucune
  // dépense » à un foyer qui en a deux cents.
  React.useEffect(() => {
    if (!listQuery.isFetching && items.length === 0 && pager.offset > 0) pager.reset();
  }, [listQuery.isFetching, items.length, pager]);
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

  const [adhocOpen, setAdhocOpen] = React.useState(false);

  return (
    <>
      <div className="flex justify-end pb-4">
        <Button type="button" onClick={() => setAdhocOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t('expenses.adhoc.actions.add')}
        </Button>
      </div>

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
            <ExpenseSummaryCards summary={summary} flow={flowQuery.data} />
            {items.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={t('expenses.empty')}
                description={t('expenses.emptyDescription')}
                action={{ label: t('expenses.adhoc.actions.add'), onClick: () => setAdhocOpen(true) }}
              />
            ) : (
              <>
                <ExpenseList items={items} />
                <Pager
                  offset={pager.offset}
                  limit={pager.limit}
                  shown={items.length}
                  total={listQuery.data?.count ?? items.length}
                  onPrevious={pager.previous}
                  onNext={pager.next}
                  isFetching={listQuery.isFetching}
                />
              </>
            )}
          </>
        ) : null}
      </div>

      <CashExpenseDialog open={adhocOpen} onOpenChange={setAdhocOpen} />
    </>
  );
}
