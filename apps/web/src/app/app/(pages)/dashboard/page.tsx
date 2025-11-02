"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";

import {
  DashboardActivityFeed,
  DashboardDocumentsPanel,
  DashboardProjectsPanel,
  DashboardSummaryCards,
  DashboardTasksPanel,
  useDashboardData,
} from "@dashboard/index";

export default function DashboardContent() {
  const { loading: userLoading, user, households, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { summary, tasks, highlightProjects, documents, recentInteractions, loading: dataLoading, error } =
    useDashboardData();

  const currentHousehold = useMemo(
    () => households?.find((item) => item.id === selectedHouseholdId) ?? null,
    [households, selectedHouseholdId]
  );

  let content: React.ReactNode;

  if (userLoading) {
    content = (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  } else if (!households || households.length === 0) {
    content = (
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.welcome", { name: user?.email?.split("@")[0] ?? "" })}</CardTitle>
          <CardDescription>{t("dashboard.selectHousehold")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/app/households/new">
              <Button className="bg-primary-600 text-white hover:bg-primary-700">
                {t("nav.createHousehold")}
              </Button>
            </Link>
            <p className="text-sm text-gray-600">{t("dashboard.selectHousehold")}</p>
          </div>
        </CardContent>
      </Card>
    );
  } else if (!selectedHouseholdId) {
    content = (
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recentInteractions")}</CardTitle>
          <CardDescription>{t("dashboard.selectHousehold")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{t("dashboard.selectHousehold")}</p>
        </CardContent>
      </Card>
    );
  } else {
    content = (
      <>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{t("dashboard.error")}</AlertDescription>
          </Alert>
        ) : null}
        <DashboardSummaryCards summary={summary} loading={dataLoading} />
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <DashboardTasksPanel tasks={tasks} loading={dataLoading} />
            <DashboardProjectsPanel projects={highlightProjects} loading={dataLoading} />
            <DashboardDocumentsPanel documents={documents} loading={dataLoading} />
          </div>
          <DashboardActivityFeed
            interactions={recentInteractions}
            loading={dataLoading}
            householdName={currentHousehold?.name ?? null}
          />
        </div>
      </>
    );
  }

  return (
    <ResourcePageShell
      title={t("dashboard.title")}
      subtitle={t("dashboard.subtitle")}
      context={currentHousehold?.name ?? undefined}
      hideBackButton
      bodyClassName="space-y-6 md:p-6"
    >
      {content}
    </ResourcePageShell>
  );
}
