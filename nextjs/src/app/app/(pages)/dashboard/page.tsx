"use client";

import React, { useMemo } from "react";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import type { PageAction } from "@/components/layout/AppPageLayout";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  DashboardPinnedProjects,
  DashboardQuickActions,
  DashboardUpcomingInteractions,
} from "@dashboard/index";

export default function DashboardContent() {
  const { households, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();

  const currentHousehold = useMemo(
    () => households?.find((item) => item.id === selectedHouseholdId) ?? null,
    [households, selectedHouseholdId]
  );

  const pageActions = useMemo<PageAction[]>(() => {
    return [
      {
        element: <DashboardQuickActions />,
      },
    ];
  }, []);

  return (
    <ResourcePageShell
      title={currentHousehold?.name || t("dashboard.title")}
      // subtitle={t("dashboard.subtitle")}
      actions={pageActions}
      hideBackButton
      bodyClassName="space-y-2 md:space-y-6"
    >
      <DashboardUpcomingInteractions />
      <DashboardPinnedProjects />
    </ResourcePageShell>
  );
}
