"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectStatus } from "@projects/types";
import { PROJECT_STATUS_COLORS } from "@projects/constants";

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
}

export default function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const { t } = useI18n();
  const label = useMemo(() => t(`projects.status.${status}`), [status, t]);
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium";
  const statusClass = PROJECT_STATUS_COLORS[status] ?? "bg-slate-100 text-slate-700 border-slate-200";

  return <span className={cn(base, statusClass)}>{label}</span>;
}
