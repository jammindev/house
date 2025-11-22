"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

export function NoHouseholdState() {
    const { t } = useI18n();
    const { user } = useGlobal();

    return (
        <div className="container mx-auto py-8 px-4">
            <Card>
                <CardHeader>
                    <CardTitle>
                        {t("dashboard.welcome", { name: user?.email?.split("@")[0] ?? "" })}
                    </CardTitle>
                    <CardDescription>
                        {t("dashboard.selectHousehold")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <LinkWithOverlay href="/app/households/new">
                            <Button className="bg-primary-600 text-white hover:bg-primary-700">
                                {t("nav.createHousehold")}
                            </Button>
                        </LinkWithOverlay>
                        <p className="text-sm text-gray-600">
                            {t("dashboard.selectHousehold")}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
