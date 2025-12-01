"use client";

import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectWithMetrics } from "@projects/types";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

interface ProjectBudgetBreakdownProps {
    projects: ProjectWithMetrics[];
}

const formatCurrency = (value: number, locale: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);

export default function ProjectBudgetBreakdown({ projects }: ProjectBudgetBreakdownProps) {
    const { t, locale } = useI18n();
    const [isExpanded, setIsExpanded] = useState(false);

    const projectsWithBudget = projects.filter(project =>
        project.planned_budget > 0 || project.actual_cost_cached > 0
    );

    // Calculs des totaux
    const totalPlanned = projectsWithBudget.reduce((sum, project) => sum + project.planned_budget, 0);
    const totalActual = projectsWithBudget.reduce((sum, project) => sum + project.actual_cost_cached, 0);
    const totalDelta = totalActual - totalPlanned;
    const isTotalOverBudget = totalDelta > 0;

    if (projectsWithBudget.length === 0) {
        return null;
    }

    return (
        <Card className="border border-slate-200 bg-slate-50 shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-slate-700">
                        {t("projectGroups.budgetBreakdown.title")}
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="h-8 w-8 p-0"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="pt-0">
                    <div className="space-y-3">
                        {projectsWithBudget.map((project) => {
                            const budgetDelta = project.actual_cost_cached - project.planned_budget;
                            const isOverBudget = budgetDelta > 0;
                            const hasVariance = Math.abs(budgetDelta) > 0.01;

                            return (
                                <div
                                    key={project.id}
                                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <LinkWithOverlay
                                            href={`/app/projects/${project.id}`}
                                            className="block"
                                        >
                                            <h4 className="font-medium text-slate-900 text-sm truncate">
                                                {project.title}
                                            </h4>
                                        </LinkWithOverlay>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                            <span>
                                                {t("projectGroups.budgetBreakdown.planned")}: {formatCurrency(project.planned_budget, locale)}
                                            </span>
                                            <span>
                                                {t("projectGroups.budgetBreakdown.actual")}: {formatCurrency(project.actual_cost_cached, locale)}
                                            </span>
                                        </div>
                                    </div>

                                    {hasVariance && (
                                        <div className="flex items-center gap-1 ml-3">
                                            {isOverBudget ? (
                                                <>
                                                    <TrendingUp className="h-4 w-4 text-rose-500" />
                                                    <span className="text-xs font-medium text-rose-600">
                                                        +{formatCurrency(budgetDelta, locale)}
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <TrendingDown className="h-4 w-4 text-emerald-500" />
                                                    <span className="text-xs font-medium text-emerald-600">
                                                        {formatCurrency(budgetDelta, locale)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">
                        {t("projectGroups.budgetBreakdown.summary", {
                            count: projectsWithBudget.length,
                            total: projects.length
                        })}
                    </div>

                    {/* Total en bas */}
                    <div className="mt-3 pt-3 border-t border-slate-200 bg-slate-50 -mx-4 px-4 py-3 rounded-b-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <h4 className="font-semibold text-slate-900 text-sm">
                                    {t("projectGroups.budgetBreakdown.total")}
                                </h4>
                                <div className="flex items-center gap-4 mt-1 text-xs text-slate-600">
                                    <span>
                                        {t("projectGroups.budgetBreakdown.planned")}: {formatCurrency(totalPlanned, locale)}
                                    </span>
                                    <span>
                                        {t("projectGroups.budgetBreakdown.actual")}: {formatCurrency(totalActual, locale)}
                                    </span>
                                </div>
                            </div>

                            {Math.abs(totalDelta) > 0.01 && (
                                <div className="flex items-center gap-1 ml-3">
                                    {isTotalOverBudget ? (
                                        <>
                                            <TrendingUp className="h-4 w-4 text-rose-500" />
                                            <span className="text-sm font-semibold text-rose-600">
                                                +{formatCurrency(totalDelta, locale)}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <TrendingDown className="h-4 w-4 text-emerald-500" />
                                            <span className="text-sm font-semibold text-emerald-600">
                                                {formatCurrency(totalDelta, locale)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}