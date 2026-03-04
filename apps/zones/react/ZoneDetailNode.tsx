import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';

import ZoneEditDialog from './components/ZoneEditDialog';
import ZoneDetailView from './components/ZoneDetailView';
import ZonePhotoGallery from './components/ZonePhotoGallery';
import { useZoneDetail } from './hooks/useZoneDetail';
import { useZones } from './hooks/useZones';
import { computeZoneTree } from './lib/tree';
import type { ZoneDetailPageProps, ZoneMutationPayload } from './types/zones';

export default function ZoneDetailNode(props: ZoneDetailPageProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);

  const { zones, updateZone } = useZones({ householdId: props.householdId, initialZones: [] });
  const { zonesById, sortedZones, zoneDepths } = useMemo(() => computeZoneTree(zones), [zones]);

  const { zone, photos, loading, error, attachPhoto, reload } = useZoneDetail(props);

  const childrenCount = props.initialStats?.childrenCount ?? zone?.children_count ?? 0;

  async function handleEdit(zoneId: string, payload: ZoneMutationPayload) {
    await updateZone(zoneId, payload);
    await reload();
  }

  if (loading && !zone) {
    return <p className="text-sm text-muted-foreground">{t('zones.loading')}</p>;
  }

  if (!zone) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('zones.loading_error_title')}</AlertTitle>
        <AlertDescription>{error || t('zones.detail.notFound')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="space-y-6 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{zone.name}</h2>
          <p className="text-sm text-muted-foreground">
            {zone.parent?.name ? t('zones.childOf', { parent: zone.parent.name }) : t('zones.detail.subtitle')}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          {t('zones.detail.edit')}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('zones.loading_error_title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ZoneDetailView zone={zone} childrenCount={childrenCount} photosCount={photos.length} />

      <ZonePhotoGallery
        photos={photos}
        loading={loading}
        householdId={props.householdId}
        onAttachPhoto={async (documentId, note) => {
          await attachPhoto(documentId, note);
        }}
      />

      {sortedZones.length > 0 ? (
        <ZoneEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          zone={zone}
          zones={sortedZones}
          zonesById={zonesById}
          zoneDepths={zoneDepths}
          onSave={handleEdit}
        />
      ) : null}
    </section>
  );
}
