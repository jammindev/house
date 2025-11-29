// nextjs/src/features/projects/components/project-card/ProjectCardHeader.tsx
"use client";

import { CalendarClock, FileText, FolderKanban, MessageSquare, Pin, TriangleAlert } from "lucide-react";
import CountBadge from "@/components/ui/CountBadge";
import ProjectStatusBadge from "@projects/components/ProjectStatusBadge";
import type { ProjectWithMetrics } from "@projects/types";
import type { ProjectTypeDefinition } from "@projects/constants";
import { formatDate } from "@projects/utils/projectCard";

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface ProjectCardHeaderProps {
  project: ProjectWithMetrics;
  typeMeta: ProjectTypeDefinition;
  interactionsCount?: number;
  documentsCount: number;
  locale: string;
  t: Translate;
}

export default function ProjectCardHeader({
  project,
  typeMeta,
  interactionsCount,
  documentsCount,
  locale,
  t,
}: ProjectCardHeaderProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
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
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                <TriangleAlert className="h-4 w-4" />
                {t("projects.badges.overdue")}
              </span>
            ) : null}
            {!project.isOverdue && project.isDueSoon ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                <CalendarClock className="h-4 w-4" />
                {t("projects.badges.dueSoon")}
              </span>
            ) : null}
            {project.group ? (
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
      </div>
    </>
  );
}
