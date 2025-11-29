// nextjs/src/features/projects/components/project-card/ProjectCardFooter.tsx
"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { ProjectTypeDefinition } from "@projects/constants";
import { CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@projects/utils/projectCard";

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface ProjectCardFooterProps {
  isCollapsed: boolean;
  typeMeta: ProjectTypeDefinition;
  detailsId: string;
  locale: string;
  updatedAt: string | null;
  createdAt: string;
  t: Translate;
  onToggle: () => void;
}

export default function ProjectCardFooter({
  isCollapsed,
  typeMeta,
  detailsId,
  locale,
  updatedAt,
  createdAt,
  t,
  onToggle,
}: ProjectCardFooterProps) {
  return (
    <CardFooter
      className={cn(
        "p-0 px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
        typeMeta.accent.footerBg,
        typeMeta.accent.footerBorder
      )}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={!isCollapsed}
      aria-controls={detailsId}
      aria-label={isCollapsed ? t("projects.actions.showDetails") : t("projects.actions.hideDetails")}
      title={isCollapsed ? t("projects.actions.showDetails") : t("projects.actions.hideDetails")}
    >
      <div className="w-full flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-xs text-slate-600">
          {t("projects.updatedAt", {
            date: formatDate(updatedAt ?? createdAt, locale),
          })}
        </span>

        <div className="flex items-center sm:justify-end">
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-700" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-700" />
          )}
        </div>
      </div>
    </CardFooter>
  );
}
