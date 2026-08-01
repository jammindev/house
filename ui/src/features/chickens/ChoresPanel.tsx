import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Pause, Pencil, Play, Trash2 } from 'lucide-react';

import CardActions, { type CardAction } from '@/components/CardActions';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import type { ChickenChore } from '@/lib/api/chickens';

import ChoreDialog from './ChoreDialog';
import { useChores, useCompleteChore, useDeleteChore, useUpdateChore } from './hooks';

/**
 * The recurring coop chores: what comes round, and what is late.
 *
 * The "late" verdict is the server's (`status.is_due`) and is never recomputed
 * here — the reminder notification and the dashboard alert read the same one,
 * and a panel that disagreed with the notification would discredit both.
 * Ordering *by* those server dates is a different matter, and is done here so
 * the most urgent chore is the first one read.
 *
 * Paused chores are fetched too (`active: false` means "include the paused"),
 * and listed last. Hiding them would make "Resume" unreachable: pausing would
 * be a one-way door out of the panel.
 */
export default function ChoresPanel() {
  const { t } = useTranslation();
  const { data: chores = [], isLoading } = useChores({ active: false });
  const completeMutation = useCompleteChore();
  const updateMutation = useUpdateChore();
  const deleteMutation = useDeleteChore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ChickenChore | undefined>(undefined);
  const [hidden, setHidden] = React.useState<string[]>([]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('chickens.chores.deleted'),
    onDelete: (id: string) => deleteMutation.mutateAsync(id),
  });

  const visible = React.useMemo(
    () =>
      chores
        .filter((chore) => !hidden.includes(chore.id))
        // Active first, then soonest due. Sorting on dates the server computed
        // is not a second opinion on them — it is reading order.
        .sort((a, b) => {
          if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
          return a.status.next_due_on.localeCompare(b.status.next_due_on);
        }),
    [chores, hidden],
  );

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (chore: ChickenChore) => {
    setEditing(chore);
    setDialogOpen(true);
  };

  const actionsFor = (chore: ChickenChore): CardAction[] => [
    { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(chore) },
    {
      label: chore.is_active ? t('chickens.chores.actions.pause') : t('chickens.chores.actions.resume'),
      icon: chore.is_active ? Pause : Play,
      onClick: () =>
        updateMutation.mutate({ id: chore.id, payload: { is_active: !chore.is_active } }),
    },
    {
      label: t('common.delete'),
      icon: Trash2,
      variant: 'danger',
      onClick: () =>
        deleteWithUndo(chore.id, {
          onRemove: () => setHidden((prev) => [...prev, chore.id]),
          onRestore: () => setHidden((prev) => prev.filter((id) => id !== chore.id)),
        }),
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t('chickens.chores.title')}</h2>
        <Button variant="outline" size="sm" onClick={openCreate}>
          {t('chickens.chores.actions.new')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{t('chickens.chores.empty')}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((chore) => (
            <ChoreRow
              key={chore.id}
              chore={chore}
              actions={actionsFor(chore)}
              onComplete={() => completeMutation.mutate({ id: chore.id })}
              isCompleting={completeMutation.isPending}
            />
          ))}
        </div>
      )}

      <ChoreDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />
    </div>
  );
}

function ChoreRow({
  chore,
  actions,
  onComplete,
  isCompleting,
}: {
  chore: ChickenChore;
  actions: CardAction[];
  onComplete: () => void;
  isCompleting: boolean;
}) {
  const { t } = useTranslation();
  const { status } = chore;

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{chore.emoji ? `${chore.emoji} ${chore.name}` : chore.name}</CardTitle>
            <DueBadge chore={chore} />
            {!chore.is_active ? (
              <Badge variant="outline">{t('chickens.chores.paused')}</Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('chickens.chores.cadence', { count: chore.interval_days })}
            {' · '}
            {status.never_done
              ? t('chickens.chores.never_done')
              : t('chickens.chores.last_done', { date: status.last_done_on })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" onClick={onComplete} disabled={isCompleting}>
            <Check className="mr-1 h-4 w-4" />
            {t('chickens.chores.actions.done')}
          </Button>
          <CardActions actions={actions} />
        </div>
      </div>
    </Card>
  );
}

function DueBadge({ chore }: { chore: ChickenChore }) {
  const { t } = useTranslation();
  const { status } = chore;

  // A paused chore has no verdict to give: it was taken out of the cadence on
  // purpose, so showing it late would be reporting on a promise nobody made.
  if (!chore.is_active || !status.is_due) return null;

  if (status.days_overdue === 0) {
    return <Badge variant="secondary">{t('chickens.chores.due_today')}</Badge>;
  }
  return (
    <Badge variant="destructive">
      {t('chickens.chores.overdue', { count: status.days_overdue })}
    </Badge>
  );
}
