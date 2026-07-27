import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import { Card } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import { formatAmount } from '@/lib/format';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import { interactionKeys } from '@/features/interactions/hooks';
import { useExpenseSummary } from '@/features/expenses/hooks';
import { useBudgetOverview } from '@/features/budget/hooks';
import { resolvePeriod, type PeriodPreset, type PeriodRange } from '@/features/expenses/period';
import ExpenseList from '@/features/expenses/ExpenseList';

/** Le seau « hors budget » s'ouvre comme une enveloppe — même page, même geste. */
export const UNBUDGETED = 'none';

/** Les mêmes périodes que l'onglet Dépenses, sans le « custom » : on ouvre un
 *  compteur affiché, pas une recherche libre. */
const PRESETS: PeriodPreset[] = ['currentMonth', 'previousMonth', 'last30Days', 'currentYear'];

/**
 * De quoi ce budget est-il fait (`/app/money/budgets/:id`).
 *
 * Le panneau Budgets affiche « 340 € / 400 € » et s'arrête là. La question
 * suivante est toujours la même — *lesquelles* ? — et jusqu'ici il fallait
 * partir dans l'onglet Dépenses et refaire le filtre à la main, sans garantie de
 * retomber sur le même chiffre.
 *
 * Cette page part du compteur : la période par défaut est **le mois en cours**,
 * celle du panneau, pour que le total affiché ici soit exactement celui sur
 * lequel on a cliqué. Changer de période est ensuite un choix explicite.
 */
export default function BudgetDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const isUnbudgeted = id === UNBUDGETED;

  const [period, setPeriod] = useSessionState<PeriodRange>('budget.detail.period', {
    preset: 'currentMonth',
  });
  const range = React.useMemo(() => resolvePeriod(period), [period]);

  // Le nom et le plafond viennent de l'aperçu, déjà en cache quand on arrive du
  // panneau : ouvrir un budget ne doit pas coûter un aller-retour de plus.
  const overviewQuery = useBudgetOverview();
  const row = React.useMemo(() => {
    const rows = overviewQuery.data;
    if (!rows) return null;
    return [...rows.budgets, ...(rows.global ? [rows.global] : [])].find((b) => b.id === id) ?? null;
  }, [overviewQuery.data, id]);

  const summaryQuery = useExpenseSummary(
    React.useMemo(
      () => ({ from: range.from, to: range.to, budget: id }),
      [range.from, range.to, id],
    ),
  );

  const listFilters = React.useMemo(
    () => ({
      type: 'expense' as const,
      budget: id,
      ...(range.from ? { start_date: range.from } : {}),
      ...(range.to ? { end_date: range.to } : {}),
      limit: 100,
    }),
    [id, range.from, range.to],
  );

  const listQuery = useQuery({
    queryKey: interactionKeys.list(listFilters),
    queryFn: () => fetchInteractions(listFilters),
  });

  const items: InteractionListItem[] = listQuery.data?.items ?? [];
  const summary = summaryQuery.data;
  const isLoading = summaryQuery.isLoading || listQuery.isLoading;
  const showSkeleton = useDelayedLoading(isLoading);

  const title = isUnbudgeted ? t('budget.unbudgeted.label') : (row?.name ?? t('budget.title'));
  // Un plafond n'a de sens que sur le mois en cours : le comparer à un total
  // annuel afficherait « 4 200 € / 400 € », un dépassement qui n'existe pas.
  const showCeiling = period.preset === 'currentMonth' && row?.amount != null;

  return (
    <>
      <BackLink fallback="/app/money?tab=budgets" fallbackLabel={t('budget.title')} />
      <PageHeader
        title={title}
        description={
          isUnbudgeted ? t('budget.unbudgeted.hint') : t('budgetDetail.description')
        }
      />

      <div className="flex flex-wrap gap-1.5 pb-4">
        {PRESETS.map((preset) => (
          <FilterPill
            key={preset}
            active={period.preset === preset}
            onClick={() => setPeriod({ preset })}
          >
            {t(`expenses.filters.period.${preset}`)}
          </FilterPill>
        ))}
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : null}

      {!isLoading && summary ? (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('budgetDetail.spent')}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
              {formatAmount(summary.total)}
              {showCeiling ? (
                <span className="text-base font-normal text-muted-foreground">
                  {' / '}
                  {formatAmount(row?.amount)}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('budgetDetail.count', { count: summary.count })}
            </p>
          </Card>

          {items.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t('budgetDetail.empty')}
              description={t('budgetDetail.emptyDescription')}
            />
          ) : (
            <>
              <ExpenseList items={items} />
              {/* La liste est plafonnée : le dire plutôt que laisser croire que
                  le total ne correspond pas aux lignes affichées. */}
              {(listQuery.data?.count ?? 0) > items.length ? (
                <p className="text-center text-xs text-muted-foreground">
                  {t('budgetDetail.truncated', {
                    shown: items.length,
                    total: listQuery.data?.count ?? 0,
                  })}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
