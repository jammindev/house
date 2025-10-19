"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Coins, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { ProjectStatus, ProjectWithMetrics } from "@projects/types";
import { PROJECT_STATUSES } from "@projects/constants";
import ProjectStatusBadge from "@projects/components/ProjectStatusBadge";
import ProjectQuickActions from "@projects/components/ProjectQuickActions";
import { useToast } from "@/components/ToastProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { cn } from "@/lib/utils";

interface ProjectDetailHeaderProps {
  project: ProjectWithMetrics;
  onProjectChanged?: () => void;
  onLinkExisting?: () => void;
  onEdit?: () => void;
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

export default function ProjectDetailHeader({
  project,
  onProjectChanged,
  onLinkExisting,
  onEdit,
}: ProjectDetailHeaderProps) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t, locale } = useI18n();
  const { show } = useToast();
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setStatus(project.status);
  }, [project.status]);

  const handleStatusChange = useCallback(
    async (nextStatus: ProjectStatus) => {
      if (!householdId || nextStatus === status) return;
      setUpdating(true);
      try {
        const supa = await createSPASassClient();
        const client = supa.getSupabaseClient();
        const { error } = await client
          .from("projects")
          .update({ status: nextStatus })
          .eq("id", project.id)
          .eq("household_id", householdId);

        if (error) throw error;
        setStatus(nextStatus);
        onProjectChanged?.();
        show({ title: t("projects.statusChange.success"), variant: "success" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("common.unexpectedError");
        show({ title: message, variant: "error" });
      } finally {
        setUpdating(false);
      }
    },
    [householdId, onProjectChanged, project.id, show, status, t]
  );

  const statusOptions = PROJECT_STATUSES;
  const metrics = project.metrics;
  const openTodos = metrics?.open_todos ?? 0;
  const doneTodos = metrics?.done_todos ?? 0;
  const documentsCount = metrics?.documents_count ?? 0;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">{project.title}</h1>
              <ProjectStatusBadge status={status} />
              {project.isOverdue ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-600">
                  {t("projects.badges.overdue")}
                </span>
              ) : null}
              {!project.isOverdue && project.isDueSoon ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                  {t("projects.badges.dueSoon")}
                </span>
              ) : null}
            </div>
            {project.description ? (
              <p className="max-w-3xl text-sm text-slate-600 whitespace-pre-line">{project.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium uppercase text-slate-500">
              {t("projects.fields.status")}
            </label>
            <select
              value={status}
              disabled={updating}
              onChange={(event) => handleStatusChange(event.target.value as ProjectStatus)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`projects.status.${option}`)}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" className="justify-start gap-2 text-slate-600" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              {t("projects.actions.editProject")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
              <Coins className="h-4 w-4" />
              {t("projects.metrics.budget")}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              <div className="flex items-baseline justify-between">
                <span>{t("projects.metrics.planned")}</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(project.planned_budget ?? 0, locale)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
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
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
              <CalendarDays className="h-4 w-4" />
              {t("projects.metrics.schedule")}
            </div>
            <div className="mt-2 text-sm text-slate-600 space-y-1">
              <div className="flex items-center justify-between">
                <span>{t("projects.fields.startDate")}</span>
                <span className="font-medium text-slate-900">{formatDate(project.start_date, locale)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("projects.fields.dueDate")}</span>
                <span className="font-medium text-slate-900">{formatDate(project.due_date, locale)}</span>
              </div>
              {project.closed_at ? (
                <div className="flex items-center justify-between">
                  <span>{t("projects.fields.closedAt")}</span>
                  <span className="font-medium text-slate-900">{formatDate(project.closed_at, locale)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="text-xs uppercase text-slate-500">{t("projects.metrics.summary")}</div>
            <div className="text-sm text-slate-600">{t("projects.metrics.tasksSummary", { open: openTodos, done: doneTodos })}</div>
            <div className="text-sm text-slate-600">
              {t("projects.metrics.documentsCount", { count: documentsCount })}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            {t("projects.quickActions.title")}
          </h2>
          <ProjectQuickActions projectId={project.id} onLinkExisting={onLinkExisting} />
        </div>
      </CardContent>
    </Card>
  );
}
