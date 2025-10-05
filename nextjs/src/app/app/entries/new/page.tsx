"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import EntryForm from "@entries/components/EntryForm";
import { useMemo } from "react";
import { useZones } from "@zones/hooks/useZones";
import type { ZoneOption } from "@entries/types";

export default function NewEntryPage() {
  const { selectedHouseholdId } = useGlobal();
  const { t } = useI18n();

  const { zones, loading: zonesLoading, error: zonesError } = useZones(selectedHouseholdId);

  const zoneOptions: ZoneOption[] = useMemo(
    () => zones.map(z => ({ id: z.id, name: z.name, parent_id: z.parent_id ?? null })),
    [zones]
  );

  if (!selectedHouseholdId) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-gray-500 text-sm">
        {t("common.selectHouseholdFirst")}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("entries.newEntry")}</CardTitle>
        </CardHeader>
        <CardContent>
          {zonesError && (
            <div className="mb-4 text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
              {zonesError}
            </div>
          )}
          <EntryForm
            householdId={selectedHouseholdId}
            t={t}
            zones={zoneOptions}
            loadingZones={zonesLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
