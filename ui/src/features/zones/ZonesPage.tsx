import * as React from 'react';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import ListPage from '@/components/ListPage';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useZones, useDeleteZone, zoneKeys, buildZoneTree } from './hooks';
import ZoneItem from './ZoneItem';
import ZoneDialog from './ZoneDialog';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import type { Zone } from '@/lib/api/zones';

export default function ZonesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data: zones = [], isLoading, error } = useZones();
  const deleteMutation = useDeleteZone();

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('zones.deleted'),
    onDelete: (id) => deleteMutation.mutateAsync(id),
  });

  const handleDelete = React.useCallback(
    (zone: Zone) => {
      deleteWithUndo(zone.id, {
        onRemove: () =>
          qc.setQueryData<Zone[]>(zoneKeys.list(), (old = []) =>
            old.filter((z) => z.id !== zone.id)
          ),
        onRestore: () => qc.invalidateQueries({ queryKey: zoneKeys.all }),
      });
    },
    [deleteWithUndo, qc]
  );

  const { sortedZones, depthMap } = React.useMemo(
    () => buildZoneTree(zones),
    [zones]
  );

  const isEmpty = !isLoading && !error && zones.length === 0;
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <>
      <ListPage
        title={t('zones.title')}
        isEmpty={isEmpty}
        emptyState={{
          icon: MapPin,
          title: t('zones.none'),
          description: t('zones.empty_description'),
          action: { label: t('zones.new'), onClick: () => setDialogOpen(true) },
        }}
        actions={
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t('zones.new')}
          </button>
        }
      >
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {t('zones.loadFailed')}
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: zoneKeys.all })}
              className="ml-2 underline hover:no-underline"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        {showSkeleton ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="space-y-2">
            {sortedZones.map((zone) => (
              <ZoneItem
                key={zone.id}
                zone={zone}
                depth={depthMap.get(zone.id) ?? 0}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : null}
      </ListPage>

      <ZoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
