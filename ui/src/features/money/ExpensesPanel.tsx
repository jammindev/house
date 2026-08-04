import * as React from 'react';
import { CheckSquare, Pencil, Plus, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import EmptyState from '@/components/EmptyState';
import Pager from '@/components/Pager';
import SelectionBar from '@/components/SelectionBar';
import { useMultiSelect } from '@/lib/useMultiSelect';
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
import {
  currentMonthKey,
  normalizePeriod,
  resolvePeriod,
  type PeriodRange,
} from '@/features/expenses/period';
import ExpenseList from '@/features/expenses/ExpenseList';
import BulkEditDialog from '@/features/expenses/BulkEditDialog';
import ExpenseDialog from './ExpenseDialog';

/**
 * Onglet « Dépenses » du module Argent (parcours 26, lot 2).
 * Anciennement `expenses/ExpensesPage`, `PageHeader` en moins.
 */
export default function ExpensesPanel() {
  const { t } = useTranslation();

  // `normalizePeriod` convertit ce que la session porte peut-être encore :
  // `currentMonth`/`previousMonth` ont laissé place au stepper, et un état
  // persisté leur survit. Non converti, l'ancien preset tombe dans la branche
  // `custom` de `resolvePeriod` — deux bornes vides, donc **tout l'historique du
  // foyer** additionné sous un libellé qui annonce un mois.
  const [storedPeriod, setPeriod] = useSessionState<PeriodRange>('expenses.period', {
    preset: 'month',
    month: currentMonthKey(),
  });
  const period = React.useMemo(() => normalizePeriod(storedPeriod), [storedPeriod]);
  const [supplier, setSupplier] = useSessionState<string>('expenses.supplier', '');
  const [withoutSupplier, setWithoutSupplier] = useSessionState<boolean>(
    'expenses.withoutSupplier',
    false,
  );
  const [kind, setKind] = useSessionState<string>('expenses.kind', '');

  // « Chez Leclerc » et « sans fournisseur » ne peuvent pas être vrais ensemble :
  // les cumuler ne rendrait jamais qu'une liste vide, sans dire pourquoi. Chacun
  // éteint donc l'autre — même règle que le couple zone / sans-zone des photos.
  const toggleWithoutSupplier = React.useCallback(() => {
    const next = !withoutSupplier;
    setWithoutSupplier(next);
    if (next) setSupplier('');
  }, [withoutSupplier, setWithoutSupplier, setSupplier]);

  // Choisir un fournisseur **ou** « Tous » éteint le filtre dans les deux cas :
  // « Tous » est la pastille du « pas de filtre », donc elle doit aussi relâcher
  // celui-ci, sans quoi elle mentirait sur ce qu'elle montre.
  const chooseSupplier = React.useCallback(
    (value: string) => {
      setSupplier(value);
      setWithoutSupplier(false);
    },
    [setSupplier, setWithoutSupplier],
  );

  const range = React.useMemo(() => resolvePeriod(period), [period]);
  const filters = React.useMemo(
    () => ({
      from: range.from,
      to: range.to,
      ...(supplier ? { supplier } : {}),
      // Le résumé porte le **même** filtre que la liste : ses cartes s'affichent
      // au-dessus d'elle, et un total qui compte des lignes qu'elle ne montre pas
      // ferait perdre leur crédit aux deux.
      ...(withoutSupplier ? { without_supplier: '1' } : {}),
      ...(kind ? { kind } : {}),
    }),
    [range.from, range.to, supplier, withoutSupplier, kind],
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
  const pager = usePager(
    50,
    `${kind}|${supplier}|${withoutSupplier}|${range.from}|${range.to}`,
  );

  const listFilters = React.useMemo(
    () => ({
      type: 'expense' as const,
      ...(kind ? { kind } : {}),
      ...(supplier ? { supplier } : {}),
      ...(withoutSupplier ? { without_supplier: '1' } : {}),
      // Period filter on list reuses occurred_at, but the summary endpoint uses
      // strict from/to — for the list we keep the same range for visual coherence.
      // The list endpoint filter param is `start_date`/`end_date` per views.py:71.
      ...(range.from ? { start_date: range.from } : {}),
      ...(range.to ? { end_date: range.to } : {}),
      limit: pager.limit,
      offset: pager.offset,
    }),
    [kind, supplier, withoutSupplier, range.from, range.to, pager.limit, pager.offset],
  );

  const listQuery = useQuery({
    queryKey: interactionKeys.list(listFilters),
    queryFn: () => fetchInteractions(listFilters as Parameters<typeof fetchInteractions>[0]),
  });

  // Mémoïsé, et pas seulement pour faire taire le linter : le `?? []` fabriquait un
  // tableau neuf à chaque rendu, donc la liste d'ids que lit `useMultiSelect`
  // changeait d'identité en permanence et recalculait la sélection pour rien.
  const items: InteractionListItem[] = React.useMemo(
    () => listQuery.data?.items ?? [],
    [listQuery.data],
  );

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
  const [bulkOpen, setBulkOpen] = React.useState(false);

  /**
   * La `scopeKey` porte **tous** les filtres et la pagination : cocher douze
   * dépenses de juillet puis basculer sur juin ou tourner la page laisserait
   * sinon une sélection invisible, et le lot suivant porterait sur autre chose
   * que ce que l'écran montre.
   *
   * `withoutSupplier` en fait partie au même titre que les autres — il y
   * manquait. Éteindre puis rallumer la pastille ramenait les lignes cochées
   * avant le détour : elles quittent bien la sélection le temps qu'elles sont
   * hors filtre (elle est dérivée des ids affichés), mais elles y dorment et se
   * rallument au retour. Or c'est **le** filtre qu'on manipule en composant un
   * lot, puisque corriger un fournisseur manquant est ce qui l'éteint.
   */
  const selection = useMultiSelect(
    React.useMemo(() => items.map((item) => item.id), [items]),
    {
      scopeKey: `${kind}|${supplier}|${withoutSupplier}|${range.from}|${range.to}|${pager.offset}`,
    },
  );

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 pb-4">
        {items.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => (selection.active ? selection.exit() : selection.enter())}
            className="gap-1.5"
          >
            <CheckSquare className="h-4 w-4" />
            {selection.active ? t('common.cancel') : t('common.select')}
          </Button>
        ) : null}
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
          onSupplierChange={chooseSupplier}
          withoutSupplier={withoutSupplier}
          onWithoutSupplierToggle={toggleWithoutSupplier}
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
                <ExpenseList
                  items={items}
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
          </>
        ) : null}
      </div>

      <ExpenseDialog open={adhocOpen} onOpenChange={setAdhocOpen} />
      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        ids={selection.selectedIds}
        onDone={selection.exit}
      />
    </>
  );
}
