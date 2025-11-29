// nextjs/src/features/projects/components/ProjectDetailHeader.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Coins, FolderKanban, Pin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createSPASassClientAuthenticated as createSPASassClient } from "@/lib/supabase/client";
import type { ProjectStatus, ProjectWithMetrics } from "@projects/types";
import { PROJECT_STATUSES, PROJECT_TYPE_META } from "@projects/constants";
import { useToast } from "@/components/ToastProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { cn } from "@/lib/utils";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import CollapsibleSectionToggle from "@/components/layout/CollapsibleSectionToggle";
import ProjectStatusSheet from "@projects/components/ProjectStatusSheet";
import CountBadge from "@/components/ui/CountBadge";

interface ProjectDetailHeaderProps {
  project: ProjectWithMetrics;
  onProjectChanged?: () => void;
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
}: ProjectDetailHeaderProps) {
  const { selectedHouseholdId: householdId } = useGlobal();
  const { t, locale } = useI18n();
  const { show } = useToast();
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [updating, setUpdating] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(true);
  const typeMeta = PROJECT_TYPE_META[project.type] ?? PROJECT_TYPE_META.other;
  // const helperText = t(typeMeta.helperKey);
  const helperText = null;

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
  const metricsDetailsId = `project-detail-metrics-${project.id}`;
  const metricsCollapsedLabel = t("projects.metrics.toggleCollapsed");
  const metricsExpandedLabel = t("projects.metrics.toggleExpanded");

  return (
    <Card className="border border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="space-y-6 p-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {project.is_pinned ? (
                <CountBadge
                  icon={<Pin className="h-3.5 w-3.5" />}
                  display="inline"
                  tone="none"
                  className="border-primary-100 bg-primary-50 text-primary-700"
                />
              ) : null}
              <ProjectStatusSheet
                className="shrink-0"
                status={status}
                options={statusOptions}
                disabled={updating}
                onSelect={handleStatusChange}
              />
              <CountBadge
                label={t(typeMeta.labelKey)}
                display="inline"
                tone="none"
                className={cn(typeMeta.accent.badge)}
              />
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
              {project.group ? (
                <LinkWithOverlay
                  href={`/app/project-groups/${project.group.id}`}
                  className="inline-flex"
                >
                  <CountBadge
                    icon={<FolderKanban className="h-4 w-4" />}
                    label={
                      typeof project.group.projectsCount === "number"
                        ? `${project.group.projectsCount} ${project.group.name}`
                        : project.group.name
                    }
                    display="inline"
                    tone="none"
                    className="border border-slate-200 bg-slate-100 text-slate-600 transition-colors hover:text-primary-700"
                  />
                </LinkWithOverlay>
              ) : null}
            </div>
            {project.description ? (
              <p className="max-w-3xl text-sm text-slate-600 whitespace-pre-line">{project.description}</p>
            ) : null}
            {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
            {project.tags.length > 0 && <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  #{tag}
                </span>
              ))}
            </div>}
          </div>
        </div>
      </CardContent>
      <div id={metricsDetailsId} hidden={metricsCollapsed}>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
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

            <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
                <CalendarDays className="h-4 w-4" />
                {t("projects.metrics.schedule")}
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
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

            <div className="space-y-2 rounded-lg border border-slate-200 bg-white/80 p-4">
              <div className="text-xs uppercase text-slate-500">{t("projects.metrics.summary")}</div>
              <div className="text-sm text-slate-600">
                {t("projects.metrics.tasksSummary", { open: openTodos, done: doneTodos })}
              </div>
              <div className="text-sm text-slate-600">
                {t("projects.metrics.documentsCount", { count: documentsCount })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CollapsibleSectionToggle
        isCollapsed={metricsCollapsed}
        onToggle={() => setMetricsCollapsed((prev) => !prev)}
        detailsId={metricsDetailsId}
        collapsedLabel={metricsCollapsedLabel}
        expandedLabel={metricsExpandedLabel}
        label={({ isCollapsed }) => (isCollapsed ? metricsCollapsedLabel : metricsExpandedLabel)}
        className={cn("border-t", typeMeta.accent.footerBg, typeMeta.accent.footerBorder)}
      />
    </Card>
  );
}
