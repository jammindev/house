import * as React from 'react';
import { Plus, CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useToast } from '@/lib/toast';
import { deleteInteraction } from '@/lib/api/interactions';
import { updateRecurringExpense, type RecurringExpense } from '@/lib/api/budget';
import {
  useCashflowProjection,
  useConfirmRecurringOccurrence,
  useDeleteRecurringExpense,
  useRecurringDue,
  useRecurringExpenses,
} from './hooks';
import RecurringCard from './RecurringCard';
import RecurringExpenseDialog from './RecurringExpenseDialog';
import ConfirmOccurrenceDialog from './ConfirmOccurrenceDialog';
import { formatAmount } from './format';

export default function RecurringPage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const listQuery = useRecurringExpenses();
  const dueQuery = useRecurringDue();
  const projectionQuery = useCashflowProjection();
  const deleteMutation = useDeleteRecurringExpense();
  const confirmMutation = useConfirmRecurringOccurrence();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RecurringExpense | undefined>(undefined);
  const [confirmTarget, setConfirmTarget] = React.useState<RecurringExpense | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Set<string>>(new Set());

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('recurring.deleted'),
    onDelete: (id) => deleteMutation.mutateAsync(id),
  });

  const showSkeleton = useDelayedLoading(listQuery.isLoading);
  const all = (listQuery.data ?? []).filter((r) => !pendingDelete.has(r.id));
  const dueIds = new Set((dueQuery.data ?? []).map((r) => r.id));
  const due = all.filter((r) => dueIds.has(r.id));
  const upcoming = all.filter((r) => !dueIds.has(r.id));
  const projection = projectionQuery.data;

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }
  function openEdit(rec: RecurringExpense) {
    setEditing(rec);
    setDialogOpen(true);
  }
  function handleDelete(id: string) {
    deleteWithUndo(id, {
      onRemove: () => setPendingDelete((p) => new Set(p).add(id)),
      onRestore: () =>
        setPendingDelete((p) => {
          const next = new Set(p);
          next.delete(id);
          return next;
        }),
    });
  }

  async function handleConfirm(amount: number) {
    const rec = confirmTarget;
    if (!rec) return;
    const previousDueDate = rec.next_due_date;
    try {
      const result = await confirmMutation.mutateAsync({ id: rec.id, amount });
      setConfirmTarget(null);
      // Post-hoc undo: delete the created expense + restore the schedule.
      toast({
        title: t('recurring.confirmed', { label: rec.label }),
        duration: 8000,
        action: {
          label: t('common.undo'),
          onClick: () => {
            void Promise.all([
              deleteInteraction(result.interaction_id),
              updateRecurringExpense(rec.id, { next_due_date: previousDueDate }),
            ]).finally(() => {
              void listQuery.refetch();
              void dueQuery.refetch();
              void projectionQuery.refetch();
            });
          },
        },
      });
    } catch {
      toast({ description: t('common.saveFailed'), variant: 'destructive' });
    }
  }

  const isEmpty = all.length === 0;

  return (
    <>
      <BackLink fallback="/app/budget" fallbackLabel={t('budget.title')} />
      <PageHeader title={t('recurring.title')} description={t('recurring.description')}>
        <Button type="button" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t('recurring.new.action')}
        </Button>
      </PageHeader>

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : null}

      {!listQuery.isLoading ? (
        isEmpty ? (
          <EmptyState
            icon={CalendarClock}
            title={t('recurring.empty')}
            description={t('recurring.emptyDescription')}
            action={{ label: t('recurring.new.action'), onClick: openCreate }}
          />
        ) : (
          <div className="space-y-5">
            {/* Treasury projection */}
            {projection && projection.horizons.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {projection.horizons.map((h) => (
                  <Card key={h.days} className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('recurring.projection.horizon', { days: h.days })}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">{formatAmount(h.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('recurring.projection.count', { count: h.count })}
                    </p>
                  </Card>
                ))}
              </div>
            ) : null}

            {/* Due now — confirmable */}
            {due.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {t('recurring.due.heading', { count: due.length })}
                </h2>
                <div className="space-y-2">
                  {due.map((rec) => (
                    <RecurringCard
                      key={rec.id}
                      recurring={rec}
                      isDue
                      onEdit={() => openEdit(rec)}
                      onDelete={() => handleDelete(rec.id)}
                      onConfirm={() => setConfirmTarget(rec)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Upcoming */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">{t('recurring.upcoming.heading')}</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('recurring.upcoming.empty')}</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((rec) => (
                    <RecurringCard
                      key={rec.id}
                      recurring={rec}
                      isDue={false}
                      onEdit={() => openEdit(rec)}
                      onDelete={() => handleDelete(rec.id)}
                      onConfirm={() => setConfirmTarget(rec)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      ) : null}

      <RecurringExpenseDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />
      <ConfirmOccurrenceDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(v) => !v && setConfirmTarget(null)}
        recurring={confirmTarget}
        onConfirm={handleConfirm}
        isPending={confirmMutation.isPending}
      />
    </>
  );
}
