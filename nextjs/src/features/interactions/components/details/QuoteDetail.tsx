// nextjs/src/features/interactions/components/details/QuoteDetail.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Interaction } from "@interactions/types";

interface QuoteDetailProps {
    interaction: Interaction;
}

export default function QuoteDetail({ interaction }: QuoteDetailProps) {
    const { t } = useI18n();

    const amount = interaction.metadata?.amount as number | undefined;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{t("forms.quote.specificDetails")}</CardTitle>
                    <Badge variant="outline">
                        {interaction.status ? t(`interactionsstatus.${interaction.status}`) : t("interactionsstatusNone")}
                    </Badge>
                </div>
                <CardDescription>{t("forms.quote.specificDetailsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <dt className="text-sm font-medium text-gray-500">{t("interactionsamountLabel")}</dt>
                        <dd className="text-lg font-semibold text-gray-900">
                            {amount !== undefined ? `${amount.toLocaleString()} €` : t("common.notSpecified")}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">{t("interactionsstatusLabel")}</dt>
                        <dd className="text-sm text-gray-900">
                            {interaction.status ? t(`interactionsstatus.${interaction.status}`) : t("interactionsstatusNone")}
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