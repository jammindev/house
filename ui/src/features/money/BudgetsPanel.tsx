import * as React from 'react';
import {
  Plus,
  PiggyBank,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  FileText,
  FolderPlus,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useSessionState } from '@/lib/useSessionState';
import { pushBack } from '@/lib/backNavigation';
import { formatAmount } from '@/lib/format';
import PeriodPicker from '@/features/expenses/PeriodPicker';
import { currentMonthKey, normalizePeriod, type PeriodRange } from '@/features/expenses/period';
import type {
  Budget,
  BudgetCategory,
  BudgetCategoryRow,
  BudgetOverviewRow,
} from '@/lib/api/budget';
import {
  useBudgetOverview,
  useDeleteBudget,
  useDeleteBudgetCategory,
} from '@/features/budget/hooks';
import BudgetCard from '@/features/budget/BudgetCard';
import BudgetCategoryCard from '@/features/budget/BudgetCategoryCard';
import BudgetCategoryDialog from '@/features/budget/BudgetCategoryDialog';
import BudgetDialog from '@/features/budget/BudgetDialog';
import AccessCard from './AccessCard';

/** Rebuild an editable Budget from an overview row (avoids a second fetch). */
function rowToBudget(
  row: BudgetOverviewRow,
  isGlobal: boolean,
  categoryName?: string,
): Budget {
  return {
    id: row.id,
    name: row.name,
    // ⚠️ `monthly_amount`, jamais `amount` : le second est le plafond
    // *comparable*, et il vaut `null` dès que la fenêtre n'est pas un mois
    // entier. Éditer « Courses » depuis « cette année » aurait alors ouvert un
    // champ plafond vide, et l'enregistrement l'aurait effacé en base sans un
    // mot — une donnée perdue par un simple changement de filtre.
    monthly_amount: row.monthly_amount,
    is_global: isGlobal,
    category: row.category_id ? { id: row.category_id, name: categoryName ?? '' } : null,
    created_at: '',
    updated_at: '',
  };
}

/** Same trick for a category row — the dialog only needs name + own ceiling. */
function rowToCategory(row: BudgetCategoryRow): BudgetCategory {
  return {
    id: row.id,
    name: row.name,
    // ⚠️ Uniquement son plafond **propre**, et lu sur `monthly_amount` : passer
    // la somme de ses budgets remplirait le champ avec un chiffre que personne
    // n'a saisi, et lire `amount` le viderait dès que la fenêtre n'est pas un
    // mois entier. Dans les deux cas le premier enregistrement fige le mensonge.
    monthly_amount: row.monthly_amount,
    budget_count: row.budget_count,
    created_at: '',
    updated_at: '',
  };
}

/**
 * Onglet « Budgets » du module Argent (parcours 26, lot 2).
 * Anciennement `budget/BudgetPage`, `PageHeader` en moins.
 */
export default function BudgetsPanel() {
  const { t } = useTranslation();
  const location = useLocation();

  // Le sélecteur **entier** des dépenses : la navigation par mois et les
  // fenêtres libres. Même composant, mêmes fenêtres — sans quoi « ce mois-ci »
  // finirait par ne pas vouloir dire la même chose d'un onglet à l'autre.
  //
  // ⚠️ Hors mois entier, c'est le **serveur** qui retire les plafonds
  // (`amount: null`, état `uncapped`) : un plafond mensuel n'a pas d'échelle en
  // face d'une année, et « 4 200 € / 400 € » en rouge sur une enveloppe tenue
  // serait un dépassement qui n'existe pas. Les cartes savent déjà afficher une
  // ligne sans plafond — c'est le cas d'une enveloppe suivie mais non plafonnée.
  const [storedPeriod, setPeriod] = useSessionState<PeriodRange>('budget.period', {
    preset: 'month',
    month: currentMonthKey(),
  });
  const period = React.useMemo(() => normalizePeriod(storedPeriod), [storedPeriod]);

  const overviewQuery = useBudgetOverview(period);
  const deleteMutation = useDeleteBudget();
  const deleteCategoryMutation = useDeleteBudgetCategory();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Budget | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = React.useState<Set<string>>(new Set());

  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<BudgetCategory | undefined>(
    undefined,
  );
  const [pendingCategoryDelete, setPendingCategoryDelete] = React.useState<Set<string>>(new Set());

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('budget.deleted'),
    onDelete: (id) => deleteMutation.mutateAsync(id),
  });

  const { deleteWithUndo: deleteCategoryWithUndo } = useDeleteWithUndo({
    label: t('budget.category.deleted'),
    onDelete: (id) => deleteCategoryMutation.mutateAsync(id),
  });

  const overview = overviewQuery.data;
  const showSkeleton = useDelayedLoading(overviewQuery.isLoading);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(budget: Budget) {
    setEditing(budget);
    setDialogOpen(true);
  }

  function handleDelete(id: string) {
    deleteWithUndo(id, {
      onRemove: () => setPendingDelete((prev) => new Set(prev).add(id)),
      onRestore: () =>
        setPendingDelete((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    });
  }

  function openCreateCategory() {
    setEditingCategory(undefined);
    setCategoryDialogOpen(true);
  }

  function openEditCategory(category: BudgetCategory) {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  }

  function handleDeleteCategory(id: string) {
    deleteCategoryWithUndo(id, {
      onRemove: () => setPendingCategoryDelete((prev) => new Set(prev).add(id)),
      onRestore: () =>
        setPendingCategoryDelete((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    });
  }

  const namedRows = (overview?.budgets ?? []).filter((r) => !pendingDelete.has(r.id));
  const categoryRows = (overview?.categories ?? []).filter(
    (r) => !pendingCategoryDelete.has(r.id),
  );

  // Le regroupement est **de l'affichage seul** : chaque total vient déjà calculé
  // du serveur, le front ne resomme rien. Un total recalculé côté client finirait
  // par ne plus dire la même chose que le Contrôle.
  //
  // Une catégorie dont on vient d'annuler la suppression réapparaît avec ses
  // budgets : c'est pour ça que le rangement se lit sur `category_id` et non sur
  // une liste figée au chargement.
  const budgetsByCategory = React.useMemo(() => {
    const map = new Map<string, BudgetOverviewRow[]>();
    for (const row of namedRows) {
      if (!row.category_id) continue;
      const siblings = map.get(row.category_id) ?? [];
      siblings.push(row);
      map.set(row.category_id, siblings);
    }
    return map;
  }, [namedRows]);

  const visibleCategoryIds = new Set(categoryRows.map((r) => r.id));
  // Un budget dont la catégorie vient d'être supprimée redevient libre à
  // l'écran aussitôt — sinon il disparaîtrait le temps que le serveur réponde.
  const ungroupedRows = namedRows.filter(
    (r) => !r.category_id || !visibleCategoryIds.has(r.category_id),
  );
  const categoryNameById = new Map(categoryRows.map((r) => [r.id, r.name]));
  const globalRow = overview?.global && !pendingDelete.has(overview.global.id) ? overview.global : null;
  const hasAnyBudget = Boolean(globalRow) || namedRows.length > 0 || categoryRows.length > 0;
  const allowGlobal = !globalRow;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <PeriodPicker period={period} onChange={setPeriod} idPrefix="budget-panel" />
        <Button type="button" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t('budget.new.action')}
        </Button>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : null}

      {!overviewQuery.isLoading && overview ? (
        !hasAnyBudget ? (
          <EmptyState
            icon={PiggyBank}
            title={t('budget.empty')}
            description={t('budget.emptyDescription')}
            action={{ label: t('budget.new.action'), onClick: openCreate }}
          />
        ) : (
          // Pendant le chargement d'un autre mois, les chiffres affichés sont
          // encore ceux du précédent (`placeholderData`) : ils s'estompent le
          // temps que les vrais arrivent. Sans ce signal, un mois lent laisse
          // croire que les montants du mois d'avant sont ceux qu'on a demandés.
          <div
            className={`space-y-5 transition-opacity ${
              overviewQuery.isPlaceholderData ? 'opacity-50' : ''
            }`}
          >
            {/* Global cap — the safety net over everything. */}
            {globalRow ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">{t('budget.global.heading')}</h2>
                <BudgetCard
                  row={globalRow}
                  to={`/app/money/budgets/${globalRow.id}`}
                  backState={pushBack(location)}
                  onEdit={() => openEdit(rowToBudget(globalRow, true))}
                  onDelete={() => handleDelete(globalRow.id)}
                />
                {overview.named_exceeds_global ? (
                  <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground dark:text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {t('budget.namedExceedsGlobal', {
                        named: formatAmount(overview.named_total_amount),
                        global: formatAmount(globalRow.amount),
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <Card className="flex items-center justify-between gap-3 p-3">
                <p className="text-sm text-muted-foreground">{t('budget.global.cta')}</p>
                <Button type="button" variant="outline" size="sm" onClick={openCreate}>
                  {t('budget.global.ctaAction')}
                </Button>
              </Card>
            )}

            {/* Named envelopes, grouped by category. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {t('budget.named.heading')}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={openCreateCategory}
                  className="gap-1.5"
                >
                  <FolderPlus className="h-4 w-4" />
                  {t('budget.category.new.action')}
                </Button>
              </div>

              {namedRows.length === 0 && categoryRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('budget.named.empty')}</p>
              ) : (
                <div className="space-y-4">
                  {categoryRows.map((category) => (
                    <div key={category.id} className="space-y-2">
                      <BudgetCategoryCard
                        row={category}
                        backState={pushBack(location)}
                        onEdit={() => openEditCategory(rowToCategory(category))}
                        onDelete={() => handleDeleteCategory(category.id)}
                      />
                      {(budgetsByCategory.get(category.id) ?? []).length === 0 ? (
                        <p className="ml-4 border-l-2 border-border pl-3 text-xs text-muted-foreground">
                          {t('budget.category.empty')}
                        </p>
                      ) : (
                        <div className="ml-4 space-y-2 border-l-2 border-border pl-3">
                          {(budgetsByCategory.get(category.id) ?? []).map((row) => (
                            <BudgetCard
                              key={row.id}
                              row={row}
                              to={`/app/money/budgets/${row.id}`}
                              backState={pushBack(location)}
                              onEdit={() =>
                                openEdit(
                                  rowToBudget(row, false, categoryNameById.get(category.id)),
                                )
                              }
                              onDelete={() => handleDelete(row.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {ungroupedRows.length > 0 ? (
                    <div className="space-y-2">
                      {categoryRows.length > 0 ? (
                        <h3 className="px-1 text-xs font-medium text-muted-foreground">
                          {t('budget.category.ungrouped')}
                        </h3>
                      ) : null}
                      {ungroupedRows.map((row) => (
                        <BudgetCard
                          key={row.id}
                          row={row}
                          to={`/app/money/budgets/${row.id}`}
                          backState={pushBack(location)}
                          onEdit={() => openEdit(rowToBudget(row, false))}
                          onDelete={() => handleDelete(row.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Hors budget — toujours visible, sans plafond, et **ouvrable**
                comme une enveloppe : c'est le seau où l'on cherche le plus
                souvent « mais qu'est-ce qu'il y a là-dedans ? ». */}
            <Link
              to="/app/money/budgets/none"
              state={pushBack(location)}
              className="group block"
            >
              <Card className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/60">
                <div className="min-w-0">
                  <p className="font-medium text-foreground group-hover:underline">
                    {t('budget.unbudgeted.label')}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('budget.unbudgeted.hint')}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatAmount(overview.unbudgeted)}
                </span>
              </Card>
            </Link>
          </div>
        )
      ) : null}

      {/* L'analyse en premier des trois accès : c'est la seule qui répond à
          « est-ce que ça dérive », question qu'aucune carte au-dessus ne pose. */}
      {!overviewQuery.isLoading && overview ? (
        <div className="mt-5 space-y-2">
          <AccessCard
            to="/app/money/analysis"
            icon={BarChart3}
            title={t('analysis.title')}
            hint={t('analysis.access.hint')}
          />
          <AccessCard
            to="/app/money/recurring"
            icon={CalendarClock}
            title={t('recurring.title')}
            hint={
              Number(overview.total_committed) > 0
                ? t('budget.recurringAccess.committed', {
                    amount: formatAmount(overview.total_committed),
                  })
                : t('budget.recurringAccess.hint')
            }
          />
          <AccessCard
            to="/app/money/reports"
            icon={FileText}
            title={t('report.title')}
            hint={t('report.access.hint')}
          />
        </div>
      ) : null}

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editing}
        allowGlobal={allowGlobal}
      />

      <BudgetCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        existing={editingCategory}
      />
    </>
  );
}
