"use client";

import { CalendarDays, CheckCircle2, Folder } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

import type { DashboardTask } from "@dashboard/types";

const STATUS_VARIANTS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-sky-100 text-sky-700",
  done: "bg-emerald-100 text-emerald-700",
  archived: "bg-slate-100 text-slate-600",
};

const DUE_STATUS_VARIANTS: Record<string, string> = {
  overdue: "bg-rose-100 text-rose-700",
  dueSoon: "bg-amber-100 text-amber-700",
};

type DashboardTasksPanelProps = {
  tasks: DashboardTask[];
  loading?: boolean;
};

const formatDate = (value: string | null, locale: string) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const computeDueStatus = (value: string | null) => {
  if (!value) return null;
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return "overdue" as const;
  }

  const diffInMs = dueDate.getTime() - today.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  if (diffInDays <= 7) {
    return "dueSoon" as const;
  }

  return null;
};

export default function DashboardTasksPanel({ tasks, loading = false }: DashboardTasksPanelProps) {
  const { locale, t } = useI18n();

  return (
    <Card aria-labelledby="dashboard-tasks">
      <CardHeader>
        <CardTitle id="dashboard-tasks" className="text-lg font-semibold text-slate-900">
          {t("dashboard.sections.tasks")}
        </CardTitle>
        <CardDescription>{t("dashboard.tasks.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div data-testid="tasks-loading" className="space-y-3" aria-live="polite">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 w-full animate-pulse rounded-lg bg-slate-200" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-slate-600" role="status">
            {t("dashboard.tasks.empty")}
          </p>
        ) : (
          <ul className="space-y-4" aria-live="polite">
            {tasks.map((task) => {
              const dueLabel = formatDate(task.occurred_at, locale);
              const statusKey = task.status ?? "pending";
              const badgeClass = STATUS_VARIANTS[statusKey] ?? STATUS_VARIANTS.pending;
              const dueStatus = computeDueStatus(task.occurred_at);
              const dueStatusClass = dueStatus ? DUE_STATUS_VARIANTS[dueStatus] : null;
              return (
                <li key={task.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <LinkWithOverlay
                          href={`/app/interactions/${task.id}`}
                          className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                        >
                          {task.subject}
                        </LinkWithOverlay>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <Badge variant="outline" className={badgeClass}>
                            {t(`interactionsstatus.${statusKey}`)}
                          </Badge>
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                            {dueLabel
                              ? t("dashboard.tasks.dueOn", { date: dueLabel })
                              : t("dashboard.tasks.noDate")}
                          </span>
                          {dueStatus ? (
                            <Badge variant="outline" className={dueStatusClass ?? ""}>
                              {t(`dashboard.status.${dueStatus}`)}
                            </Badge>
                          ) : null}
                          {task.project ? (
                            <span className="inline-flex items-center gap-1">
                              <Folder className="h-3.5 w-3.5" aria-hidden />
                              {task.project.title}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <LinkWithOverlay href="/app/interactions" aria-label={t("dashboard.actions.viewInteractions")}>
          <Button variant="ghost" size="sm" className="flex items-center gap-1">
            {t("dashboard.actions.viewInteractions")}
          </Button>
        </LinkWithOverlay>
      </CardFooter>
    </Card>
  );
}
