"use client";

import { FileText, GaugeCircle, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectGroupWithMetrics } from "@project-groups/types";

interface ProjectGroupSummaryProps {
  group: ProjectGroupWithMetrics;
}

const formatCurrency = (value: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);

export default function ProjectGroupSummary({ group }: ProjectGroupSummaryProps) {
  const { t, locale } = useI18n();
  const completionPercent = Math.round(group.completionRate * 100);
  const openTodos = group.metrics?.open_todos ?? 0;
  const doneTodos = group.metrics?.done_todos ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="border border-slate-200 bg-slate-50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-slate-500">{t("projectGroups.summary.budget")}</h3>
          <Wallet className="h-5 w-5 text-slate-500" />
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <div className="flex items-baseline justify-between">
            <span>{t("projectGroups.metrics.plannedBudget")}</span>
            <span className="font-semibold text-slate-900">{formatCurrency(group.plannedBudget, locale)}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span>{t("projectGroups.metrics.actualCost")}</span>
            <span className={group.overBudget ? "font-semibold text-rose-600" : "font-semibold text-emerald-700"}>
              {formatCurrency(group.actualCost, locale)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span>{t("projectGroups.metrics.budgetVariance")}</span>
            <span className={group.budgetDelta > 0 ? "font-semibold text-rose-600" : "font-semibold text-slate-700"}>
              {formatCurrency(group.budgetDelta, locale)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 bg-slate-50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-slate-500">{t("projectGroups.summary.tasks")}</h3>
          <GaugeCircle className="h-5 w-5 text-slate-500" />
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <div className="flex items-baseline justify-between">
            <span>{t("projectGroups.metrics.tasks")}</span>
            <span className="font-semibold text-slate-900">
              {t("projectGroups.metrics.tasksSummary", { open: openTodos, done: doneTodos })}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span>{t("projectGroups.metrics.completion")}</span>
            <span className="font-semibold text-slate-900">{completionPercent}%</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span>{t("projectGroups.metrics.projects")}</span>
            <span className="font-semibold text-slate-900">{group.projectsCount}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 bg-slate-50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-slate-500">{t("projectGroups.summary.documents")}</h3>
          <FileText className="h-5 w-5 text-slate-500" />
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <div className="flex items-baseline justify-between">
            <span>{t("projectGroups.metrics.documents")}</span>
            <span className="font-semibold text-slate-900">
              {t("projectGroups.metrics.documentsCount", { count: group.documentsCount })}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span>{t("projectGroups.summary.updated")}</span>
            <span className="font-semibold text-slate-900">
              {new Intl.DateTimeFormat(locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              }).format(new Date(group.updated_at ?? group.created_at))}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
