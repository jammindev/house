"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectStatus } from "@projects/types";
import { PROJECT_STATUS_COLORS } from "@projects/constants";
import CountBadge from "@/components/ui/CountBadge";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
}

export default function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const { t } = useI18n();
  const label = useMemo(() => t(`projects.status.${status}`), [status, t]);
  const statusClass = PROJECT_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700";

  return (
    <CountBadge
      label={label}
      display="inline"
      tone="none"
      className={cn("w-fit", statusClass)}
    />
  );
}
