// nextjs/src/features/interactions/components/details/TaskDetail.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Interaction } from "@interactions/types";

interface TaskDetailProps {
    interaction: Interaction;
}

export default function TaskDetail({ interaction }: TaskDetailProps) {
    const { t } = useI18n();

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{t("forms.task.specificDetails")}</CardTitle>
                    <Badge variant={interaction.status === "done" ? "secondary" : "outline"}>
                        {interaction.status ? t(`interactionsstatus.${interaction.status}`) : t("interactionsstatusNone")}
                    </Badge>
                </div>
                <CardDescription>{t("forms.task.specificDetailsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <dt className="text-sm font-medium text-gray-500">{t("interactionsstatusLabel")}</dt>
                        <dd className="text-sm text-gray-900">
                            {interaction.status ? t(`interactionsstatus.${interaction.status}`) : t("interactionsstatusNone")}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">{t("interactionstypeLabel")}</dt>
                        <dd className="text-sm text-gray-900">{t(`interactionstypes.${interaction.type}`)}</dd>
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