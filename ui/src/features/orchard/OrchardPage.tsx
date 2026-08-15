import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TreeDeciduous } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import { useZones } from '@/features/zones/hooks';
import type { Tree, TreeEvent } from '@/lib/api/orchard';
import {
  orchardKeys,
  useDeleteTree,
  useDeleteTreeEvent,
  useHarvestSeries,
  useTreeEvents,
  useTrees,
} from './hooks';
import TreeCard from './TreeCard';
import TreeDialog from './TreeDialog';
import TreeEventDialog from './TreeEventDialog';
import EventTimeline from './EventTimeline';
import { formatTotals } from './format';

type FilterKey = 'living' | 'all' | 'gone';

const FILTERS: FilterKey[] = ['living', 'all', 'gone'];
const RECENT_EVENTS_SHOWN = 6;

/** Query params per filter — the server owns « what is still standing ». */
const FILTER_PARAMS: Record<FilterKey, { status?: string }> = {
  living: {},
  all: { status: 'all' },
  gone: { status: 'dead,removed' },
};

export default function OrchardPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [activeFilter, setActiveFilter] = useSessionState<FilterKey>('orchard.filter', 'living');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTree, setEditingTree] = React.useState<Tree | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<TreeEvent | null>(null);

  const { data: trees = [], isLoading } = useTrees(FILTER_PARAMS[activeFilter]);
  const { data: allTrees = [] } = useTrees({ status: 'all' });
  const { data: events = [] } = useTreeEvents();
  const { data: series } = useHarvestSeries({ seasons: 1 });
  const { data: zones = [] } = useZones();

  const deleteTreeMutation = useDeleteTree();
  const deleteEventMutation = useDeleteTreeEvent();

  const { deleteWithUndo: deleteTreeWithUndo } = useDeleteWithUndo({
    label: t('orchard.deleted'),
    onDelete: (id) => deleteTreeMutation.mutateAsync(id),
  });
  const { deleteWithUndo: deleteEventWithUndo } = useDeleteWithUndo({
    label: t('orchard.event.deleted'),
    onDelete: (id) => deleteEventMutation.mutateAsync(id),
  });

  // Undo needs the row gone from the screen *before* the network call — that is
  // what makes « Annuler » feel like nothing happened. The cache write targets the
  // exact key the list is reading, filter included.
  const treesKey = orchardKeys.list(FILTER_PARAMS[activeFilter]);
  const eventsKey = orchardKeys.events({});

  const handleDeleteTree = React.useCallback(
    (id: string) => {
      const tree = trees.find((entry) => entry.id === id);
      if (!tree) return;
      deleteTreeWithUndo(id, {
        onRemove: () =>
          qc.setQueryData<Tree[]>(treesKey, (old) => old?.filter((e) => e.id !== id)),
        onRestore: () =>
          qc.setQueryData<Tree[]>(treesKey, (old) => (old ? [tree, ...old] : [tree])),
      });
    },
    [trees, deleteTreeWithUndo, qc, treesKey],
  );

  const handleDeleteEvent = React.useCallback(
    (id: string) => {
      const event = events.find((entry) => entry.id === id);
      if (!event) return;
      deleteEventWithUndo(id, {
        onRemove: () =>
          qc.setQueryData<TreeEvent[]>(eventsKey, (old) => old?.filter((e) => e.id !== id)),
        onRestore: () =>
          qc.setQueryData<TreeEvent[]>(eventsKey, (old) => (old ? [event, ...old] : [event])),
      });
    },
    [events, deleteEventWithUndo, qc, eventsKey],
  );

  // The orchard reads by place — a household walks its garden, it does not scan
  // an alphabetical list.
  const byZone = React.useMemo(() => {
    const groups = new Map<string, { name: string; trees: Tree[] }>();
    for (const tree of trees) {
      const key = tree.zone;
      if (!groups.has(key)) {
        groups.set(key, { name: tree.zone_name ?? t('zones.noZone'), trees: [] });
      }
      groups.get(key)!.trees.push(tree);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [trees, t]);

  const currentSeason = series?.seasons.find((s) => s.season === series.current_season);

  function handleEdit(tree: Tree) {
    setEditingTree(tree);
    setDialogOpen(true);
  }

  function handleNew() {
    setEditingTree(null);
    setDialogOpen(true);
  }

  const showSkeleton = useDelayedLoading(isLoading);
  if (showSkeleton) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const isEmpty = !trees.length && activeFilter === 'living';

  return (
    <div>
      <PageHeader title={t('orchard.title')}>
        <Button onClick={handleNew}>{t('orchard.new')}</Button>
      </PageHeader>

      {currentSeason ? (
        <Card className="mb-4 p-4">
          <CardTitle>
            {t('orchard.series.seasonTitle', { season: series?.current_season })}
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatTotals(currentSeason.totals, (unit) => t(`orchard.unit.${unit}`))}
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-1.5 pb-4">
        {FILTERS.map((key) => (
          <FilterPill
            key={key}
            active={activeFilter === key}
            onClick={() => setActiveFilter(key)}
          >
            {t(`orchard.filters.${key}`)}
          </FilterPill>
        ))}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={TreeDeciduous}
          title={t('orchard.empty.title')}
          description={
            zones.length ? t('orchard.empty.description') : t('orchard.empty.noZone')
          }
          /* No zone, no subject: the zone is a required FK, so offering « add a
             subject » here would open a form that cannot be submitted. Send the
             household where the missing piece is instead. */
          action={
            zones.length
              ? { label: t('orchard.new'), onClick: handleNew }
              : { label: t('orchard.empty.createZone'), href: '/app/zones' }
          }
        />
      ) : (
        <div className="space-y-6">
          {byZone.map((group) => (
            <section key={group.name}>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">{group.name}</h2>
              <div className="space-y-2">
                {group.trees.map((tree) => (
                  <TreeCard
                    key={tree.id}
                    tree={tree}
                    onEdit={handleEdit}
                    onDelete={handleDeleteTree}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {allTrees.length ? (
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('orchard.journal.title')}
            </h2>
            <Button
              variant="outline"
              onClick={() => {
                setEditingEvent(null);
                setEventDialogOpen(true);
              }}
            >
              {t('orchard.event.new')}
            </Button>
          </div>
          {events.length ? (
            <EventTimeline
              events={events.slice(0, RECENT_EVENTS_SHOWN)}
              showTree
              onEdit={(event) => {
                setEditingEvent(event);
                setEventDialogOpen(true);
              }}
              onDelete={handleDeleteEvent}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('orchard.journal.empty')}</p>
          )}
        </section>
      ) : null}

      <TreeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editingTree ?? undefined}
      />
      <TreeEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        existing={editingEvent ?? undefined}
        trees={allTrees}
      />
    </div>
  );
}
