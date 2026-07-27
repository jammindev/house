import * as React from 'react';
import {
  Plus,
  PiggyBank,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  FileText,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { pushBack } from '@/lib/backNavigation';
import { formatAmount } from '@/lib/format';
import type { Budget, BudgetOverviewRow } from '@/lib/api/budget';
import { useBudgetOverview, useDeleteBudget } from '@/features/budget/hooks';
import BudgetCard from '@/features/budget/BudgetCard';
import BudgetDialog from '@/features/budget/BudgetDialog';
import AccessCard from './AccessCard';

/** Rebuild an editable Budget from an overview row (avoids a second fetch). */
function rowToBudget(row: BudgetOverviewRow, isGlobal: boolean, parentName?: string): Budget {
  return {
    id: row.id,
    name: row.name,
    monthly_amount: row.amount,
    is_global: isGlobal,
    parent: row.parent_id ? { id: row.parent_id, name: parentName ?? '' } : null,
    is_group: row.is_group,
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
  const overviewQuery = useBudgetOverview();
  const deleteMutation = useDeleteBudget();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Budget | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = React.useState<Set<string>>(new Set());

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('budget.deleted'),
    onDelete: (id) => deleteMutation.mutateAsync(id),
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

  const namedRows = (overview?.budgets ?? []).filter((r) => !pendingDelete.has(r.id));
  // Les groupes d'abord, chacun suivi de ce qu'il totalise, puis les budgets
  // seuls. L'imbrication est **de l'affichage** : le serveur a déjà fait la
  // somme, le front ne recalcule rien — un total recalculé côté client finirait
  // par ne plus dire la même chose que le Contrôle.
  const childrenOf = React.useMemo(() => {
    const map = new Map<string, BudgetOverviewRow[]>();
    for (const row of namedRows) {
      if (!row.parent_id) continue;
      const siblings = map.get(row.parent_id) ?? [];
      siblings.push(row);
      map.set(row.parent_id, siblings);
    }
    return map;
  }, [namedRows]);
  const rootRows = namedRows.filter((r) => !r.parent_id);
  const nameById = new Map(namedRows.map((r) => [r.id, r.name]));
  const globalRow = overview?.global && !pendingDelete.has(overview.global.id) ? overview.global : null;
  const hasAnyBudget = Boolean(globalRow) || namedRows.length > 0;
  const allowGlobal = !globalRow;

  return (
    <>
      <div className="flex justify-end pb-4">
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
          <div className="space-y-5">
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

            {/* Named envelopes. */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">{t('budget.named.heading')}</h2>
              {namedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('budget.named.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {rootRows.map((row) => (
                    <div key={row.id} className="space-y-2">
                      <BudgetCard
                        row={row}
                        to={`/app/money/budgets/${row.id}`}
                        backState={pushBack(location)}
                        onEdit={() => openEdit(rowToBudget(row, false))}
                        onDelete={() => handleDelete(row.id)}
                      />
                      {(childrenOf.get(row.id) ?? []).length > 0 ? (
                        <div className="ml-4 space-y-2 border-l-2 border-border pl-3">
                          {(childrenOf.get(row.id) ?? []).map((child) => (
                            <BudgetCard
                              key={child.id}
                              row={child}
                              to={`/app/money/budgets/${child.id}`}
                              backState={pushBack(location)}
                              onEdit={() =>
                                openEdit(rowToBudget(child, false, nameById.get(row.id)))
                              }
                              onDelete={() => handleDelete(child.id)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
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
    </>
  );
}
