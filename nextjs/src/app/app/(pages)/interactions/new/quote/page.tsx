"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import QuoteForm from "@interactions/components/forms/QuoteForm";
import { useZones } from "@zones/hooks/useZones";
import type { InteractionStatus, ZoneOption } from "@interactions/types";

export default function NewQuotePage() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const { zones, loading: zonesLoading, error: zonesError } = useZones();

    const zoneOptions: ZoneOption[] = useMemo(
        () => zones.map(({ id, name, parent_id }) => ({ id, name, parent_id: parent_id ?? null })),
        [zones]
    );

    const projectIdParam = searchParams?.get("projectId");
    const statusParam = searchParams?.get("status");
    const returnToParam = searchParams?.get("returnTo");
    const redirectTo = useMemo(
        () => (returnToParam && returnToParam.startsWith("/") ? returnToParam : null),
        [returnToParam]
    );

    const defaultValues = useMemo(
        () => ({
            status: (statusParam as InteractionStatus) || "pending",
            projectId: projectIdParam ?? null,
        }),
        [statusParam, projectIdParam]
    );

    return (
        <ResourcePageShell
            title={t("forms.quote.title")}
            subtitle={t("forms.quote.subtitle")}
            hideBackButton={false}
            bodyClassName="gap-4"
        >
            {zonesError ? (
                <Alert variant="destructive">
                    <AlertTitle>{t("zones.loadFailed")}</AlertTitle>
                    <AlertDescription>{zonesError}</AlertDescription>
                </Alert>
            ) : null}
            <QuoteForm
                zones={zoneOptions}
                zonesLoading={zonesLoading}
                defaultValues={defaultValues}
                redirectTo={redirectTo}
            />
        </ResourcePageShell>
    );
}
