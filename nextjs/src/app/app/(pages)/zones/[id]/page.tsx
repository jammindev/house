"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MapPin, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { useZoneDetail } from "@zones/hooks/useZoneDetail";
import { useZones } from "@zones/hooks/useZones";
import { computeZoneTree } from "@zones/lib/tree";
import ZoneDetailView from "@zones/components/ZoneDetailView";
import ZoneEditDialog from "@zones/components/ZoneEditDialog";

export default function ZoneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { zone, interactions, documentCounts, loading, error, reload } = useZoneDetail(id);
  const { zones, updateZone } = useZones();
  const [editOpen, setEditOpen] = useState(false);

  const { zonesById, sortedZones, zoneDepths } = useMemo(() => computeZoneTree(zones), [zones]);

  const handleEdit = async (
    zoneId: string,
    payload: { name: string; parent_id: string | null; note: string | null; surface: number | null; color?: string | null }
  ) => {
    await updateZone(zoneId, payload);
    await reload();
  };

  const subtitle = useMemo(
    () => (zone?.parent?.name ? t("zones.childOf", { parent: zone.parent.name }) : t("zones.detail.subtitle")),
    [t, zone]
  );

  const actions = useMemo(
    () =>
      zone
        ? [
          {
            icon: Pencil,
            onClick: () => setEditOpen(true),
          } as const,
        ]
        : undefined,
    [t, zone]
  );

  const isNotFound = !loading && !zone;

  return (
    <DetailPageLayout
      title={zone?.name ?? t("zones.detail.titleFallback")}
      subtitle={subtitle}
      actions={actions}
      loading={loading}
      error={error ?? null}
      errorTitle={t("zones.loadFailed")}
      isNotFound={isNotFound}
      notFoundState={
        <EmptyState
          icon={MapPin}
          title={t("zones.detail.notFound")}
          description={t("zones.detail.subtitle")}
          action={
            <Button asChild variant="outline">
              <LinkWithOverlay href="/app/zones">{t("zones.title")}</LinkWithOverlay>
            </Button>
          }
        />
      }
      className="max-w-4xl"
      contentClassName="space-y-6"
    >
      {zone ? (
        <>
          <ZoneDetailView zone={zone} interactions={interactions} documentCounts={documentCounts} />
          {sortedZones.length > 0 ? (
            <ZoneEditDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              zone={zone}
              zones={sortedZones}
              zonesById={zonesById}
              zoneDepths={zoneDepths}
              t={t}
              onSave={handleEdit}
            />
          ) : null}
        </>
      ) : null}
    </DetailPageLayout>
  );
}
