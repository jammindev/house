// nextjs/src/features/interactions/components/NewDocumentDialog.tsx
"use client";

import { useMemo, useState } from "react";
import { Paperclip } from "lucide-react";

import { SheetDialog } from "@/components/ui/sheet-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useZones } from "@zones/hooks/useZones";
import type { InteractionStatus, ZoneOption } from "@interactions/types";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

interface NewDocumentDialogProps {
    projectId?: string;
    defaultStatus?: InteractionStatus | "";
    preSelectedZones?: ZoneOption[];
    onCreated?: (interactionId: string) => void;
    trigger?: React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>;
}

export default function NewDocumentDialog({
    projectId,
    defaultStatus = "",
    preSelectedZones,
    onCreated,
    trigger
}: NewDocumentDialogProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const { zones, loading: zonesLoading, error: zonesError } = useZones();

    const projectPagePath = projectId ? `/app/projects/${projectId}` : undefined;

    const buildInteractionUrl = () => {
        const basePath = `/app/interactions/new`;
        const params = new URLSearchParams();

        params.set("type", "document");

        if (projectId) {
            params.set("projectId", projectId);
        }

        if (projectPagePath) {
            params.set("returnTo", projectPagePath);
        }

        if (defaultStatus) {
            params.set("status", defaultStatus);
        }

        // Add project zones as pre-selected zones
        if (preSelectedZones && preSelectedZones.length > 0) {
            params.set('zones', preSelectedZones.map(zone => zone.id).join(','));
        }

        return `${basePath}?${params.toString()}`;
    };

    const defaultTrigger = (
        <Button size="sm" variant="outline">
            <Paperclip className="h-4 w-4 mr-2" />
            {t("projects.quickActions.addDocument")}
        </Button>
    ) as React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>;

    const handleNavigate = () => {
        setOpen(false);
        onCreated?.(""); // Empty string since we're navigating instead of creating directly
    };

    return (
        <SheetDialog
            title={t("interactions.documents.title")}
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

                <div className="text-center py-6">
                    <p className="text-sm text-slate-600 mb-4">
                        {t("interactions.documents.subtitle")}
                    </p>
                    <LinkWithOverlay
                        href={buildInteractionUrl()}
                        onClick={handleNavigate}
                    >
                        <Button className="w-full">
                            {t("interactions.documents.continue")}
                        </Button>
                    </LinkWithOverlay>
                </div>
            </div>
        </SheetDialog>
    );
}