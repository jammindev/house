// nextjs/src/app/app/page.tsx
"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { loading, user, households, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { summary, tasks, highlightProjects, documents, recentInteractions, loading: dataLoading, error } =
    useDashboardData();

  const currentHousehold = useMemo(
    () => households.find((item) => item.id === selectedHouseholdId) ?? null,
    [households, selectedHouseholdId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If user has no household, prompt to create one
  if (!households || households.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user?.email?.split("@")[0]}!</CardTitle>
            <CardDescription>You don&apos;t belong to a household yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Link href="/app/households/new">
                <Button className="bg-primary-600 text-white hover:bg-primary-700">Create a Household</Button>
              </Link>
              <p className="text-sm text-gray-600">Create your first household to continue.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedHouseholdId) {
    return (
      <div className="space-y-6 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentInteractions")}</CardTitle>
            <CardDescription>{t("dashboard.selectHousehold")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{t("dashboard.selectHousehold")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:p-6">
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
    </div>
  );
}
