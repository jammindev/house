import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PieChart } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import ConsumptionBarChart, {
  type ConsumptionChartBucket,
} from '@/components/charts/ConsumptionBarChart';
import { Card, CardTitle } from '@/design-system/card';
import { formatAmount } from '@/lib/format';
import { chartColor } from '@/lib/chartColors';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { useBudgetCategoryInsights, useBudgetOverview } from '@/features/budget/hooks';
import BudgetCard from '@/features/budget/BudgetCard';
import { resolvePeriod, type PeriodRange } from '@/features/expenses/period';
import PeriodPicker from '@/features/expenses/PeriodPicker';
import ShareChart, { type ShareRow } from './ShareChart';
import InsightComparison from './InsightComparison';

/**
 * De quoi le total d'une catégorie est fait (`/app/money/categories/:id`).
 *
 * Le panneau affiche « 340 € / 450 € » sur « Maison » et s'arrête là. La
 * question qui suit n'est pas celle d'une enveloppe : sur une enveloppe on
 * demande *chez qui* l'argent est parti, sur une catégorie **laquelle de mes
 * enveloppes** mange ce total. Les lire une par une pour le reconstituer de tête
 * ne répond jamais qu'à peu près — d'où l'anneau, qui est la pièce centrale de
 * cette page et non une décoration.
 *
 * Deux règles héritées, et aucune n'est cosmétique :
 *
 * - **Rien n'est resommé ici.** Une catégorie ne porte aucune dépense : son
 *   sous-total ne peut être qu'une lecture de celles de ses enveloppes, et il
 *   n'existe qu'à un seul endroit (`insights?category=`, le même code que la
 *   fiche d'une enveloppe). Recomposer le total depuis les cartes affichées
 *   donnerait au même compteur une seconde définition, et cliquer sur un chiffre
 *   ouvrirait son démenti.
 * - **La période par défaut est le mois en cours**, celle du panneau, pour que le
 *   total affiché soit exactement celui sur lequel on vient de cliquer. En
 *   changer est ensuite un choix explicite.
 */
export default function BudgetCategoryDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();

  const [period, setPeriod] = useSessionState<PeriodRange>('budget.category.period', {
    preset: 'currentMonth',
  });
  const range = React.useMemo(() => resolvePeriod(period), [period]);

  // Le nom, le plafond et les enveloppes rangées dessous viennent de l'aperçu,
  // déjà en cache quand on arrive du panneau : ouvrir une catégorie ne doit pas
  // coûter un aller-retour de plus.
  const overviewQuery = useBudgetOverview();
  const row = React.useMemo(
    () => (overviewQuery.data?.categories ?? []).find((c) => c.id === id) ?? null,
    [overviewQuery.data, id],
  );
  const envelopes = React.useMemo(
    () => (overviewQuery.data?.budgets ?? []).filter((b) => b.category_id === id),
    [overviewQuery.data, id],
  );

  const insightsQuery = useBudgetCategoryInsights(id, range.from, range.to);
  const insights = insightsQuery.data;
  const showSkeleton = useDelayedLoading(insightsQuery.isLoading);

  // Un plafond n'a de sens que sur le mois en cours : le comparer à un total
  // annuel afficherait « 4 200 € / 450 € », un dépassement qui n'existe pas.
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

  // Les parts arrivent calculées du serveur, sur le **brut** — c'est lui que
  // l'anneau recompose, et le libellé du trou central le dit.
  const shareRows: ShareRow[] = React.useMemo(
    () =>
      (insights?.budgets ?? []).map((budget) => ({
        key: budget.budget_id,
        label: budget.name,
        total: budget.total,
        share: budget.share,
      })),
    [insights],
  );

  const hasSpending = Boolean(insights && Number(insights.current.total) > 0);

  return (
    <>
      <BackLink fallback="/app/money?tab=budgets" fallbackLabel={t('budget.title')} />
      <PageHeader
        title={row?.name ?? t('budget.category.detail.fallbackTitle')}
        description={t('budget.category.detail.description')}
      />

      <div className="pb-4">
        <PeriodPicker period={period} onChange={setPeriod} idPrefix="budget-category-detail" />
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

      {!insightsQuery.isLoading && insights ? (
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
              {/* D'où vient le plafond affiché. Sans ça, « / 450 € » sur une
                  catégorie qui n'a pas de plafond propre laisse croire qu'un
                  chiffre a été saisi quelque part. */}
              {showCeiling && !row?.has_own_amount ? ` · ${t('budget.category.sumHint')}` : ''}
            </p>
            {Number(insights.current.refunded) > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('budget.refunded', {
                  spent: formatAmount(insights.current.total),
                  refunded: formatAmount(insights.current.refunded),
                })}
              </p>
            ) : null}
            <InsightComparison insights={insights} locale={i18n.language} />
          </Card>

          {hasSpending ? (
            <>
              <Card className="p-4">
                <CardTitle>{t('budget.category.detail.share.title')}</CardTitle>
                <p className="mb-3 mt-1 text-xs text-muted-foreground">
                  {t('budget.category.detail.share.hint')}
                </p>
                <ShareChart
                  rows={shareRows}
                  total={insights.current.total}
                  totalLabel={t('budgetDetail.share.totalLabel')}
                />
              </Card>

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
            </>
          ) : null}

          {/* Les enveloppes de la catégorie, **toutes** — y compris celles qui
              n'ont rien dépensé, absentes de l'anneau par construction. C'est ici
              qu'on descend d'un cran, chaque carte ouvrant sa propre fiche.
              Pas d'éditer/supprimer : gérer ses enveloppes est le métier du
              panneau Budgets, et un second endroit pour le faire multiplierait
              les gestes destructeurs sans rien ajouter. */}
          {envelopes.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t('budget.category.detail.envelopes')}
              </h2>
              {envelopes.map((envelope) => (
                <BudgetCard
                  key={envelope.id}
                  row={envelope}
                  to={`/app/money/budgets/${envelope.id}`}
                  backState={pushBack(location)}
                />
              ))}
            </section>
          ) : (
            <EmptyState
              icon={PieChart}
              title={t('budget.category.empty')}
              description={t('budget.category.detail.emptyDescription')}
            />
          )}
        </div>
      ) : null}
    </>
  );
}
