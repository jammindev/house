// nextjs/src/features/projects/components/ProjectCard.tsx
"use client";

import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  FileText,
  FolderKanban,
  TriangleAlert,
  MessageSquare,
  Tag,
} from "lucide-react";
import CountBadge from "@/components/ui/CountBadge";
import { useProject } from "@projects/hooks/useProject";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { ProjectWithMetrics } from "@projects/types";
import ProjectStatusBadge from "@projects/components/ProjectStatusBadge";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { PROJECT_TYPE_META, type ProjectCardSection } from "@projects/constants";

interface ProjectCardProps {
  project: ProjectWithMetrics;
}

const formatCurrency = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);

const formatDate = (value: string | null, locale: string) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(value)
    );
  } catch {
    return value;
  }
};

export default function ProjectCard({ project }: ProjectCardProps) {
  const { locale, t } = useI18n();
  const metrics = project.metrics;
  const openTodos = metrics?.open_todos ?? 0;
  const doneTodos = metrics?.done_todos ?? 0;
  const documentsCount = metrics?.documents_count ?? 0;
  const { interactionsCount } = useProject(project.id);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const detailsId = `project-card-details-${project.id}`;
  const typeMeta = PROJECT_TYPE_META[project.type] ?? PROJECT_TYPE_META.other;
  const helperText = t(typeMeta.helperKey);
  const emptyStateText = typeMeta.emptyStateKey ? t(typeMeta.emptyStateKey) : "";

  const handleToggleDetails = () => {
    setIsCollapsed((prev) => !prev);
  };

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
    <Card className="flex flex-col border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <LinkWithOverlay href={`/app/projects/${project.id}`} className="flex flex-col gap-1">
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-slate-900 line-clamp-2">{project.title}</h3>
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
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                  typeMeta.accent.badge
                )}
              >
                {t(typeMeta.labelKey)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <CountBadge icon={<MessageSquare className="h-4 w-4" />} count={interactionsCount} display="tooltip" label={t("projects.metrics.interactions")} />
            <CountBadge icon={<FileText className="h-4 w-4" />} count={documentsCount} display="tooltip" label={t("documents.title")} />

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
        </CardHeader>
      </LinkWithOverlay>
      <div id={detailsId} hidden={isCollapsed}>
        <CardContent className="flex flex-col gap-4 text-sm text-slate-700">
          {project.description ? (
            <p className="text-sm text-slate-600">{project.description}</p>
          ) : emptyStateText ? (
            <p className="text-sm text-slate-500 italic">{emptyStateText}</p>
          ) : null}
          {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
          {sectionNodes.length ? <div className="grid gap-3 md:grid-cols-2">{sectionNodes}</div> : null}
        </CardContent>
      </div>

      <CardFooter
        className={cn(
          "p-0 border-t px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300",
          typeMeta.accent.footerBg,
          typeMeta.accent.footerBorder
        )}
        role="button"
        tabIndex={0}
        onClick={handleToggleDetails}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleToggleDetails();
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
              date: formatDate(project.updated_at ?? project.created_at, locale),
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
    </Card>
  );
}
