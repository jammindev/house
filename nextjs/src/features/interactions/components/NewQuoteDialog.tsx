// nextjs/src/features/interactions/components/NewQuoteDialog.tsx
"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";

import { SheetDialog } from "@/components/ui/sheet-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useI18n } from "@/lib/i18n/I18nProvider";
import QuoteForm from "@interactions/components/forms/QuoteForm";
import type { InteractionStatus, ZoneOption } from "@interactions/types";
import { useZones } from "@zones/hooks/useZones";

interface NewQuoteDialogProps {
    projectId?: string;
    defaultStatus?: InteractionStatus | "";
    preSelectedZones?: ZoneOption[];
    onCreated?: (interactionId: string) => void;
    trigger?: React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>;
}

export default function NewQuoteDialog({
    projectId,
    defaultStatus = "pending",
    preSelectedZones,
    onCreated,
    trigger
}: NewQuoteDialogProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const { zones, loading: zonesLoading, error: zonesError } = useZones();

    const zoneOptions: ZoneOption[] = useMemo(
        () => zones.map(({ id, name, parent_id }) => ({ id, name, parent_id: parent_id ?? null })),
        [zones]
    );

    const defaultValues = useMemo(
        () => ({
            status: defaultStatus,
            projectId: projectId ?? null,
            selectedZones: preSelectedZones?.map(zone => zone.id) ?? [],
        }),
        [defaultStatus, projectId, preSelectedZones]
    );

    const handleCreated = (interactionId: string) => {
        setOpen(false);
        onCreated?.(interactionId);
    };

    const defaultTrigger = (
        <Button size="sm" variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            {t("projects.quickActions.addQuote")}
        </Button>
    ) as React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>;

    return (
        <SheetDialog
            title={t("forms.quote.title")}
            open={open}
            onOpenChange={setOpen}
            trigger={trigger || defaultTrigger}
        >
            <div className="space-y-4">
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
                    redirectOnSuccess={false}
                    onCreated={handleCreated}
                />
            </div>
        </SheetDialog>
    );
}
