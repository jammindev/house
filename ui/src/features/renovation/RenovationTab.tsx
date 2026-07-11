import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Paintbrush, Plus } from 'lucide-react';
import { Button } from '@/design-system/button';
import EmptyState from '@/components/EmptyState';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { deleteInteraction, type InteractionListItem } from '@/lib/api/interactions';
import { useRenovationEntries, renovationKeys } from './hooks';
import RenovationCard from './RenovationCard';
import RenovationDialog from './RenovationDialog';

export default function RenovationTab({ zoneId }: { zoneId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useRenovationEntries(zoneId);
  const entries = data?.items ?? [];

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InteractionListItem | undefined>(undefined);
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(new Set());

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('renovation.deleted'),
    onDelete: (id) =>
      deleteInteraction(id).then(() => {
        void qc.invalidateQueries({ queryKey: renovationKeys.all });
        void qc.invalidateQueries({ queryKey: ['zones'] });
        void qc.invalidateQueries({ queryKey: ['interactions'] });
      }),
  });

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(entry: InteractionListItem) {
    setEditing(entry);
    setDialogOpen(true);
  }

  function handleDelete(entry: InteractionListItem) {
    deleteWithUndo(entry.id, {
      onRemove: () => setHiddenIds((prev) => new Set(prev).add(entry.id)),
      onRestore: () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        }),
    });
  }

  const visible = entries.filter((entry) => !hiddenIds.has(entry.id));
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          {t('renovation.add')}
        </Button>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Paintbrush}
          title={t('renovation.empty.title')}
          description={t('renovation.empty.description')}
          action={{ label: t('renovation.add'), onClick: openCreate }}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((entry) => (
            <RenovationCard
              key={entry.id}
              entry={entry}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <RenovationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        zoneId={zoneId}
        existing={editing}
      />
    </div>
  );
}
