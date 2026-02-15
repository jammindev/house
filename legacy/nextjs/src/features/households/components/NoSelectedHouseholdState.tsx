"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function NoSelectedHouseholdState() {
    const { t } = useI18n();

    return (
        <div className="container mx-auto py-8 px-4">
            <Card>
                <CardHeader>
                    <CardTitle>{t("dashboard.recentInteractions")}</CardTitle>
                    <CardDescription>{t("dashboard.selectHousehold")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-600">
                        {t("dashboard.selectHousehold")}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}