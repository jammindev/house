// nextjs/src/app/app/interactions/new/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionForm from "@interactions/components/InteractionForm";
import { useZones } from "@zones/hooks/useZones";

export default function NewInteractionPage() {
  const { selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { error: zonesError } = useZones(selectedHouseholdId);

  if (!selectedHouseholdId) {
    return (
      <div className="max-w-3xl mx-auto lg:p-6 text-gray-500 text-sm">
        {t("common.selectHouseholdFirst")}
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
          <InteractionForm />
        </CardContent>
      </Card>
    </div>
  );
}
