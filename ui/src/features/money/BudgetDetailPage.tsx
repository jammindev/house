import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Receipt, TrendingDown, TrendingUp } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import ConsumptionBarChart, {
  type ConsumptionChartBucket,
} from '@/components/charts/ConsumptionBarChart';
import { Card, CardTitle } from '@/design-system/card';
import { formatAmount, formatDate } from '@/lib/format';
import { chartColor } from '@/lib/chartColors';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import type { BudgetInsights } from '@/lib/api/budget';
import { interactionKeys } from '@/features/interactions/hooks';
import { useBudgetInsights, useBudgetOverview } from '@/features/budget/hooks';
import { useTransactions } from '@/features/banking/hooks';
import { resolvePeriod, type PeriodRange } from '@/features/expenses/period';
import PeriodPicker from '@/features/expenses/PeriodPicker';
import ExpenseList from '@/features/expenses/ExpenseList';
import ShareChart, { type ShareRow } from './ShareChart';

/** Le seau « hors budget » s'ouvre comme une enveloppe — même page, même geste. */
export const UNBUDGETED = 'none';

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
 *
 * Trois lectures s'ajoutent au total, parce qu'un montant seul ne répond à
 * aucune des questions qu'on se pose devant lui : **combien avant** (la période
 * précédente équivalente, avec l'écart), **quelle forme** (la série jour par
 * jour, ou mois par mois sur une longue fenêtre), **chez qui** (la répartition
 * par fournisseur). Tout arrive du serveur en un appel : refaire ces agrégats
 * ici imposerait de charger toutes les dépenses de la fenêtre, et donnerait au
 * compteur affiché juste au-dessus une seconde définition.
 */
export default function BudgetDetailPage() {
  const { t, i18n } = useTranslation();
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

  const insightsQuery = useBudgetInsights(id, range.from, range.to);
  const insights = insightsQuery.data;

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

  // Ce que l'enveloppe s'est fait rendre sur la période. Une ligne à part, pas
  // une dépense négative : `Interaction.amount` ne descend jamais sous zéro.
  const refundFilters = React.useMemo(
    () => ({
      refund_budget: isUnbudgeted ? undefined : id,
      ...(range.from ? { date_from: range.from } : {}),
      ...(range.to ? { date_to: range.to } : {}),
    }),
    [id, isUnbudgeted, range.from, range.to],
  );
  const refundsQuery = useTransactions(refundFilters, 50, { enabled: !isUnbudgeted });
  const refunds = refundsQuery.data?.results ?? [];

  const items: InteractionListItem[] = listQuery.data?.items ?? [];
  const isLoading = insightsQuery.isLoading || listQuery.isLoading;
  const showSkeleton = useDelayedLoading(isLoading);

  const title = isUnbudgeted ? t('budget.unbudgeted.label') : (row?.name ?? t('budget.title'));
  // Un plafond n'a de sens que sur le mois en cours : le comparer à un total
  // annuel afficherait « 4 200 € / 400 € », un dépassement qui n'existe pas.
  const showCeiling = period.preset === 'currentMonth' && row?.amount != null;

  const buckets: ConsumptionChartBucket[] = React.useMemo(() => {
    if (!insights) return [];
    return insights.buckets.map((bucket) => ({
      // Le graphique attend un instant ISO ; midi évite qu'un décalage horaire
      // ne recule l'étiquette d'un jour — ou d'un mois sur une barre mensuelle.
      ts: new Date(
        insights.granularity === 'day'
          ? `${bucket.label}T12:00:00`
          : `${bucket.label}-01T12:00:00`,
      ).toISOString(),
      values: { spent: Number(bucket.total) },
    }));
  }, [insights]);

  const shareRows: ShareRow[] = React.useMemo(
    () =>
      (insights?.suppliers ?? []).map((supplier) => ({
        key: supplier.supplier || '__none__',
        // Une dépense sans fournisseur reste dans la part — la retirer ferait un
        // anneau qui n'atteint pas cent.
        label: supplier.supplier || t('budgetDetail.share.noSupplier'),
        total: supplier.total,
        share: supplier.share,
      })),
    [insights, t],
  );

  const hasSpending = Boolean(insights && Number(insights.current.total) > 0);

  return (
    <>
      <BackLink fallback="/app/money?tab=budgets" fallbackLabel={t('budget.title')} />
      <PageHeader
        title={title}
        description={
          isUnbudgeted ? t('budget.unbudgeted.hint') : t('budgetDetail.description')
        }
      />

      <div className="pb-4">
        <PeriodPicker period={period} onChange={setPeriod} idPrefix="budget-detail" />
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-56 animate-pulse rounded-lg bg-muted" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : null}

      {!isLoading && insights ? (
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t('budgetDetail.spent')}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
              {formatAmount(insights.current.net_total)}
              {showCeiling ? (
                <span className="text-base font-normal text-muted-foreground">
                  {' / '}
                  {formatAmount(row?.amount)}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('budgetDetail.count', { count: insights.current.count })}
            </p>
            {Number(insights.current.refunded) > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('budget.refunded', {
                  spent: formatAmount(insights.current.total),
                  refunded: formatAmount(insights.current.refunded),
                })}
              </p>
            ) : null}
            <Comparison insights={insights} locale={i18n.language} />
          </Card>

          {hasSpending ? (
            <>
              <Card className="p-4">
                <CardTitle>{t('budgetDetail.trend.title')}</CardTitle>
                <p className="mb-2 mt-1 text-xs text-muted-foreground">
                  {t(`budgetDetail.trend.hint.${insights.granularity}`)}
                </p>
                <ConsumptionBarChart
                  buckets={buckets}
                  series={[{ key: 'spent', label: t('budgetDetail.spent'), color: chartColor(0) }]}
                  granularity={insights.granularity}
                  unit="€"
                  formatValue={(v) => formatAmount(v, { fractionDigits: 0 })}
                />
              </Card>

              <Card className="p-4">
                <CardTitle>{t('budgetDetail.share.title')}</CardTitle>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                  {t('budgetDetail.share.hint')}
                </p>
                <ShareChart
                  rows={shareRows}
                  total={insights.current.total}
                  totalLabel={t('budgetDetail.share.totalLabel')}
                />
              </Card>
            </>
          ) : null}

          {refunds.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t('budgetDetail.refundsTitle')}
              </h2>
              <ul className="space-y-2">
                {refunds.map((line) => (
                  <li key={line.id}>
                    <Card className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/app/money/transactions/${line.id}`}
                            className="truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                          >
                            {line.label_raw}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDate(line.booked_on)}
                          </p>
                        </div>
                        {/* ⚠️ La **part attribuée** à cette enveloppe, pas le
                            montant de la ligne. Depuis que 70 € peuvent se
                            répartir en 40 € + 30 €, afficher la ligne annoncerait
                            ici 70 € rendus à une enveloppe qui n'en a récupéré
                            que 40 — et cette page dirait autre chose que son
                            propre total, juste au-dessus. */}
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                          −
                          {formatAmount(
                            (line.refund_allocations ?? []).find((row) => row.budget === id)
                              ?.amount ?? '0',
                          )}
                        </p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

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

/**
 * « −12 % par rapport à juin 2026 (170 €) ».
 *
 * La période de référence a la **même forme** que celle affichée — un mois se
 * compare au mois d'avant, pas aux trente-et-un jours d'avant — et c'est le
 * serveur qui la choisit, pour que la phrase et le chiffre ne puissent pas
 * dériver l'un de l'autre.
 *
 * Sans dépense avant, il n'y a pas de pourcentage : on le dit avec des mots.
 * « +∞ % » serait le même mensonge qu'une part sur un total nul.
 */
function Comparison({ insights, locale }: { insights: BudgetInsights; locale: string }) {
  const { t } = useTranslation();
  const { delta, previous, previous_period: window } = insights;
  const ratio = delta.ratio;
  const label = window.from ? rangeLabel(window.from, window.to, locale) : '';

  if (ratio === null) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {t('budgetDetail.compare.noBaseline', { period: label })}
      </p>
    );
  }

  const up = ratio > 0;
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`inline-flex items-center gap-1 font-medium tabular-nums ${
          up ? 'text-destructive' : 'text-primary'
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {up ? '+' : ''}
        {Math.round(ratio * 100)}%
      </span>
      <span>
        {t('budgetDetail.compare.versus', {
          period: label,
          amount: formatAmount(previous.net_total, { fractionDigits: 0 }),
        })}
      </span>
    </p>
  );
}

/** « juin 2026 » pour un mois plein, « 1 – 10 juil. » sinon. */
function rangeLabel(from: string, to: string | null, locale: string): string {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to ?? from}T12:00:00`);
  const isFullMonth =
    start.getDate() === 1 &&
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear() &&
    new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() === end.getDate();

  if (isFullMonth) {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(start);
  }
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  return `${format.format(start)} – ${format.format(end)}`;
}
