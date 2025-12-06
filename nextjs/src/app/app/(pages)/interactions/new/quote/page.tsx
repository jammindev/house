"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import QuoteForm from "@interactions/components/forms/QuoteForm";
import type { InteractionStatus } from "@interactions/types";

export default function NewQuotePage() {
    const { t } = useI18n();
    const searchParams = useSearchParams();

    const projectIdParam = searchParams?.get("projectId");
    const statusParam = searchParams?.get("status");
    const returnToParam = searchParams?.get("returnTo");
    const zonesParam = searchParams?.get("zones");
    const redirectTo = useMemo(
        () => (returnToParam && returnToParam.startsWith("/") ? returnToParam : null),
        [returnToParam]
    );

    const defaultValues = useMemo(
        () => ({
            status: (statusParam as InteractionStatus) || "pending",
            projectId: projectIdParam ?? null,
            selectedZones: zonesParam ? zonesParam.split(",") : undefined,
        }),
        [statusParam, projectIdParam, zonesParam]
    );

    return (
        <ResourcePageShell
            title={t("forms.quote.title")}
            subtitle={t("forms.quote.subtitle")}
            hideBackButton={false}
            bodyClassName="gap-4"
        >
            <QuoteForm
                defaultValues={defaultValues}
                redirectTo={redirectTo}
            />
        </ResourcePageShell>
    );
}
