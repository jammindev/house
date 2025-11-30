// nextjs/src/features/projects/components/project-card/ProjectCardDetails.tsx
"use client";

import { CalendarClock, CheckCircle2, Coins, Tag } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import type { ProjectWithMetrics } from "@projects/types";
import type { ProjectCardSection, ProjectTypeDefinition } from "@projects/constants";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@projects/utils/projectCard";

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface ProjectCardDetailsProps {
  project: ProjectWithMetrics;
  typeMeta: ProjectTypeDefinition;
  locale: string;
  helperText: string;
  emptyStateText: string;
  t: Translate;
}

export default function ProjectCardDetails({
  project,
  typeMeta,
  locale,
  helperText,
  emptyStateText,
  t,
}: ProjectCardDetailsProps) {
  const metrics = project.metrics;
  const openTodos = metrics?.open_todos ?? 0;
  const doneTodos = metrics?.done_todos ?? 0;

  const renderSection = (section: ProjectCardSection) => {
    switch (section) {
      case "progress":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
              <CheckCircle2 className="h-4 w-4" />
              {t("projects.metrics.tasks")}
            </div>
            <div className="text-sm font-medium text-slate-900">
              {t("projects.metrics.tasksSummary", { open: openTodos, done: doneTodos })}
            </div>
          </div>
        );
      case "schedule":
        return (
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
              <CalendarClock className="h-4 w-4" />
              {t("projects.metrics.schedule")}
            </div>
            <div className="flex items-center justify-between">
              <span>{t("projects.fields.startDate")}</span>
              <span className="font-medium text-slate-900">{formatDate(project.start_date, locale)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("projects.fields.dueDate")}</span>
              <span className="font-medium text-slate-900">{formatDate(project.due_date, locale)}</span>
            </div>
          </div>
        );
      case "budget":
        return (
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
              <Coins className="h-4 w-4" />
              {t("projects.metrics.budget")}
            </div>
            <div className="flex items-center justify-between">
              <span>{t("projects.metrics.planned")}</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(project.planned_budget ?? 0, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("projects.metrics.actual")}</span>
              <span
                className={cn(
                  "font-semibold",
                  project.actual_cost_cached > project.planned_budget ? "text-rose-600" : "text-emerald-700"
                )}
              >
                {formatCurrency(project.actual_cost_cached ?? 0, locale)}
              </span>
            </div>
          </div>
        );
      case "tags":
        if (!project.tags?.length) return null;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
              <Tag className="h-4 w-4" />
              {t("projects.fields.tags")}
            </div>
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const sectionNodes = typeMeta.layout
    .map((section) => {
      const content = renderSection(section);
      if (!content) return null;
      const highlight = typeMeta.highlightSections.includes(section);
      return (
        <div
          key={section}
          className={cn(
            "rounded-lg border border-slate-100 bg-white/80 p-3",
            highlight ? typeMeta.accent.highlight : "",
            section === "tags" ? "md:col-span-2" : ""
          )}
        >
          {content}
        </div>
      );
    })
    .filter(Boolean);

  return (
    <CardContent className="flex flex-col gap-4 text-sm text-slate-700">
      {project.description ? (
        <p className="text-sm text-slate-600">{project.description}</p>
      ) : emptyStateText ? (
        <p className="text-sm text-slate-500 italic">{emptyStateText}</p>
      ) : null}
      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
      {sectionNodes.length ? <div className="grid gap-3 md:grid-cols-2">{sectionNodes}</div> : null}
    </CardContent>
  );
}
