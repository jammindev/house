import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import { FolderKanban, Link2, Pencil, Plus, Trash2 } from 'lucide-react';

import BackLink from '@/components/BackLink';
import CardActions, { type CardAction } from '@/components/CardActions';
import PageHeader from '@/components/PageHeader';
import Sparkline from '@/components/Sparkline';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import {
  formatTrackerValue,
  type Tracker,
  type TrackerEntry,
} from '@/lib/api/trackers';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import EntityAssistant from '@/features/agent/EntityAssistant';
import EntryDialog from './EntryDialog';
import TrackerDialog from './TrackerDialog';
import { useDeleteEntry, useTracker, useTrackerEntries } from './hooks';

function formatEntryDate(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function EntryRow({
  entry,
  previous,
  tracker,
  onEdit,
  onDelete,
}: {
  entry: TrackerEntry;
  previous: TrackerEntry | null;
  tracker: Tracker;
  onEdit: (entry: TrackerEntry) => void;
  onDelete: (entryId: string) => void;
}) {
  const { t, i18n } = useTranslation();

  const delta = previous != null ? Number(entry.value) - Number(previous.value) : null;
  const deltaText =
    delta != null && !Number.isNaN(delta)
      ? `${delta >= 0 ? '+' : ''}${Number(delta.toFixed(3))}`
      : null;

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(entry) },
    {
      label: t('common.delete'),
      icon: Trash2,
      onClick: () => onDelete(entry.id),
      variant: 'danger',
    },
  ];

  return (
    <div className="flex items-start justify-between gap-2 border-b border-border py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-foreground">
            {formatTrackerValue(entry.value)}
            {tracker.unit ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {tracker.unit}
              </span>
            ) : null}
          </span>
          {deltaText ? (
            <span className="text-xs text-muted-foreground">({deltaText})</span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatEntryDate(entry.occurred_at, i18n.language)}
          </span>
        </div>
        {entry.note ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.note}</p>
        ) : null}
      </div>
      <CardActions actions={actions} />
    </div>
  );
}

export default function TrackerDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const location = useLocation();

  const { data: tracker, isLoading, isError } = useTracker(id);
  const { data: entries } = useTrackerEntries(id);
  const showSkeleton = useDelayedLoading(isLoading);
  const deleteEntry = useDeleteEntry();

  const [editOpen, setEditOpen] = React.useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<TrackerEntry | undefined>(undefined);
  const [hiddenEntryIds, setHiddenEntryIds] = React.useState<Set<string>>(new Set());

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('trackers.entryDeleted'),
    onDelete: (entryId) => deleteEntry.mutateAsync(entryId).then(() => undefined),
  });

  const handleDeleteEntry = (entryId: string) => {
    deleteWithUndo(entryId, {
      onRemove: () => setHiddenEntryIds((prev) => new Set(prev).add(entryId)),
      onRestore: () =>
        setHiddenEntryIds((prev) => {
          const next = new Set(prev);
          next.delete(entryId);
          return next;
        }),
    });
  };

  const openNewEntry = () => {
    setEditingEntry(undefined);
    setEntryDialogOpen(true);
  };

  const openEditEntry = (entry: TrackerEntry) => {
    setEditingEntry(entry);
    setEntryDialogOpen(true);
  };

  // Entries arrive newest-first; hide optimistically-deleted ones.
  const visibleEntries = (entries ?? []).filter((e) => !hiddenEntryIds.has(e.id));
  const sparkPoints = visibleEntries
    .slice()
    .reverse()
    .map((e) => ({ t: e.occurred_at, v: Number(e.value) }));

  if (showSkeleton) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (isError || (!isLoading && !tracker)) {
    return (
      <div className="space-y-3">
        <BackLink fallback="/app/trackers" fallbackLabel={t('trackers.title')} />
        <p className="text-sm text-destructive">{t('trackers.loadFailed')}</p>
      </div>
    );
  }
  if (!tracker) return null;

  return (
    <div>
      <BackLink fallback="/app/trackers" fallbackLabel={t('trackers.title')} />

      <PageHeader
        title={`${tracker.emoji ? `${tracker.emoji} ` : ''}${tracker.name}${tracker.unit ? ` (${tracker.unit})` : ''}`}
        description={tracker.description || undefined}
      >
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          {t('common.edit')}
        </Button>
        <Button size="sm" onClick={openNewEntry}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('trackers.addValue')}
        </Button>
      </PageHeader>

      {tracker.project || tracker.target_url ? (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {tracker.project && tracker.project_title ? (
            <Link
              to={`/app/projects/${tracker.project}`}
              state={pushBack(location)}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              {tracker.project_title}
            </Link>
          ) : null}
          {tracker.target_url && tracker.target_label ? (
            <Link
              to={tracker.target_url}
              state={pushBack(location)}
              className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
            >
              <Link2 className="h-3.5 w-3.5" />
              {tracker.target_label}
            </Link>
          ) : null}
        </div>
      ) : null}

      {sparkPoints.length > 1 ? (
        <Card className="mb-4 p-4">
          <span className="block text-primary">
            <Sparkline
              points={sparkPoints}
              width={600}
              height={120}
              strokeWidth={2}
              className="h-auto w-full"
            />
          </span>
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-medium text-foreground">
          {t('trackers.entriesTitle')}
        </h2>
        {visibleEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('trackers.noEntries')}</p>
        ) : (
          <div>
            {visibleEntries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                previous={visibleEntries[index + 1] ?? null}
                tracker={tracker}
                onEdit={openEditEntry}
                onDelete={handleDeleteEntry}
              />
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4">
        <EntityAssistant entityType="tracker" objectId={tracker.id} />
      </div>

      <TrackerDialog open={editOpen} onOpenChange={setEditOpen} existing={tracker} />
      <EntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        tracker={tracker}
        existing={editingEntry}
      />
    </div>
  );
}
