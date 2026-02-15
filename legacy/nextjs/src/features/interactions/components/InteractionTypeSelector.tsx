// nextjs/src/features/interactions/components/InteractionTypeSelector.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { INTERACTION_TYPE_COLORS } from "@interactions/constants";
import type { InteractionType } from "@interactions/types";

interface InteractionTypeSelectorProps {
    projectId?: string | null;
    returnTo?: string | null;
    zones?: string | null;
    onTypeSelect?: (type: InteractionType) => void;
}

const COMMON_TYPES: InteractionType[] = ["note", "todo", "quote", "expense", "call", "visit"];

export default function InteractionTypeSelector({ projectId, returnTo, zones, onTypeSelect }: InteractionTypeSelectorProps) {
    const { t } = useI18n();
    const router = useRouter();
    const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : null;

    const handleTypeSelect = (type: InteractionType) => {
        if (onTypeSelect) {
            onTypeSelect(type);
            return;
        }

        // Navigate to specific form page
        const params = new URLSearchParams();
        if (projectId) {
            params.set("projectId", projectId);
        }
        if (safeReturnTo) {
            params.set("returnTo", safeReturnTo);
        }
        if (zones) {
            params.set("zones", zones);
        }

        const queryString = params.toString();
        const url = `/app/interactions/new/${type}${queryString ? `?${queryString}` : ""}`;
        router.push(url);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t("interactions.selectType")}</CardTitle>
                <CardDescription>{t("interactions.selectTypeDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {COMMON_TYPES.map((type) => (
                        <Button
                            key={type}
                            variant="outline"
                            className="h-auto flex-col justify-start p-4 text-left"
                            onClick={() => handleTypeSelect(type)}
                        >
                            <div className="flex w-full items-center justify-between">
                                <span className="font-medium">{t(`interactionstypes.${type}`)}</span>
                                <div className={`h-2 w-2 rounded-full ${INTERACTION_TYPE_COLORS[type].split(' ')[0]}`} />
                            </div>
                            <span className="mt-1 text-xs text-muted-foreground">
                                {t(`forms.${type}.subtitle`)}
                            </span>
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
