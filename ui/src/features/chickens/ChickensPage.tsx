import * as React from 'react';
import { Bird } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import type { Chicken, ChickenEvent } from '@/lib/api/chickens';
import {
  chickenKeys,
  useChickenEvents,
  useChickens,
  useDeleteChicken,
  useDeleteChickenEvent,
  useFlockSummary,
} from './hooks';
import ChickenCard from './ChickenCard';
import ChickenDialog from './ChickenDialog';
import ChickenEventDialog from './ChickenEventDialog';
import EggLogBanner from './EggLogBanner';
import EggStatsSection from './EggStatsSection';
import EventTimeline from './EventTimeline';
import FeedCard from './FeedCard';

type FilterKey = 'flock' | 'all' | 'history';

const FILTERS: FilterKey[] = ['flock', 'all', 'history'];
const HISTORY_STATUSES = ['deceased', 'gone'];
const RECENT_EVENTS_SHOWN = 6;

export default function ChickensPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [activeFilter, setActiveFilter] = useSessionState<FilterKey>('chickens.filter', 'flock');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingChicken, setEditingChicken] = React.useState<Chicken | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<ChickenEvent | null>(null);

  const { data: chickens = [], isLoading } = useChickens();
  const { data: events = [] } = useChickenEvents();
  const { data: summary } = useFlockSummary();

  const deleteChickenMutation = useDeleteChicken();
  const deleteEventMutation = useDeleteChickenEvent();

  const visibleChickens = React.useMemo(() => {
    if (activeFilter === 'all') return chickens;
    if (activeFilter === 'history') return chickens.filter((hen) => HISTORY_STATUSES.includes(hen.status));
    return chickens.filter((hen) => !HISTORY_STATUSES.includes(hen.status));
  }, [chickens, activeFilter]);

  const { deleteWithUndo: deleteChickenWithUndo } = useDeleteWithUndo({
    label: t('chickens.deleted'),
    onDelete: (id) => deleteChickenMutation.mutateAsync(id),
  });
  const { deleteWithUndo: deleteEventWithUndo } = useDeleteWithUndo({
    label: t('chickens.events.deleted'),
    onDelete: (id) => deleteEventMutation.mutateAsync(id),
  });

  const handleDeleteChicken = React.useCallback(
    (id: string) => {
      const chicken = chickens.find((hen) => hen.id === id);
      if (!chicken) return;
      deleteChickenWithUndo(id, {
        onRemove: () =>
          qc.setQueryData<Chicken[]>(chickenKeys.list({}), (old) => old?.filter((hen) => hen.id !== id)),
        onRestore: () =>
          qc.setQueryData<Chicken[]>(chickenKeys.list({}), (old) => (old ? [...old, chicken] : [chicken])),
      });
    },
    [chickens, deleteChickenWithUndo, qc],
  );

  const handleDeleteEvent = React.useCallback(
    (id: string) => {
      const event = events.find((entry) => entry.id === id);
      if (!event) return;
      deleteEventWithUndo(id, {
        onRemove: () =>
          qc.setQueryData<ChickenEvent[]>(chickenKeys.events({}), (old) =>
            old?.filter((entry) => entry.id !== id),
          ),
        onRestore: () =>
          qc.setQueryData<ChickenEvent[]>(chickenKeys.events({}), (old) =>
            old ? [event, ...old] : [event],
          ),
      });
    },
    [events, deleteEventWithUndo, qc],
  );

  const showSkeleton = useDelayedLoading(isLoading);
  const isEmpty = !isLoading && chickens.length === 0;
  const cost = summary?.cost;

  return (
    <div>
      <PageHeader title={t('chickens.title')} description={t('chickens.description')}>
        <Button variant="outline" onClick={() => setEventDialogOpen(true)}>
          {t('chickens.events.actions.new')}
        </Button>
        <Button onClick={() => setDialogOpen(true)}>{t('chickens.actions.new')}</Button>
      </PageHeader>

      <div className="space-y-4">
        <EggLogBanner />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EggStatsSection />
          <FeedCard />
          {cost && cost.per_egg ? (
            <Card className="p-4">
              <CardTitle className="text-sm text-muted-foreground">
                {`💶 ${t('chickens.cost.title')}`}
              </CardTitle>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {t('chickens.cost.per_egg', { amount: cost.per_egg })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('chickens.cost.totals', { total: cost.total, year: cost.year })}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5 pb-1">
          {FILTERS.map((filter) => (
            <FilterPill
              key={filter}
              active={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            >
              {t(`chickens.filters.${filter}`)}
            </FilterPill>
          ))}
        </div>

        {showSkeleton ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : null}

        {isEmpty ? (
          <EmptyState
            icon={Bird}
            title={t('chickens.empty.title')}
            description={t('chickens.empty.description')}
            action={{ label: t('chickens.actions.new'), onClick: () => setDialogOpen(true) }}
          />
        ) : null}

        {!isLoading && !isEmpty ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleChickens.map((chicken) => (
              <ChickenCard
                key={chicken.id}
                chicken={chicken}
                onEdit={setEditingChicken}
                onDelete={handleDeleteChicken}
              />
            ))}
            {visibleChickens.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('chickens.empty.filtered')}</p>
            ) : null}
          </div>
        ) : null}

        {events.length > 0 ? (
          <div className="space-y-2 pt-2">
            <h2 className="text-sm font-semibold text-foreground">{t('chickens.events.recent_title')}</h2>
            <EventTimeline
              events={events.slice(0, RECENT_EVENTS_SHOWN)}
              showChicken
              onEdit={(event) => {
                setEditingEvent(event);
                setEventDialogOpen(true);
              }}
              onDelete={handleDeleteEvent}
            />
          </div>
        ) : null}
      </div>

      <ChickenDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <ChickenDialog
        open={editingChicken !== null}
        onOpenChange={(open) => { if (!open) setEditingChicken(null); }}
        existing={editingChicken ?? undefined}
      />
      <ChickenEventDialog
        open={eventDialogOpen}
        onOpenChange={(open) => {
          setEventDialogOpen(open);
          if (!open) setEditingEvent(null);
        }}
        existing={editingEvent ?? undefined}
        chickens={chickens}
      />
    </div>
  );
}
