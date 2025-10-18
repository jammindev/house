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
  const { selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { zones, loading: zonesLoading, error: zonesError } = useZones(selectedHouseholdId);

  const zoneOptions: ZoneOption[] = useMemo(
    () => zones.map(({ id, name, parent_id }) => ({ id, name, parent_id: parent_id ?? null })),
    [zones]
  );

  // Attendre le montage côté client pour éviter l'erreur d'hydratation
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Pendant le SSR et avant le montage, afficher un état neutre
  if (!isMounted) {
    return (
      <div className="max-w-3xl mx-auto lg:p-6">
        <Card>
          <CardContent className="py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Une fois monté, vérifier le household
  if (!selectedHouseholdId) {
    return (
      <div className="max-w-3xl mx-auto lg:p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500 text-sm">
              {t("common.selectHouseholdFirst")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <InteractionForm householdId={selectedHouseholdId} zones={zoneOptions} zonesLoading={zonesLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
