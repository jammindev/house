import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Pencil, Receipt } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import Pager from '@/components/Pager';
import SelectionBar from '@/components/SelectionBar';
import ConsumptionBarChart, {
  type ConsumptionChartBucket,
} from '@/components/charts/ConsumptionBarChart';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
import { formatAmount, formatDate } from '@/lib/format';
import { chartColor } from '@/lib/chartColors';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useMultiSelect } from '@/lib/useMultiSelect';
import { usePager } from '@/lib/usePager';
import { useSessionState } from '@/lib/useSessionState';
import { fetchInteractions, type InteractionListItem } from '@/lib/api/interactions';
import { interactionKeys } from '@/features/interactions/hooks';
import { useBudgetInsights, useBudgetOverview } from '@/features/budget/hooks';
import { useTransactions } from '@/features/banking/hooks';
import { resolvePeriod, type PeriodRange } from '@/features/expenses/period';
import PeriodPicker from '@/features/expenses/PeriodPicker';
import ExpenseFilters from '@/features/expenses/ExpenseFilters';
import ExpenseList from '@/features/expenses/ExpenseList';
import BulkEditDialog from '@/features/expenses/BulkEditDialog';
import ShareChart, { type ShareRow } from './ShareChart';
import InsightComparison from './InsightComparison';

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
 *
 * Et une fois qu'on voit *lesquelles*, le geste suivant est de **corriger** —
 * typiquement déplacer trois lignes mal rangées dans une autre enveloppe. D'où
 * la même sélection multiple que l'onglet Dépenses, sur les mêmes composants
 * génériques : cette page n'a pas de règle propre à la sélection, seulement une
 * portée à elle (voir `selection` plus bas).
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

  /**
   * Les filtres de l'onglet Dépenses, moins la période : ici ils **réduisent la
   * liste** et rien d'autre.
   *
   * ⚠️ Ils ne touchent pas au bloc du haut, et ce n'est pas une simplification.
   * Ce bloc compare le dépensé à un **plafond** (« 340 € / 400 € ») : un
   * sous-total filtré sous un plafond entier dirait « tu es large » à quelqu'un
   * qui vient de dépasser — même famille de mensonge que le plafond qui recule.
   * Le total, sa comparaison, la courbe et l'anneau restent donc définis par la
   * seule période, qui vit en tête de page.
   *
   * La conséquence est voulue : l'anneau des fournisseurs continue de répondre
   * « combien chez qui » sur toute la fenêtre. C'est la carte depuis laquelle on
   * filtre, pas une vue de ce qui est filtré.
   */
  const [kind, setKind] = useSessionState<string>('budget.detail.kind', '');
  const [supplier, setSupplier] = useSessionState<string>('budget.detail.supplier', '');
  const [withoutSupplier, setWithoutSupplier] = useSessionState<boolean>(
    'budget.detail.withoutSupplier',
    false,
  );

  // Mêmes exclusions mutuelles que l'onglet Dépenses : « chez Leclerc » et « sans
  // fournisseur » ensemble ne rendraient jamais qu'une liste vide, sans dire
  // pourquoi.
  const toggleWithoutSupplier = React.useCallback(() => {
    const next = !withoutSupplier;
    setWithoutSupplier(next);
    if (next) setSupplier('');
  }, [withoutSupplier, setWithoutSupplier, setSupplier]);

  const chooseSupplier = React.useCallback(
    (value: string) => {
      setSupplier(value);
      setWithoutSupplier(false);
    },
    [setSupplier, setWithoutSupplier],
  );

  /**
   * Les options viennent d'`insights`, donc de la **fenêtre entière** et du
   * serveur — jamais des lignes de la page affichée, qui n'en connaît qu'un
   * cinquième sur une enveloppe chargée. Et elles ne se réduisent pas quand un
   * filtre est actif : on peut passer d'un fournisseur à l'autre sans repasser
   * par « Tous ».
   *
   * ⚠️ **La valeur active est épinglée dans les options**, même absente de la
   * fenêtre. Elle peut l'être de deux façons : les filtres sont gardés d'une
   * enveloppe à l'autre (une seule clé de session, comme la période), et un
   * fournisseur du mois en cours peut n'avoir rien dépensé le mois d'avant. Sans
   * cet épinglage la pastille disparaît des options alors que le filtre reste
   * actif : liste vide, « Tous » non surligné, et rien à l'écran ne nomme le
   * coupable — un filtre qu'on subit sans le voir.
   */
  const supplierOptions = React.useMemo(() => {
    const top = (insights?.suppliers ?? []).map((s) => s.supplier).filter(Boolean).slice(0, 8);
    return supplier && !top.includes(supplier) ? [supplier, ...top] : top;
  }, [insights, supplier]);
  const kindOptions = React.useMemo(() => {
    const all = (insights?.kinds ?? []).map((k) => k.kind);
    return kind && !all.includes(kind) ? [kind, ...all] : all;
  }, [insights, kind]);

  /**
   * La liste se **parcourt**, elle ne se plafonne pas.
   *
   * Elle s'arrêtait à 100 lignes avec une note de troncature. Sur une enveloppe
   * chargée c'était déjà gênant à lire ; avec la sélection multiple ça devenait
   * faux : « tout sélectionner » n'aurait porté que sur les cent premières
   * pendant que le compteur du haut en annonce trois cents, et un lot qui
   * prétend traiter *tout* en laissant deux cents lignes derrière est exactement
   * le dégât qu'aucun écran ne rattrape. Le serveur plafonne d'ailleurs à 100
   * par requête — une fenêtre qu'on agrandit s'y serait arrêtée sans le dire.
   */
  const pager = usePager(
    50,
    `${id}|${range.from}|${range.to}|${kind}|${supplier}|${withoutSupplier}`,
  );

  const listFilters = React.useMemo(
    () => ({
      type: 'expense' as const,
      budget: id,
      ...(kind ? { kind } : {}),
      ...(supplier ? { supplier } : {}),
      ...(withoutSupplier ? { without_supplier: '1' } : {}),
      ...(range.from ? { start_date: range.from } : {}),
      ...(range.to ? { end_date: range.to } : {}),
      limit: pager.limit,
      offset: pager.offset,
    }),
    [id, kind, supplier, withoutSupplier, range.from, range.to, pager.limit, pager.offset],
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

  // Mémoïsé : le `?? []` fabriquait un tableau neuf à chaque rendu, donc la liste
  // d'ids que lit `useMultiSelect` changeait d'identité en permanence et
  // recalculait la sélection pour rien. Inoffensif tant que rien ne la lisait.
  const items: InteractionListItem[] = React.useMemo(
    () => listQuery.data?.items ?? [],
    [listQuery.data],
  );

  /**
   * La portée de la sélection porte **l'enveloppe** en plus de la période et de
   * la page, parce que la route est la même d'une enveloppe à l'autre : `:id`
   * change, le composant reste monté.
   *
   * La dérivation par les ids affichés fait déjà tomber le compteur à zéro en
   * arrivant sur « Courses » — ce n'est pas ce que l'id protège. Ce qu'il protège
   * est le **retour** : sans lui, les trois lignes cochées sur « Bricolage »
   * dorment dans le `Set` et se rallument au premier détour ramenant à elles,
   * alors que l'utilisateur a composé son lot deux écrans plus tôt et ne le sait
   * plus. Un lot qu'on n'a pas conscience de tenir est exactement celui qu'on
   * envoie de travers.
   */
  const selection = useMultiSelect(
    React.useMemo(() => items.map((item) => item.id), [items]),
    {
      scopeKey: `${id}|${range.from}|${range.to}|${kind}|${supplier}|${withoutSupplier}|${pager.offset}`,
    },
  );

  // Une page qui s'est vidée sous les doigts ramène à la première. Le cas est ici
  // la règle plutôt que l'exception : déplacer tout un lot vers une autre
  // enveloppe le fait **sortir** de cette liste, qui est filtrée par budget.
  // Rester sur une page vide afficherait « aucune dépense » sur une enveloppe qui
  // en compte deux cents.
  React.useEffect(() => {
    if (!listQuery.isFetching && items.length === 0 && pager.offset > 0) pager.reset();
  }, [listQuery.isFetching, items.length, pager]);

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
  /** Une liste réduite par un choix de l'utilisateur — la période n'en fait pas
   *  partie, elle définit la fenêtre plutôt qu'elle ne la restreint. */
  const isFiltered = Boolean(kind || supplier || withoutSupplier);
  const [bulkOpen, setBulkOpen] = React.useState(false);

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
            <InsightComparison insights={insights} locale={i18n.language} />
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

          {/* ⚠️ Les filtres se rendent **au-dessus** de la branche vide, et non
              dedans : filtrés jusqu'à zéro ligne, ils disparaîtraient avec la
              liste et il n'y aurait plus rien pour les relâcher. Ils s'affichent
              dès que l'enveloppe a dépensé quelque chose sur la période —
              `insights` ignorant les filtres, ce test reste vrai quand la liste
              est vide *à cause* d'eux. */}
          {hasSpending ? (
            <div className="flex flex-wrap items-end justify-between gap-3">
              <ExpenseFilters
                period={period}
                onPeriodChange={setPeriod}
                supplier={supplier}
                onSupplierChange={chooseSupplier}
                withoutSupplier={withoutSupplier}
                onWithoutSupplierToggle={toggleWithoutSupplier}
                kind={kind}
                onKindChange={setKind}
                supplierOptions={supplierOptions}
                kindOptions={kindOptions}
                showPeriod={false}
              />
              {/* Entrer en sélection est un geste qui porte sur les lignes : le
                  bouton reste contre elles, pas en tête de page où deux
                  graphiques le sépareraient de son objet. */}
              {items.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => (selection.active ? selection.exit() : selection.enter())}
                  className="gap-1.5"
                >
                  <CheckSquare className="h-4 w-4" />
                  {selection.active ? t('common.cancel') : t('common.select')}
                </Button>
              ) : null}
            </div>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              icon={Receipt}
              // Filtrée jusqu'au vide, la liste ne dit pas la même chose qu'une
              // période sans dépense : l'une se règle en relâchant une pastille,
              // l'autre en changeant de période. Un seul message pour les deux
              // enverrait la moitié des lecteurs au mauvais endroit.
              title={isFiltered ? t('budgetDetail.emptyFiltered') : t('budgetDetail.empty')}
              description={
                isFiltered
                  ? t('budgetDetail.emptyFilteredDescription')
                  : t('budgetDetail.emptyDescription')
              }
            />
          ) : (
            <>
              <ExpenseList
                items={items}
                // La pastille a sa place ici depuis que la page porte le filtre
                // « sans fournisseur » et la correction en lot : elle montre ce
                // que le filtre irait chercher.
                flagWithoutSupplier
                onToggleSelected={
                  selection.active ? (item) => selection.toggle(item.id) : undefined
                }
                isSelected={(item) => selection.isSelected(item.id)}
              />
              {selection.active ? (
                <SelectionBar
                  label={t('expenses.bulk.selected', { count: selection.count })}
                  allSelected={selection.allSelected}
                  onToggleAll={selection.allSelected ? selection.clear : selection.selectAll}
                  onExit={selection.exit}
                >
                  <Button
                    type="button"
                    size="sm"
                    disabled={selection.count === 0}
                    onClick={() => setBulkOpen(true)}
                    className="gap-1.5"
                  >
                    <Pencil className="h-4 w-4" />
                    {t('expenses.bulk.action')}
                  </Button>
                </SelectionBar>
              ) : null}
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
        </div>
      ) : null}

      {/* Le même dialogue que l'onglet Dépenses, sans une ligne de plus : il ne
          prend qu'une liste d'ids. Son champ budget est justement le geste qu'on
          vient chercher ici — ranger ailleurs ce qui est mal rangé. */}
      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        ids={selection.selectedIds}
        onDone={selection.exit}
      />
    </>
  );
}
