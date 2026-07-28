import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Store } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import ConsumptionBarChart, {
  type ConsumptionChartBucket,
  type ConsumptionChartSeries,
} from '@/components/charts/ConsumptionBarChart';
import { Card, CardTitle } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import { Select } from '@/design-system/select';
import { formatAmount } from '@/lib/format';
import { chartColor, UNBUDGETED_COLOR } from '@/lib/chartColors';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { useBudgetAnalysis, useBudgets } from '@/features/budget/hooks';
import BudgetShareChart from './BudgetShareChart';
import { selectableBudgets } from '@/features/budget/tree';

/** Trois fenêtres, pas un curseur : on compare des saisons, pas des jours. */
const WINDOWS = [6, 12, 24] as const;

/** `YYYY-MM` → « juil. 2026 », dans la langue du lecteur. */
function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(
    new Date(y, (m || 1) - 1, 1),
  );
}

/**
 * Analyse fine des dépenses par budget (`/app/money/analysis`).
 *
 * Le panneau Budgets répond à « ce mois-ci tient-il dans l'enveloppe ». C'est la
 * seule question qu'il sache poser — donc une catégorie qui dérive de 15 % par
 * mois y reste invisible jusqu'au jour où elle franchit son plafond, et une
 * catégorie **sans plafond** n'y a aucun signal du tout. Cette page est la
 * lecture longue : la tendance, la répartition, chez qui, et les plus grosses.
 *
 * Tout vient d'un seul appel serveur : recalculer douze mois de séries dans le
 * navigateur imposerait de charger toutes les dépenses de l'année pour en
 * afficher douze barres.
 */
export default function AnalysisPage() {
  const { t, i18n } = useTranslation();
  const [months, setMonths] = useSessionState<number>('money.analysis.months', 12);
  const [budgetId, setBudgetId] = useSessionState<string>('money.analysis.budget', '');

  const budgetsQuery = useBudgets();
  const analysisQuery = useBudgetAnalysis(months, budgetId || null);
  const showSkeleton = useDelayedLoading(analysisQuery.isLoading);

  const data = analysisQuery.data;
  const locale = i18n.language;

  // Le serveur trie déjà les séries (budgets par nom, « hors budget » en
  // dernier) : la couleur s'indexe sur cette position et reste donc stable d'un
  // rendu à l'autre, ce qu'un index de `filter` ne garantirait pas.
  const series: ConsumptionChartSeries[] = React.useMemo(
    () =>
      (data?.series ?? []).map((row, index) => ({
        key: row.budget_id ?? 'unbudgeted',
        label: row.name ?? t('budget.unbudgeted.label'),
        color: row.budget_id === null ? UNBUDGETED_COLOR : chartColor(index),
      })),
    [data, t],
  );

  const buckets: ConsumptionChartBucket[] = React.useMemo(() => {
    if (!data) return [];
    return data.months.map((month, i) => ({
      // Le graphique attend un instant ISO ; le 1er à midi évite qu'un décalage
      // horaire ne recule l'étiquette d'un mois.
      ts: new Date(`${month}-01T12:00:00`).toISOString(),
      values: Object.fromEntries(
        data.series.map((row) => [row.budget_id ?? 'unbudgeted', Number(row.values[i])]),
      ),
    }));
  }, [data]);

  const hasSpending = Boolean(data && Number(data.total) > 0);
  const biggestSupplier = data?.suppliers[0];

  return (
    <>
      <BackLink fallback="/app/money?tab=budgets" fallbackLabel={t('budget.title')} />
      <PageHeader title={t('analysis.title')} description={t('analysis.description')} />

      <div className="flex flex-wrap items-center gap-2 pb-4">
        {WINDOWS.map((w) => (
          <FilterPill key={w} active={months === w} onClick={() => setMonths(w)}>
            {t('analysis.lastMonths', { count: w })}
          </FilterPill>
        ))}

        <Select
          className="ml-auto w-auto"
          value={budgetId}
          onChange={(e) => setBudgetId(e.target.value)}
          aria-label={t('analysis.filterBudget')}
          options={[
            { value: '', label: t('analysis.allBudgets') },
            ...selectableBudgets(budgetsQuery.data),
          ]}
        />
      </div>

      {showSkeleton ? (
        <div className="space-y-3">
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : null}

      {!analysisQuery.isLoading && data ? (
        !hasSpending ? (
          <EmptyState
            icon={BarChart3}
            title={t('analysis.empty')}
            description={t('analysis.emptyDescription')}
          />
        ) : (
          <div className="space-y-4">
            {/* Les trois chiffres qui cadrent la lecture avant tout graphique. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatCard label={t('analysis.periodTotal')} value={formatAmount(data.total, { fractionDigits: 0 })} />
              <StatCard
                label={t('analysis.monthlyAverage')}
                value={formatAmount(data.monthly_average, { fractionDigits: 0 })}
              />
              {biggestSupplier ? (
                <StatCard
                  label={t('analysis.topSupplier')}
                  value={biggestSupplier.supplier}
                  hint={formatAmount(biggestSupplier.total, { fractionDigits: 0 })}
                />
              ) : null}
            </div>

            <Card className="p-4">
              <CardTitle>{t('analysis.trend.title')}</CardTitle>
              <p className="mb-2 mt-1 text-xs text-muted-foreground">
                {t('analysis.trend.hint')}
              </p>
              <ConsumptionBarChart
                buckets={buckets}
                series={series}
                granularity="month"
                unit="€"
                formatValue={(v) => formatAmount(v, { fractionDigits: 0 })}
              />
            </Card>

            {/* Filtré sur un budget, la répartition n'aurait qu'une part : un
                disque plein à 100 % n'apprend rien, on le retire. */}
            {budgetId ? null : (
              <Card className="p-4">
                <CardTitle>{t('analysis.share.title')}</CardTitle>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                  {t('analysis.share.hint')}
                </p>
                <BudgetShareChart rows={data.breakdown} total={data.total} />
              </Card>
            )}

            {data.suppliers.length > 0 ? (
              <Card className="p-4">
                <CardTitle>{t('analysis.suppliers.title')}</CardTitle>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                  {t('analysis.suppliers.hint')}
                </p>
                <SupplierBars suppliers={data.suppliers} />
              </Card>
            ) : null}

            {data.biggest.length > 0 ? (
              <Card className="p-4">
                <CardTitle>{t('analysis.biggest.title')}</CardTitle>
                <ul className="mt-3 space-y-2">
                  {data.biggest.map((expense) => (
                    <li key={expense.id} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-foreground">
                        {expense.subject}
                        {expense.budget_name ? (
                          <span className="text-muted-foreground"> · {expense.budget_name}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-foreground">
                        {formatAmount(expense.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <p className="pt-1 text-center text-xs text-muted-foreground">
              {t('analysis.footnote', {
                from: monthLabel(data.months[0], locale),
                to: monthLabel(data.months[data.months.length - 1], locale),
              })}
            </p>
          </div>
        )
      ) : null}
    </>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

/**
 * Classement des fournisseurs — barres en CSS, pas en recharts.
 *
 * Un graphique à barres horizontales de huit lignes, c'est huit `div` dont la
 * largeur est une règle de trois. Y passer une librairie coûterait un axe, une
 * infobulle et un conteneur responsive pour afficher la même chose.
 */
function SupplierBars({
  suppliers,
}: {
  suppliers: { supplier: string; total: string; count: number }[];
}) {
  const { t } = useTranslation();
  const max = Math.max(...suppliers.map((s) => Number(s.total)), 1);

  return (
    <ul className="space-y-2">
      {suppliers.map((supplier, index) => (
        <li key={supplier.supplier}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-foreground">
              <Store className="mr-1 inline h-3 w-3 text-muted-foreground" aria-hidden />
              {supplier.supplier}
              <span className="text-muted-foreground">
                {' · '}
                {t('analysis.suppliers.count', { count: supplier.count })}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-foreground">
              {formatAmount(supplier.total, { fractionDigits: 0 })}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, Math.round((Number(supplier.total) / max) * 100))}%`,
                backgroundColor: chartColor(index),
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
