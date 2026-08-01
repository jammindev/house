import * as React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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
import {
  currentMonthKey,
  normalizePeriod,
  resolvePeriod,
  type PeriodRange,
} from '@/features/expenses/period';
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
 * - **⚠️ Et tout ce qui porte un montant obéit à cette période.** L'aperçu du
 *   panneau (`useBudgetOverview`) ne donne ici que le nom, le plafond et
 *   l'**appartenance** des enveloppes. Lire ses montants pour la liste du bas —
 *   la faute livrée le 29/07 — affichait juillet sous un en-tête qui annonçait
 *   juin, et faisait passer un remboursement de juillet pour une incohérence du
 *   total de juin. Depuis l'issue #516 l'aperçu suit le mois choisi, ce qui rend
 *   la confusion moins visible mais **pas** moins fautive : sur une fenêtre
 *   libre — trente jours, une année — il répond toujours un mois, et les
 *   montants de la page viennent d'`insights`, jamais d'ici.
 */
export default function BudgetCategoryDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();

  const [storedPeriod, setPeriod] = useSessionState<PeriodRange>('budget.category.period', {
    preset: 'month',
    month: currentMonthKey(),
  });
  const period = React.useMemo(() => normalizePeriod(storedPeriod), [storedPeriod]);
  const range = React.useMemo(() => resolvePeriod(period), [period]);

  // Le nom, le plafond et les enveloppes rangées dessous viennent de l'aperçu,
  // déjà en cache quand on arrive du panneau : ouvrir une catégorie ne doit pas
  // coûter un aller-retour de plus. Il suit **le mois choisi** quand il y en a
  // un — le panneau demande le même, donc c'est bien le cache partagé.
  const overviewQuery = useBudgetOverview(period);
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

  // Un plafond n'a de sens qu'en face d'un **mois entier** : le comparer à un
  // total annuel afficherait « 4 200 € / 450 € », un dépassement qui n'existe
  // pas. Quel mois, en revanche, n'a pas d'importance. Le verdict vient du
  // serveur (`amount: null` hors mois entier) et n'est pas refait ici — un même
  // « peut-on comparer ? » calculé à deux endroits finit par répondre deux fois.
  const showCeiling = row?.amount != null;

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

  // Les parts arrivent calculées du serveur, sur le **net** : une enveloppe
  // remboursée de 488 € sur 762 € a coûté 275 €, et la dessiner à 762 € la ferait
  // paraître trois fois plus lourde qu'elle n'est.
  const shareRows: ShareRow[] = React.useMemo(
    () =>
      (insights?.budgets ?? []).map((budget) => ({
        key: budget.budget_id,
        label: budget.name,
        total: budget.net_total,
        share: budget.share,
      })),
    [insights],
  );

  /**
   * Les enveloppes de la catégorie **sur la fenêtre choisie**.
   *
   * ⚠️ Les montants viennent d'`insights`, jamais de l'aperçu : celui-ci est
   * figé sur le mois en cours, et les lire ici affichait juillet sous un titre
   * qui annonçait juin — deux mois dans le même écran, sans le dire. C'est
   * l'aperçu qui donne l'**appartenance** (quelles enveloppes sont rangées là,
   * ce qui ne dépend pas de la période), lui seul.
   */
  const envelopeRows = React.useMemo(() => {
    const byId = new Map(
      [...(insights?.budgets ?? []), ...(insights?.budgets_returned ?? [])].map((b) => [
        b.budget_id,
        b,
      ]),
    );
    const active = [...(insights?.budgets ?? []), ...(insights?.budgets_returned ?? [])].map(
      (b) => ({ id: b.budget_id, name: b.name, movement: b }),
    );
    // Celles qui n'ont pas bougé ferment la liste : elles sont absentes de
    // l'anneau par construction, et les omettre ici ferait croire qu'elles
    // n'existent pas.
    const idle = envelopes
      .filter((e) => !byId.has(e.id))
      .map((e) => ({ id: e.id, name: e.name, movement: null }));
    return [...active, ...idle];
  }, [insights, envelopes]);

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
                  total={insights.budgets_net_total}
                  totalLabel={t('budgetDetail.share.totalLabel')}
                />
                {/* Ce que l'anneau ne peut pas dessiner. Sans ce bloc, l'écart
                    entre le total du trou central et celui de la carte du haut
                    ressemblerait à une erreur de calcul — alors qu'il vaut
                    exactement la somme de ces lignes. */}
                {insights.budgets_returned.length > 0 ? (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-xs font-medium text-foreground">
                      {t('budget.category.detail.returned.title')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('budget.category.detail.returned.hint')}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {insights.budgets_returned.map((budget) => (
                        <li
                          key={budget.budget_id}
                          className="flex items-baseline justify-between gap-2 text-sm"
                        >
                          <span className="min-w-0 truncate text-foreground">{budget.name}</span>
                          <span className="shrink-0 tabular-nums text-primary">
                            {t('budget.category.detail.returned.line', {
                              refunded: formatAmount(budget.refunded),
                              spent: formatAmount(budget.total),
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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

          {/* Les enveloppes de la catégorie, **toutes**, avec leurs chiffres de la
              fenêtre choisie. C'est ici qu'on descend d'un cran, chaque ligne
              ouvrant sa propre fiche.

              Ni barre ni plafond : un plafond est **mensuel**, et l'afficher sous
              un total annuel comparerait deux fenêtres différentes. Il vit sur le
              panneau Budgets et sur la fiche de l'enveloppe, où il mesure bien ce
              qu'il prétend. Pas d'éditer/supprimer non plus : gérer ses
              enveloppes est le métier du panneau, et un second endroit pour le
              faire multiplierait les gestes destructeurs sans rien ajouter. */}
          {envelopeRows.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t('budget.category.detail.envelopes')}
              </h2>
              {envelopeRows.map((envelope) => (
                <Card key={envelope.id} className="p-3">
                  <Link
                    to={`/app/money/budgets/${envelope.id}`}
                    state={pushBack(location)}
                    className="group block"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-foreground group-hover:underline">
                        {envelope.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {envelope.movement
                          ? formatAmount(envelope.movement.net_total)
                          : formatAmount('0')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {envelope.movement
                        ? t('budgetDetail.count', { count: envelope.movement.count })
                        : t('budget.category.detail.noMovement')}
                    </p>
                    {envelope.movement && Number(envelope.movement.refunded) > 0 ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('budget.refunded', {
                          spent: formatAmount(envelope.movement.total),
                          refunded: formatAmount(envelope.movement.refunded),
                        })}
                      </p>
                    ) : null}
                  </Link>
                </Card>
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
