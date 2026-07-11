import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import EntityAssistant from '@/features/agent/EntityAssistant';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useNavigateBack } from '@/lib/backNavigation';
import type { ChickenEvent } from '@/lib/api/chickens';
import {
  chickenKeys,
  useChicken,
  useChickenEvents,
  useDeleteChicken,
  useDeleteChickenEvent,
} from './hooks';
import { ChickenStatusBadge } from './ChickenCard';
import ChickenDialog from './ChickenDialog';
import ChickenEventDialog from './ChickenEventDialog';
import ChickenPurchaseDialog from './ChickenPurchaseDialog';
import EventTimeline from './EventTimeline';

export default function ChickenDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigateBack = useNavigateBack('/app/chickens');

  const { data: chicken, isLoading } = useChicken(id);
  const { data: events = [] } = useChickenEvents({ chicken: id });

  const [editOpen, setEditOpen] = React.useState(false);
  const [eventDialogOpen, setEventDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<ChickenEvent | null>(null);
  const [purchaseOpen, setPurchaseOpen] = React.useState(false);

  const deleteChickenMutation = useDeleteChicken();
  const deleteEventMutation = useDeleteChickenEvent();

  const { deleteWithUndo: deleteEventWithUndo } = useDeleteWithUndo({
    label: t('chickens.events.deleted'),
    onDelete: (eventId) => deleteEventMutation.mutateAsync(eventId),
  });

  const handleDeleteEvent = React.useCallback(
    (eventId: string) => {
      const event = events.find((entry) => entry.id === eventId);
      if (!event) return;
      deleteEventWithUndo(eventId, {
        onRemove: () =>
          qc.setQueryData<ChickenEvent[]>(chickenKeys.events({ chicken: id }), (old) =>
            old?.filter((entry) => entry.id !== eventId),
          ),
        onRestore: () =>
          qc.setQueryData<ChickenEvent[]>(chickenKeys.events({ chicken: id }), (old) =>
            old ? [event, ...old] : [event],
          ),
      });
    },
    [events, deleteEventWithUndo, qc, id],
  );

  function handleDeleteChicken() {
    deleteChickenMutation.mutate(id, { onSuccess: () => navigateBack() });
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
  if (!chicken) {
    return (
      <div className="space-y-4">
        <BackLink fallback="/app/chickens" fallbackLabel={t('chickens.title')} />
        <p className="text-sm text-muted-foreground">{t('chickens.not_found')}</p>
      </div>
    );
  }

  const facts: Array<{ label: string; value: string | null }> = [
    { label: t('chickens.fields.breed'), value: chicken.breed || null },
    { label: t('chickens.fields.color'), value: chicken.color || null },
    { label: t('chickens.fields.hatched_on'), value: chicken.hatched_on },
    { label: t('chickens.fields.acquired_on'), value: chicken.acquired_on },
    { label: t('chickens.fields.zone'), value: chicken.zone_name },
  ];

  return (
    <div>
      <div className="mb-4">
        <BackLink fallback="/app/chickens" fallbackLabel={t('chickens.title')} />
      </div>

      <PageHeader title={`🐔 ${chicken.name}`}>
        <Button variant="outline" onClick={() => setPurchaseOpen(true)}>
          {t('chickens.purchase.action')}
        </Button>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          {t('common.edit')}
        </Button>
        <Button variant="destructive" onClick={handleDeleteChicken} disabled={deleteChickenMutation.isPending}>
          {t('common.delete')}
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <ChickenStatusBadge status={chicken.status} />
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {facts
              .filter((fact) => fact.value)
              .map((fact) => (
                <div key={fact.label} className="flex items-baseline justify-between gap-3 sm:justify-start">
                  <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                  <dd className="text-sm text-foreground">{fact.value}</dd>
                </div>
              ))}
          </dl>
          {chicken.notes ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{chicken.notes}</p>
          ) : null}
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{t('chickens.events.title')}</h2>
          <Button variant="outline" size="sm" onClick={() => setEventDialogOpen(true)}>
            {t('chickens.events.actions.new')}
          </Button>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('chickens.events.empty')}</p>
        ) : (
          <EventTimeline
            events={events}
            onEdit={(event) => {
              setEditingEvent(event);
              setEventDialogOpen(true);
            }}
            onDelete={handleDeleteEvent}
          />
        )}

        <EntityAssistant entityType="chicken" objectId={chicken.id} />
      </div>

      <ChickenDialog open={editOpen} onOpenChange={setEditOpen} existing={chicken} />
      <ChickenEventDialog
        open={eventDialogOpen}
        onOpenChange={(open) => {
          setEventDialogOpen(open);
          if (!open) setEditingEvent(null);
        }}
        existing={editingEvent ?? undefined}
        chicken={editingEvent ? null : chicken}
      />
      <ChickenPurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} chicken={chicken} />
    </div>
  );
}
