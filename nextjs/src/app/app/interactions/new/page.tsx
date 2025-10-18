// nextjs/src/app/app/interactions/new/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionForm from "@interactions/components/InteractionForm";
import { useZones } from "@zones/hooks/useZones";
import type { ZoneOption } from "@interactions/types";

export default function NewInteractionPage() {
  const { t } = useI18n();
  const { zones, loading: zonesLoading, error: zonesError } = useZones();

  const zoneOptions: ZoneOption[] = useMemo(
    () => zones.map(({ id, name, parent_id }) => ({ id, name, parent_id: parent_id ?? null })),
    [zones]
  );

  return (
    <div className="max-w-3xl mx-auto lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("interactionsnewEntry")}</CardTitle>
        </CardHeader>
        <CardContent>
          {zonesError && (
            <div className="mb-4 text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
              {zonesError}
            </div>
          )}
          <InteractionForm zones={zoneOptions} zonesLoading={zonesLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
