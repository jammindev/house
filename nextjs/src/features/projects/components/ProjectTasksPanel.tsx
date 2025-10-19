"use client";

import { useMemo } from "react";
import { CheckCircle2, Clock3, ListTodo } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Interaction } from "@interactions/types";

interface ProjectTasksPanelProps {
  tasks: Interaction[];
}

const STATUS_LABELS: Record<Interaction["status"] | null, { labelKey: string; className: string }> = {
  pending: { labelKey: "projects.tasks.status.pending", className: "bg-amber-100 text-amber-700" },
  in_progress: { labelKey: "projects.tasks.status.inProgress", className: "bg-blue-100 text-blue-700" },
  done: { labelKey: "projects.tasks.status.done", className: "bg-emerald-100 text-emerald-700" },
  archived: { labelKey: "projects.tasks.status.archived", className: "bg-slate-100 text-slate-600" },
  null: { labelKey: "projects.tasks.status.pending", className: "bg-amber-100 text-amber-700" },
};

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function ProjectTasksPanel({ tasks }: ProjectTasksPanelProps) {
  const { t, locale } = useI18n();

  const totals = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "done" && task.status !== "archived").length;
    const done = tasks.filter((task) => task.status === "done").length;
    return { open, done };
  }, [tasks]);

  if (!tasks.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
        {t("projects.tasks.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1">
          <Clock3 className="h-4 w-4 text-amber-600" />
          {t("projects.tasks.openCount", { count: totals.open })}
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {t("projects.tasks.doneCount", { count: totals.done })}
        </div>
      </div>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white shadow-sm">
        {tasks.map((task) => {
          const statusInfo = STATUS_LABELS[task.status ?? null];
          return (
            <li key={task.id} className="p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-900">{task.subject}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusInfo.className}`}>
                      {t(statusInfo.labelKey)}
                    </span>
                  </div>
                  {task.content ? <p className="text-sm text-slate-600">{task.content}</p> : null}
                </div>
                <div className="text-xs text-slate-500">
                  {t("projects.tasks.lastUpdated", { date: formatDate(task.updated_at, locale) })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
