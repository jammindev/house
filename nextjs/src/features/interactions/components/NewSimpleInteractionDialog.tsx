// nextjs/src/features/interactions/components/NewSimpleInteractionDialog.tsx
"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { SheetDialog } from "@/components/ui/sheet-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useZones } from "@zones/hooks/useZones";
import type { InteractionStatus, ZoneOption } from "@interactions/types";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

interface NewSimpleInteractionDialogProps {
    projectId?: string;
    interactionType: "expense" | "call" | "visit";
    defaultStatus?: InteractionStatus | "";
    preSelectedZones?: ZoneOption[];
    onCreated?: (interactionId: string) => void;
    trigger?: React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>;
    icon?: LucideIcon;
    label?: string;
}

export default function NewSimpleInteractionDialog({
    projectId,
    interactionType,
    defaultStatus,
    preSelectedZones,
    onCreated,
    trigger,
    icon: Icon,
    label
}: NewSimpleInteractionDialogProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const { zones, loading: zonesLoading, error: zonesError } = useZones();

    const projectPagePath = projectId ? `/app/projects/${projectId}` : undefined;

    const buildInteractionUrl = () => {
        const basePath = `/app/interactions/new/${interactionType}`;
        const params = new URLSearchParams();

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
            {Icon && <Icon className="h-4 w-4 mr-2" />}
            {label || t(`projects.quickActions.add${interactionType.charAt(0).toUpperCase() + interactionType.slice(1)}`)}
        </Button>
    ) as React.ReactElement<{ onClick?: (event: React.MouseEvent<HTMLElement>) => void }>;

    const handleNavigate = () => {
        setOpen(false);
        onCreated?.(""); // Empty string since we're navigating instead of creating directly
    };

    return (
        <SheetDialog
            title={t(`forms.${interactionType}.title`)}
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
                        {t(`forms.${interactionType}.subtitle`)}
                    </p>
                    <LinkWithOverlay
                        href={buildInteractionUrl()}
                        onClick={handleNavigate}
                    >
                        <Button className="w-full">
                            {t(`forms.${interactionType}.continue`)}
                        </Button>
                    </LinkWithOverlay>
                </div>
            </div>
        </SheetDialog>
    );
}