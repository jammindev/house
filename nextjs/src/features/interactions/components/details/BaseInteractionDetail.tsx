// nextjs/src/features/interactions/components/details/BaseInteractionDetail.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Interaction } from "@interactions/types";

interface BaseInteractionDetailProps {
    interaction: Interaction;
}

export default function BaseInteractionDetail({ interaction }: BaseInteractionDetailProps) {
    const { t } = useI18n();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{t("interactionssections.details")}</CardTitle>
                <CardDescription>{t("forms.baseDetail.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <dt className="text-sm font-medium text-gray-500">{t("interactionstypeLabel")}</dt>
                        <dd className="text-sm text-gray-900">{t(`interactionstypes.${interaction.type}`)}</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">{t("interactionsstatusLabel")}</dt>
                        <dd className="text-sm text-gray-900">
                            {interaction.status ? t(`interactionsstatus.${interaction.status}`) : t("interactionsstatusNone")}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">{t("interactionsoccurredAtLabel")}</dt>
                        <dd className="text-sm text-gray-900">
                            {new Date(interaction.occurred_at).toLocaleString()}
                        </dd>
                    </div>
                </div>
                {interaction.content && (
                    <div>
                        <dt className="text-sm font-medium text-gray-500 mb-1">{t("interactionssections.description")}</dt>
                        <dd className="text-sm text-gray-900 whitespace-pre-wrap">{interaction.content}</dd>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}