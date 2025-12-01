// nextjs/src/features/projects/components/project-card/ProjectCardHeader.tsx
"use client";

import { CalendarClock, FileText, FolderKanban, MessageSquare, Pin, Wallet, Image } from "lucide-react";
import CountBadge from "@/components/ui/CountBadge";
import OverdueBadge from "@/components/ui/OverdueBadge";
import DueSoonBadge from "@/components/ui/DueSoonBadge";
import ProjectStatusBadge from "@projects/components/ProjectStatusBadge";
import type { ProjectWithMetrics } from "@projects/types";
import type { ProjectTypeDefinition } from "@projects/constants";
import { formatDate } from "@projects/utils/projectCard";

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface ProjectCardHeaderProps {
  project: ProjectWithMetrics;
  typeMeta: ProjectTypeDefinition;
  interactionsCount?: number;
  documentsCount: number;
  photosCount?: number;
  photosLoading?: boolean;
  hideGroupBadge?: boolean;
  locale: string;
  t: Translate;
}

export default function ProjectCardHeader({
  project,
  typeMeta,
  interactionsCount,
  documentsCount,
  photosCount = 0,
  photosLoading = false,
  hideGroupBadge = false,
  locale,
  t,
}: ProjectCardHeaderProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 min-h-[48px]">
            {project.is_pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
                <Pin className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <h3 className="text-base font-semibold text-slate-900 line-clamp-2">{project.title}</h3>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <ProjectStatusBadge status={project.status} />
            {project.isOverdue ? (
              <OverdueBadge label={t("projects.badges.overdue")} />
            ) : null}
            {!project.isOverdue && project.isDueSoon ? (
              <DueSoonBadge label={t("projects.badges.dueSoon")} />
            ) : null}
            {!hideGroupBadge && project.group ? (
              <CountBadge
                icon={<FolderKanban className="h-4 w-4" />}
                count={undefined}
                label={project.group.name}
                display="inline"
              />
            ) : null}
            {/* interactions count fetched via useProject */}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <CountBadge
            label={t(typeMeta.labelKey)}
            display="inline"
            tone="none"
            className={typeMeta.accent.badge}
          />
        </div>
      </div>
      {project.due_date ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarClock className="h-3.5 w-3.5" />
          <span>
            {t("projects.fields.dueDate")}:{" "}
            <span className="font-medium text-slate-700">{formatDate(project.due_date, locale)}</span>
          </span>
        </div>
      ) : null}
      {(project.planned_budget > 0 || project.actual_cost_cached > 0) && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Wallet className="h-3.5 w-3.5" />
          <span>
            {t("projects.fields.budget")}:{" "}
            <span className={`font-medium ${project.actual_cost_cached > project.planned_budget && project.planned_budget > 0
                ? "text-rose-600"
                : "text-slate-700"
              }`}>
              {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(
                project.planned_budget > 0 ? project.planned_budget : project.actual_cost_cached
              )}
            </span>
          </span>
        </div>
      )}
      <div className="flex items-center gap-1">
        <CountBadge
          icon={<MessageSquare className="h-4 w-4" />}
          count={interactionsCount}
          display="tooltip"
          label={t("projects.metrics.interactions")}
        />
        <CountBadge
          icon={<FileText className="h-4 w-4" />}
          count={documentsCount}
          display="tooltip"
          label={t("documents.title")}
        />
        {!photosLoading && photosCount > 0 && (
          <CountBadge
            icon={<Image className="h-4 w-4" />}
            count={photosCount}
            display="tooltip"
            label={t("photos.title")}
          />
        )}
      </div>
    </>
  );
}
