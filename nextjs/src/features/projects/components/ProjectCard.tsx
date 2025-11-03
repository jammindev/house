// nextjs/src/features/projects/components/ProjectCard.tsx
"use client";

import Link from "next/link";
import { CalendarClock, CheckCircle2, FileText, FolderKanban, TriangleAlert } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { ProjectWithMetrics } from "@projects/types";
import ProjectStatusBadge from "@projects/components/ProjectStatusBadge";

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

  return (
    <Link href={`/app/projects/${project.id}`} className="block">
      <Card className="flex flex-col border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">{project.title}</h3>
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (project.group) {
                        window.location.href = `/app/project-groups/${project.group.id}`;
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:text-primary-700 cursor-pointer border-0 outline-none hover:bg-slate-200 transition-colors"
                  >
                    <FolderKanban className="h-4 w-4" />
                    {typeof project.group.projectsCount === "number"
                      ? `${project.group.projectsCount} ${project.group.name}`
                      : project.group.name}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs uppercase text-slate-500">{t("projects.fields.dueDate")}</span>
              <div className="text-sm font-medium text-slate-800">{formatDate(project.due_date, locale)}</div>
            </div>
          </div>

          {project.description ? (
            <p className="text-sm text-slate-600 line-clamp-3">{project.description}</p>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-col gap-4 text-sm text-slate-700">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-500" />
              <div className="flex flex-col leading-tight">
                <span className="text-xs uppercase text-slate-500">{t("projects.fields.startDate")}</span>
                <span className="font-medium">{formatDate(project.start_date, locale)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-slate-500" />
              <div className="flex flex-col leading-tight">
                <span className="text-xs uppercase text-slate-500">{t("projects.metrics.tasks")}</span>
                <span className="font-medium">{t("projects.metrics.tasksSummary", { open: openTodos, done: doneTodos })}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <div className="flex flex-col leading-tight">
                <span className="text-xs uppercase text-slate-500">{t("projects.metrics.documents")}</span>
                <span className="font-medium">{documentsCount}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col">
              <span className="text-xs uppercase text-slate-500">{t("projects.metrics.budgetPlanned")}</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(project.planned_budget ?? 0, locale)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase text-slate-500">{t("projects.metrics.budgetActual")}</span>
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

          {project.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-slate-100 bg-slate-50">
          <div className="text-xs text-slate-500">
            {t("projects.updatedAt", {
              date: formatDate(project.updated_at ?? project.created_at, locale),
            })}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
