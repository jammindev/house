"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";

import { Zone } from "@zones/types";
import { computeZoneTree } from "@zones/lib/tree";
import { useZones } from "@zones/hooks/useZones";
import ZoneStats from "@zones/components/ZoneStats";
import ZoneForm from "@zones/components/ZoneForm";
import ZoneList from "@zones/components/ZoneList";

export default function ZonesPage() {
  const { loading: globalLoading, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { zones, loading, error, setError, createZone, updateZone, deleteZone } = useZones(selectedHouseholdId);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Zone | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);
  const { zonesById, sortedZones, zoneDepths, zoneStats } = useMemo(() => computeZoneTree(zones), [zones]);
  const formattedSurfaceTotal = zoneStats.hasSurfaceData ? numberFormatter.format(zoneStats.surfaceSum) : null;

  if (globalLoading) return <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>;

  if (!selectedHouseholdId)
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("zones.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              {t("common.selectHouseholdFirst")} <Link href="/app" className="underline">{t("nav.dashboard")}</Link>.
            </div>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {t("zones.title")}
            </CardTitle>

            <Button variant="ghost" size="icon" onClick={() => setFormOpen((prev) => !prev)} aria-label={t("zones.addZone")}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">{error}</div>
          )}

          <ZoneForm
            open={formOpen}
            setOpen={setFormOpen}
            t={t}
            sortedZones={sortedZones}
            zoneDepths={zoneDepths}
            onCreate={async ({ name, parent_id, note, surface }) => {
              if (!selectedHouseholdId) return;
              try {
                await createZone({ household_id: selectedHouseholdId, name, parent_id, note, surface });
              } catch (e: any) {
                console.error(e);
                setError(e?.message || t("zones.createFailed"));
              }
            }}
          />

          {!loading && sortedZones.length > 0 && (
            <ZoneStats stats={zoneStats} t={t} formattedSurfaceTotal={formattedSurfaceTotal} />
          )}

          {loading ? (
            <div className="text-sm text-gray-500">{t("zones.loading")}</div>
          ) : sortedZones.length === 0 ? (
            <div className="text-sm text-gray-500">{t("zones.none")}</div>
          ) : (
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
                } catch (e: any) {
                  console.error(e);
                  setError(e?.message || t("zones.updateFailed"));
                }
              }}
              onAskDelete={(z) => {
                setPendingDelete(z);
                setConfirmOpen(true);
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Confirm delete */}
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
          } catch (e: any) {
            console.error(e);
            setError(e?.message || t("zones.deleteFailed"));
          } finally {
            setDeletingId(null);
            setConfirmOpen(false);
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
}
