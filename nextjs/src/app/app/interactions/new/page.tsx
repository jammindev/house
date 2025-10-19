// nextjs/src/app/app/interactions/new/page.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionForm from "@interactions/components/InteractionForm";
import { useZones } from "@zones/hooks/useZones";
import type { InteractionStatus, InteractionType, ZoneOption } from "@interactions/types";
import { INTERACTION_STATUSES, INTERACTION_TYPES } from "@interactions/constants";

export default function NewInteractionPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { zones, loading: zonesLoading, error: zonesError } = useZones();

  const zoneOptions: ZoneOption[] = useMemo(
    () => zones.map(({ id, name, parent_id }) => ({ id, name, parent_id: parent_id ?? null })),
    [zones]
  );

  const typeParam = searchParams?.get("type");
  const projectIdParam = searchParams?.get("projectId");
  const statusParam = searchParams?.get("status");

  const defaultType = useMemo(() => {
    if (!typeParam) return undefined;
    return INTERACTION_TYPES.includes(typeParam as InteractionType) ? (typeParam as InteractionType) : undefined;
  }, [typeParam]);

  const allowedStatuses = useMemo(
    () =>
      new Set(
        INTERACTION_STATUSES.filter((value): value is InteractionStatus => Boolean(value))
      ) as Set<InteractionStatus>,
    []
  );

  const defaultStatus = useMemo(() => {
    if (!statusParam) return "";
    return allowedStatuses.has(statusParam as InteractionStatus) ? (statusParam as InteractionStatus) : "";
  }, [allowedStatuses, statusParam]);

  const defaultValues = useMemo(
    () => ({
      type: defaultType,
      status: defaultStatus,
      projectId: projectIdParam ?? null,
    }),
    [defaultStatus, defaultType, projectIdParam]
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
          <InteractionForm zones={zoneOptions} zonesLoading={zonesLoading} defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </div>
  );
}
