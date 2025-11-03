"use client";

import Link from "next/link";
import { CalendarClock, CheckCircle2, FileText, FolderKanban, TriangleAlert, ArrowRight, Folder } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import HorizontalScrollContainer from "@/components/ui/HorizontalScrollContainer";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { ProjectWithMetrics } from "@projects/types";
import ProjectStatusBadge from "@projects/components/ProjectStatusBadge";

interface DashboardProjectsInProgressProps {
    projects: ProjectWithMetrics[];
    loading?: boolean;
}

const formatCurrency = (value: number, locale: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);

const formatDate = (value: string | null, locale: string) => {
    if (!value) return "—";
    try {
        return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(value));
    } catch {
        return value;
    }
};

export default function DashboardProjectsInProgress({ projects, loading = false }: DashboardProjectsInProgressProps) {
    const { locale, t } = useI18n();

    if (loading) {
        return (
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Folder className="h-5 w-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-foreground">{t("dashboard.projectsInProgress.title")}</h2>
                    </div>
                    <Link href="/app/projects">
                        <Button variant="ghost" size="sm" className="flex items-center gap-1">
                            {t("dashboard.actions.viewProjects")}
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
                <HorizontalScrollContainer className="py-1" itemWidth="w-72">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-32 w-full animate-pulse rounded-lg bg-slate-200" />
                    ))}
                </HorizontalScrollContainer>
            </section>
        );
    }

    if (projects.length === 0) {
        return (
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Folder className="h-5 w-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-foreground">{t("dashboard.projectsInProgress.title")}</h2>
                    </div>
                    <Link href="/app/projects/new">
                        <Button size="sm" className="flex items-center gap-1">
                            {t("dashboard.projectsInProgress.createFirst")}
                        </Button>
                    </Link>
                </div>
                <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                        {t("dashboard.projectsInProgress.empty")}
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Folder className="h-5 w-5 text-primary-600" />
                    <h2 className="text-lg font-semibold text-foreground">{t("dashboard.projectsInProgress.title")}</h2>
                </div>
                <Link href="/app/projects">
                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                        {t("dashboard.actions.viewProjects")}
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
            <p className="text-sm text-muted-foreground">{t("dashboard.projectsInProgress.subtitle")}</p>

            <HorizontalScrollContainer className="py-1" itemWidth="w-72">
                {projects.slice(0, 4).map((project) => {
                    const metrics = project.metrics;
                    const openTodos = metrics?.open_todos ?? 0;
                    const doneTodos = metrics?.done_todos ?? 0;
                    const documentsCount = metrics?.documents_count ?? 0;

                    return (
                        <Link key={project.id} href={`/app/projects/${project.id}`} className="block">
                            <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.02] h-full">
                                <CardHeader className="space-y-2 sm:space-y-3 pb-2 sm:pb-3 p-3 sm:p-6">
                                    <div className="flex items-start justify-between gap-1 sm:gap-2">
                                        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 flex-1 leading-tight">
                                            {project.title}
                                        </h3>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs text-slate-500">{formatDate(project.due_date, locale)}</div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1 sm:gap-2 items-center">
                                        <ProjectStatusBadge status={project.status} />
                                        {project.isOverdue ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-1.5 sm:px-2 py-0.5 text-xs font-medium text-rose-700">
                                                <TriangleAlert className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                <span className="hidden sm:inline">{t("projects.badges.overdue")}</span>
                                            </span>
                                        ) : null}
                                        {!project.isOverdue && project.isDueSoon ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 sm:px-2 py-0.5 text-xs font-medium text-amber-700">
                                                <CalendarClock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                <span className="hidden sm:inline">{t("projects.badges.dueSoon")}</span>
                                            </span>
                                        ) : null}
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-2 sm:space-y-3 pt-0 p-3 sm:p-6 sm:pt-0">
                                    {project.description ? (
                                        <p className="text-xs text-slate-600 line-clamp-1 sm:line-clamp-2 hidden sm:block">{project.description}</p>
                                    ) : null}

                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1">
                                            <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-500" />
                                            <span className="text-slate-600">{openTodos + doneTodos}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <FileText className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-500" />
                                            <span className="text-slate-600">{documentsCount}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="text-xs">
                                            <div className="text-slate-500 hidden sm:block">Budget</div>
                                            <div className="font-medium text-slate-700 text-xs">
                                                {formatCurrency(project.planned_budget ?? 0, locale)}
                                            </div>
                                        </div>
                                        <div className="text-xs text-right">
                                            <div className="text-slate-500 hidden sm:block">Dépensé</div>
                                            <div
                                                className={cn(
                                                    "font-medium text-xs",
                                                    project.actual_cost_cached > project.planned_budget ? "text-rose-600" : "text-emerald-700"
                                                )}
                                            >
                                                {formatCurrency(project.actual_cost_cached ?? 0, locale)}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </HorizontalScrollContainer>

            {projects.length > 4 && (
                <div className="text-center">
                    <Link href="/app/projects">
                        <Button variant="outline" size="sm">
                            {t("dashboard.projectsInProgress.viewMore", { count: projects.length - 4 })}
                        </Button>
                    </Link>
                </div>
            )}
        </section>
    );
}