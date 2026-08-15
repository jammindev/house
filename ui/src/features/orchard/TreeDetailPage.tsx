import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import { TabShell, type TabConfig } from '@/components/TabShell';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import InfoField from '@/components/InfoField';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useNavigateBack } from '@/lib/backNavigation';
import { NON_HARVESTING_KINDS, type Harvest, type TreeEvent } from '@/lib/api/orchard';
import {
  orchardKeys,
  useDeleteHarvest,
  useDeleteTree,
  useDeleteTreeEvent,
  useHarvestSeries,
  useHarvests,
  useTree,
  useTreeEvents,
} from './hooks';
import { TreeStatusBadge } from './TreeCard';
import TreeDialog from './TreeDialog';
import TreeEventDialog from './TreeEventDialog';
import EventTimeline from './EventTimeline';
import HarvestDialog from './HarvestDialog';
import HarvestList from './HarvestList';
import SeasonSeries from './SeasonSeries';

type Tab = 'info' | 'events' | 'harvests';

export default function TreeDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigateBack = useNavigateBack('/app/orchard');

  const { data: tree, isLoading } = useTree(id);
  const { data: events = [] } = useTreeEvents({ tree: id });
  const { data: harvests = [] } = useHarvests({ tree: id });
  const { data: series } = useHarvestSeries({ tree: id });

  const [editOpen, setEditOpen] = React.useState(false);
  const [eventDialogOpen, setEventDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<TreeEvent | null>(null);
  const [harvestDialogOpen, setHarvestDialogOpen] = React.useState(false);
  const [editingHarvest, setEditingHarvest] = React.useState<Harvest | null>(null);

  const deleteTreeMutation = useDeleteTree();
  const deleteEventMutation = useDeleteTreeEvent();
  const deleteHarvestMutation = useDeleteHarvest();

  const { deleteWithUndo: deleteEventWithUndo } = useDeleteWithUndo({
    label: t('orchard.event.deleted'),
    onDelete: (eventId) => deleteEventMutation.mutateAsync(eventId),
  });
  const { deleteWithUndo: deleteHarvestWithUndo } = useDeleteWithUndo({
    label: t('orchard.harvest.deleted'),
    onDelete: (harvestId) => deleteHarvestMutation.mutateAsync(harvestId),
  });

  // Same optimistic dance as the list: remove from the exact key being read, put
  // it back on « Annuler ».
  const eventsKey = orchardKeys.events({ tree: id });
  const harvestsKey = orchardKeys.harvests({ tree: id });

  const handleDeleteEvent = React.useCallback(
    (eventId: string) => {
      const event = events.find((entry) => entry.id === eventId);
      if (!event) return;
      deleteEventWithUndo(eventId, {
        onRemove: () =>
          qc.setQueryData<TreeEvent[]>(eventsKey, (old) => old?.filter((e) => e.id !== eventId)),
        onRestore: () =>
          qc.setQueryData<TreeEvent[]>(eventsKey, (old) => (old ? [event, ...old] : [event])),
      });
    },
    [events, deleteEventWithUndo, qc, eventsKey],
  );

  const handleDeleteHarvest = React.useCallback(
    (harvestId: string) => {
      const harvest = harvests.find((entry) => entry.id === harvestId);
      if (!harvest) return;
      deleteHarvestWithUndo(harvestId, {
        onRemove: () =>
          qc.setQueryData<Harvest[]>(harvestsKey, (old) =>
            old?.filter((e) => e.id !== harvestId),
          ),
        onRestore: () =>
          qc.setQueryData<Harvest[]>(harvestsKey, (old) =>
            old ? [harvest, ...old] : [harvest],
          ),
      });
    },
    [harvests, deleteHarvestWithUndo, qc, harvestsKey],
  );

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

  if (!tree) return null;

  // An ornamental never yields — an empty harvest tab would promise something
  // the subject cannot deliver.
  const harvestsSupported = !NON_HARVESTING_KINDS.includes(tree.kind);

  const tabs: TabConfig<Tab>[] = [
    { key: 'info', label: t('orchard.tabs.info') },
    { key: 'events', label: t('orchard.tabs.events'), badge: events.length },
    ...(harvestsSupported
      ? [{ key: 'harvests' as const, label: t('orchard.tabs.harvests'), badge: harvests.length }]
      : []),
  ];

  return (
    <div>
      <BackLink fallback="/app/orchard" fallbackLabel={t('orchard.title')} />

      <PageHeader title={tree.name}>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          {t('common.edit')}
        </Button>
        <Button
          variant="outline"
          onClick={() => deleteTreeMutation.mutate(id, { onSuccess: () => navigateBack() })}
        >
          {t('common.delete')}
        </Button>
      </PageHeader>

      <TabShell tabs={tabs} sessionKey={`orchard.detail.${id}`} defaultTab="info">
        {(activeTab) => (
          <>
            {activeTab === 'info' ? (
              <div className="space-y-4">
                <Card className="p-4">
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoField label={t('orchard.fields.kind')}>
                      {t(`orchard.kind.${tree.kind}`)}
                    </InfoField>
                    <InfoField label={t('orchard.fields.zone')}>
                      {tree.zone_name ?? '—'}
                    </InfoField>
                    <InfoField label={t('orchard.fields.status')}>
                      <TreeStatusBadge status={tree.status} />
                    </InfoField>
                    <InfoField label={t('orchard.fields.species')}>
                      {tree.species || '—'}
                    </InfoField>
                    <InfoField label={t('orchard.fields.rootstock')}>
                      {tree.rootstock || '—'}
                    </InfoField>
                    <InfoField label={t('orchard.fields.plantedOn')}>
                      {tree.planted_on
                        ? `${tree.planted_on}${
                            tree.age_years !== null
                              ? ` · ${t('orchard.card.age', { count: tree.age_years })}`
                              : ''
                          }`
                        : t('orchard.fields.plantedUnknown')}
                    </InfoField>
                    <InfoField label={t('orchard.fields.flowering')}>
                      {tree.flowering_start_month && tree.flowering_end_month
                        ? `${t(`orchard.months.${tree.flowering_start_month}`)} → ${t(
                            `orchard.months.${tree.flowering_end_month}`,
                          )}`
                        : t('orchard.fields.floweringNotSet')}
                    </InfoField>
                  </dl>
                  {tree.notes ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                      {tree.notes}
                    </p>
                  ) : null}
                </Card>

                {/* « Le vide n'est pas une valeur » : an undeclared flowering
                    window means nobody filled it in, so the screen offers to —
                    it does not stay silent and let the frost alert never fire. */}
                {!tree.flowering_start_month ? (
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground">
                      {t('orchard.floweringPrompt')}
                    </p>
                    <Button className="mt-3" variant="outline" onClick={() => setEditOpen(true)}>
                      {t('orchard.floweringPromptAction')}
                    </Button>
                  </Card>
                ) : null}

                {harvestsSupported ? (
                  <SeasonSeries series={series} title={t('orchard.series.title')} />
                ) : null}
              </div>
            ) : null}

            {activeTab === 'events' ? (
              <div className="space-y-4">
                <Button
                  onClick={() => {
                    setEditingEvent(null);
                    setEventDialogOpen(true);
                  }}
                >
                  {t('orchard.event.new')}
                </Button>
                {events.length ? (
                  <EventTimeline
                    events={events}
                    onEdit={(event) => {
                      setEditingEvent(event);
                      setEventDialogOpen(true);
                    }}
                    onDelete={handleDeleteEvent}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('orchard.journal.empty')}</p>
                )}
              </div>
            ) : null}

            {activeTab === 'harvests' ? (
              <div className="space-y-4">
                <Button
                  onClick={() => {
                    setEditingHarvest(null);
                    setHarvestDialogOpen(true);
                  }}
                >
                  {t('orchard.harvest.new')}
                </Button>
                <SeasonSeries series={series} title={t('orchard.series.title')} />
                {harvests.length ? (
                  <HarvestList
                    harvests={harvests}
                    onEdit={(harvest) => {
                      setEditingHarvest(harvest);
                      setHarvestDialogOpen(true);
                    }}
                    onDelete={handleDeleteHarvest}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('orchard.harvest.empty')}</p>
                )}
              </div>
            ) : null}
          </>
        )}
      </TabShell>

      <TreeDialog open={editOpen} onOpenChange={setEditOpen} existing={tree} />
      <TreeEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        existing={editingEvent ?? undefined}
        trees={[tree]}
        defaultTreeId={tree.id}
      />
      <HarvestDialog
        open={harvestDialogOpen}
        onOpenChange={setHarvestDialogOpen}
        existing={editingHarvest ?? undefined}
        treeId={tree.id}
      />
    </div>
  );
}
