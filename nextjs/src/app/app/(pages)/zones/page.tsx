// nextjs/src/app/app/zones/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import ResourcePageShell from "@shared/layout/ResourcePageShell";

import { Zone } from "@zones/types";
import { computeZoneTree } from "@zones/lib/tree";
import { useZones } from "@zones/hooks/useZones";
import ZoneForm from "@zones/components/ZoneForm";
import ZoneList from "@zones/components/ZoneList";

export default function ZonesPage() {
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { zones, loading, error, setError, createZone, updateZone, deleteZone } = useZones();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Zone | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);
  const { zonesById, sortedZones, zoneDepths } = useMemo(() => computeZoneTree(zones), [zones]);

  return (
    <>
      <ZoneForm
        open={formOpen}
        setOpen={setFormOpen}
        t={t}
        sortedZones={sortedZones}
        zoneDepths={zoneDepths}
        onCreate={async ({ name, parent_id, note, surface, color }) => {
          if (!selectedHouseholdId) return;
          try {
            await createZone({ household_id: selectedHouseholdId, name, parent_id, note, surface, color });
          } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : t("zones.createFailed");
            setError(message);
          }
        }}
      />

      <ResourcePageShell
        title={t("zones.title")}
        hideBackButton
        actions={[{ icon: Plus, label: t("zones.addZone"), onClick: () => setFormOpen(true) }]}
        bodyClassName="space-y-4"
      >
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div>
        ) : null}

        <div>
          {loading ? (
            <div className="text-sm text-gray-500">{t("zones.loading")}</div>
          ) : sortedZones.length === 0 ? (
            <div className="text-sm text-gray-500">{t("zones.none")}</div>
          ) : (
            <div>
              <ZoneList
                zones={sortedZones}
                zonesById={zonesById}
                zoneDepths={zoneDepths}
                numberFormatter={numberFormatter}
                t={t}
                deletingId={deletingId}
                onEdit={async (id, payload) => {
                  try {
                    await updateZone(id, payload);
                  } catch (error: unknown) {
                    console.error(error);
                    const message = error instanceof Error ? error.message : t("zones.updateFailed");
                    setError(message);
                  }
                }}
                onAskDelete={(z) => {
                  setPendingDelete(z);
                  setConfirmOpen(true);
                }}
              />
            </div>
          )}
        </div>
      </ResourcePageShell>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) setPendingDelete(null);
        }}
        title={t("zones.deleteConfirmTitle")}
        description={pendingDelete ? t("zones.deleteConfirmDescription", { name: pendingDelete.name }) : undefined}
        confirmText={t("zones.deleteConfirmCta")}
        cancelText={t("zones.deleteCancel")}
        destructive
        loading={!!(pendingDelete && deletingId === pendingDelete.id)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            setDeletingId(pendingDelete.id);
            await deleteZone(pendingDelete.id);
          } catch (error: unknown) {
            console.error(error);
            const message = error instanceof Error ? error.message : t("zones.deleteFailed");
            setError(message);
          } finally {
            setDeletingId(null);
            setConfirmOpen(false);
            setPendingDelete(null);
          }
        }}
      />
    </>
  );
}
