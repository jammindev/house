"use client";

import Link from "next/link";
import { ArrowRight, FileText, FolderKanban, GaugeCircle } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectGroupWithMetrics } from "@project-groups/types";

interface ProjectGroupCardProps {
  group: ProjectGroupWithMetrics;
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

export default function ProjectGroupCard({ group }: ProjectGroupCardProps) {
  const { t, locale } = useI18n();
  const completionPercent = Math.round(group.completionRate * 100);
  const openTodos = group.metrics?.open_todos ?? 0;
  const doneTodos = group.metrics?.done_todos ?? 0;
  const documentsCount = group.documentsCount;

  return (
    <Card className="flex flex-col border border-slate-200 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">{group.name}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                <FolderKanban className="h-4 w-4" />
                {t("projectGroups.metrics.projects", { count: group.projectsCount })}
              </span>
              {group.overBudget ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 font-medium text-rose-700">
                  {t("projectGroups.badges.overBudget")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase text-slate-500">{t("projectGroups.metrics.completion")}</span>
            <div className="text-sm font-medium text-slate-800">{completionPercent}%</div>
          </div>
        </div>

        {group.description ? (
          <p className="text-sm text-slate-600 line-clamp-3">{group.description}</p>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-sm text-slate-700">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <GaugeCircle className="h-5 w-5 text-slate-500" />
            <div className="flex flex-col">
              <span className="text-xs uppercase text-slate-500">{t("projectGroups.metrics.tasks")}</span>
              <span className="font-medium">
                {t("projectGroups.metrics.tasksSummary", { open: openTodos, done: doneTodos })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            <div className="flex flex-col">
              <span className="text-xs uppercase text-slate-500">{t("projectGroups.metrics.documents")}</span>
              <span className="font-medium">{t("projectGroups.metrics.documentsCount", { count: documentsCount })}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-500">{t("projectGroups.metrics.plannedBudget")}</span>
            <span className="font-semibold text-slate-900">{formatCurrency(group.plannedBudget, locale)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-500">{t("projectGroups.metrics.actualCost")}</span>
            <span
              className={group.overBudget ? "font-semibold text-rose-600" : "font-semibold text-emerald-700"}
            >
              {formatCurrency(group.actualCost, locale)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-slate-500">{t("projectGroups.metrics.budgetVariance")}</span>
            <span className={group.budgetDelta > 0 ? "font-semibold text-rose-600" : "font-semibold text-slate-700"}>
              {formatCurrency(group.budgetDelta, locale)}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-slate-100 bg-slate-50">
        <div className="text-xs text-slate-500">
          {t("projectGroups.updatedAt", { date: formatDate(group.updated_at ?? group.created_at, locale) })}
        </div>
        <Link
          href={`/app/project-groups/${group.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          {t("projectGroups.viewDetails")}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}
