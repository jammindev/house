"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import type { PageAction } from "@/components/layout/AppPageLayout";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useProjects } from "@projects/index";
import {
  DashboardProjectsByGroups,
  DashboardQuickActions,
  useDashboardData,
} from "@dashboard/index";

export default function DashboardContent() {
  const { households, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  content = (
    <>
      <DashboardQuickActions />
      <DashboardProjectsByGroups
      />
    </>
  );

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
        bodyClassName="space-y-2 md:space-y-6"
      >
        {content}
      </ResourcePageShell>
    </>
  );
}
