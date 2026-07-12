import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';

import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import type { Tracker } from '@/lib/api/trackers';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useSessionState } from '@/lib/useSessionState';
import TrackerCard from './TrackerCard';
import TrackerDialog from './TrackerDialog';
import { useArchiveTracker, useCreateEntry, useTrackers } from './hooks';

type FilterKey = 'all' | 'general' | 'projects';
const FILTERS: FilterKey[] = ['all', 'general', 'projects'];

interface TrackersPanelProps {
  /** Embed mode: only this project's trackers, creation pre-linked to it. */
  projectId?: string;
  /** Isolates session-persisted UI state per context (e.g. per project). */
  stateKeyPrefix?: string;
}

export default function TrackersPanel({ projectId, stateKeyPrefix = 'trackers' }: TrackersPanelProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useSessionState<FilterKey>(
    `${stateKeyPrefix}.filter`,
    'all',
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Tracker | undefined>(undefined);
  const [hiddenIds, setHiddenIds] = React.useState<Set<string>>(new Set());

  const { data: trackers, isLoading, isError } = useTrackers(projectId);
  const createEntry = useCreateEntry();
  const archiveTracker = useArchiveTracker();
  const showSkeleton = useDelayedLoading(isLoading);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('trackers.deleted'),
    onDelete: (id) => archiveTracker.mutateAsync(id).then(() => undefined),
  });

  const handleDelete = (id: string) => {
    deleteWithUndo(id, {
      onRemove: () => setHiddenIds((prev) => new Set(prev).add(id)),
      onRestore: () =>
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    });
  };

  const handleQuickAdd = async (tracker: Tracker, value: string) => {
    await createEntry.mutateAsync({ tracker: tracker.id, value });
  };

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (tracker: Tracker) => {
    setEditing(tracker);
    setDialogOpen(true);
  };

  const visible = React.useMemo(() => {
    let items = (trackers ?? []).filter((tr) => !hiddenIds.has(tr.id));
    if (!projectId) {
      if (activeFilter === 'general') {
        items = items.filter((tr) => !tr.project);
      } else if (activeFilter === 'projects') {
        items = items.filter((tr) => Boolean(tr.project));
      }
    }
    return items;
  }, [trackers, hiddenIds, activeFilter, projectId]);

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-destructive">{t('trackers.loadFailed')}</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
        {!projectId ? (
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((key) => (
              <FilterPill
                key={key}
                active={activeFilter === key}
                onClick={() => setActiveFilter(key)}
              >
                {t(`trackers.filter.${key}`)}
              </FilterPill>
            ))}
          </div>
        ) : (
          <div />
        )}
        <Button size="sm" onClick={openCreate}>
          {t('trackers.new')}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title={t('trackers.empty')}
          description={t('trackers.emptyDescription')}
          action={{ label: t('trackers.new'), onClick: openCreate }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tracker) => (
            <TrackerCard
              key={tracker.id}
              tracker={tracker}
              onEdit={openEdit}
              onDelete={handleDelete}
              onQuickAdd={handleQuickAdd}
            />
          ))}
        </div>
      )}

      <TrackerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editing}
        defaultProjectId={projectId}
      />
    </div>
  );
}
