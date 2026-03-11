import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHouseholdId } from '@/lib/useHouseholdId';
import PageHeader from '@/components/PageHeader';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { SheetDialog } from '@/design-system/sheet-dialog';

import ZoneForm from './components/ZoneForm';
import ZoneList from './components/ZoneList';
import { useZones } from './hooks/useZones';
import { computeZoneTree } from './lib/tree';
import type { Zone, ZonesPageProps } from './types/zones';

export default function ZonesNode(props: ZonesPageProps) {
  const { t } = useTranslation();
  const householdId = useHouseholdId();
  const { zones, loading, error, setError, createZone, updateZone, deleteZone } = useZones({ ...props, householdId });

  const [pendingDelete, setPendingDelete] = useState<Zone | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);
  const { zonesById, sortedZones, zoneDepths } = useMemo(() => computeZoneTree(zones), [zones]);

  async function handleDelete(zone: Zone) {
    const confirmed = window.confirm(t('zones.deleteConfirmDescription', { name: zone.name }));
    if (!confirmed) return;

    try {
      setDeletingId(zone.id);
      await deleteZone(zone.id);
      setPendingDelete(null);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : t('zones.deleteFailed');
      setError(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader title={t('zones.title', { defaultValue: 'Zones' })}>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t('zones.addZone')}
        </button>
      </PageHeader>

      <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="mb-4">
        <SheetDialog
          title={t('zones.addZone')}
          open={formOpen}
          onOpenChange={setFormOpen}
          contentClassName="gap-3"
        >
          <ZoneForm
            setOpen={setFormOpen}
            sortedZones={sortedZones}
            zoneDepths={zoneDepths}
            onCreate={async (payload) => {
              try {
                await createZone(payload);
              } catch (createError) {
                const message = createError instanceof Error ? createError.message : t('zones.createFailed');
                setError(message);
              }
            }}
          />
        </SheetDialog>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{t('zones.loading_error_title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('zones.loading')}</p>
      ) : sortedZones.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('zones.none')}</p>
      ) : (
        <ZoneList
          zones={sortedZones}
          zonesById={zonesById}
          zoneDepths={zoneDepths}
          numberFormatter={numberFormatter}
          deletingId={deletingId}
          onEdit={async (id, payload) => {
            try {
              await updateZone(id, payload);
            } catch (updateError) {
              const message = updateError instanceof Error ? updateError.message : t('zones.updateFailed');
              setError(message);
            }
          }}
          onAskDelete={(zone) => {
            setPendingDelete(zone);
            void handleDelete(zone);
          }}
        />
      )}

      {pendingDelete ? <span className="sr-only">{pendingDelete.id}</span> : null}
    </section>
    </>
  );
}
