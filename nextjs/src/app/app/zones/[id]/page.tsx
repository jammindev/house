"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useI18n } from "@/lib/i18n/I18nProvider";
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

  const handleEdit = async (zoneId: string, payload: { name: string; parent_id: string | null; note: string | null; surface: number | null; color?: string | null }) => {
    await updateZone(zoneId, payload);
    await reload();
  };

  const subtitle = zone?.parent?.name ? t("zones.childOf", { parent: zone.parent.name }) : t("zones.detail.subtitle");
  const actions = zone
    ? [
        {
          icon: Pencil,
          onClick: () => setEditOpen(true),
        },
      ]
    : [];

  return (
    <AppPageLayout title={zone?.name ?? t("zones.detail.titleFallback")} subtitle={subtitle} actions={actions}>
      {loading ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      ) : zone ? (
        <ZoneDetailView zone={zone} interactions={interactions} documentCounts={documentCounts} />
      ) : (
        <div className="text-sm text-muted-foreground">{t("zones.detail.notFound")}</div>
      )}

      {zone && sortedZones.length > 0 ? (
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
    </AppPageLayout>
  );
}
