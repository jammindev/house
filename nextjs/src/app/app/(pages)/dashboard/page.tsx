"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import type { PageAction } from "@/components/layout/AppPageLayout";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useProjects } from "@projects/index";

import {
  DashboardActivityFeed,
  DashboardDocumentsPanel,
  DashboardInProgressPanel,
  DashboardProjectsByGroups,
  DashboardProjectsPanel,
  DashboardQuickActions,
  DashboardTasksPanel,
  useDashboardData,
} from "@dashboard/index";

export default function DashboardContent() {
  const { loading: userLoading, user, households, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { summary, tasks, highlightProjects, documents, recentInteractions, loading: dataLoading, error } =
    useDashboardData();

  // Récupération de tous les projets avec le hook dédié
  const { projects: allProjects, loading: projectsLoading } = useProjects({
    statuses: ["active", "draft", "on_hold"]
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Trier les projets par date de mise à jour (plus récent en premier)
  const sortedProjects = useMemo(() => {
    return [...allProjects].sort((a, b) => {
      const dateA = new Date(a.updated_at);
      const dateB = new Date(b.updated_at);
      return dateB.getTime() - dateA.getTime();
    });
  }, [allProjects]);

  // Trier les tâches par date de dernière modification (plus récent en premier)
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Utiliser occurred_at en priorité, sinon created_at
      const dateA = new Date(a.occurred_at || a.created_at);
      const dateB = new Date(b.occurred_at || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
  }, [tasks]);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const userAgent = window.navigator.userAgent || window.navigator.vendor || "";
    setIsMobileDevice(/android|iphone|ipad|ipod|mobile/i.test(userAgent));
  }, []);

  const handlePhotoAction = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;

    if (isMobileDevice) {
      input.setAttribute("capture", "environment");
    } else {
      input.removeAttribute("capture");
    }

    input.value = "";
    input.click();
  }, [isMobileDevice]);

  const pageActions = useMemo<PageAction[]>(
    () => [
      {
        label: t("dashboard.actions.capturePhoto"),
        icon: Camera,
        onClick: handlePhotoAction,
        variant: "default",
      },
    ],
    [handlePhotoAction, t],
  );

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
        <DashboardQuickActions />
        <DashboardProjectsByGroups
          loading={dataLoading || projectsLoading}
        />
      </>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={isMobileDevice ? "environment" : undefined}
        className="hidden"
        onChange={(event) => {
          event.target.value = "";
        }}
      />
      <ResourcePageShell
        title={currentHousehold?.name || t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        actions={pageActions}
        hideBackButton
        bodyClassName="space-y-4 md:space-y-6 p-4 md:p-6"
      >
        {content}
      </ResourcePageShell>
    </>
  );
}
