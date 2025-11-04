"use client";

import Link from "next/link";
import { Clock, CheckCircle2, Folder, Calendar, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n/I18nProvider";

import type { DashboardTask } from "@dashboard/types";

type DashboardProject = {
    id: string;
    title: string;
    status: string;
    progress?: number;
    total_tasks?: number;
    completed_tasks?: number;
    due_date?: string | null;
};

type DashboardInProgressPanelProps = {
    activeTasks: DashboardTask[];
    activeProjects: DashboardProject[];
    loading?: boolean;
};

const formatDate = (value: string | null, locale: string) => {
    if (!value) return null;
    try {
        return new Intl.DateTimeFormat(locale, {
            month: "short",
            day: "numeric",
        }).format(new Date(value));
    } catch {
        return value;
    }
};

export default function DashboardInProgressPanel({
    activeTasks,
    activeProjects,
    loading = false
}: DashboardInProgressPanelProps) {
    const { locale, t } = useI18n();

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary-600" />
                        <CardTitle className="text-lg">{t("dashboard.inProgress.title")}</CardTitle>
                    </div>
                    <CardDescription>{t("dashboard.inProgress.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="h-16 w-full animate-pulse rounded-lg bg-slate-200" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    const hasContent = activeTasks.length > 0 || activeProjects.length > 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary-600" />
                    <CardTitle className="text-lg">{t("dashboard.inProgress.title")}</CardTitle>
                </div>
                <CardDescription>{t("dashboard.inProgress.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
                {!hasContent ? (
                    <div className="text-center py-8">
                        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-4">
                            {t("dashboard.inProgress.empty")}
                        </p>
                        <Link href="/app/interactions/new/todo">
                            <Button size="sm">
                                {t("dashboard.inProgress.createTask")}
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Tâches actives */}
                        {activeTasks.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-sm text-foreground">
                                        {t("dashboard.inProgress.activeTasks")} ({activeTasks.length})
                                    </h4>
                                    <Link href="/app/tasks">
                                        <Button variant="ghost" size="sm" className="h-auto p-1">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t("dashboard.inProgress.sortedByLastUpdate")}
                                </p>
                                <div className="space-y-2">
                                    {activeTasks.slice(0, 3).map((task) => {
                                        const dueLabel = formatDate(task.occurred_at, locale);
                                        return (
                                            <div key={task.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-white">
                                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                    <Link
                                                        href={`/app/interactions/${task.id}`}
                                                        className="text-sm font-medium text-foreground hover:text-primary-600 block truncate"
                                                    >
                                                        {task.subject}
                                                    </Link>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                                                            {t(`interactionsstatus.${task.status || 'pending'}`)}
                                                        </Badge>
                                                        {dueLabel && (
                                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {dueLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {activeTasks.length > 3 && (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                            {t("dashboard.inProgress.moreTasks", { count: activeTasks.length - 3 })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Projets actifs */}
                        {activeProjects.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-sm text-foreground">
                                        {t("dashboard.inProgress.activeProjects")} ({activeProjects.length})
                                    </h4>
                                    <Link href="/app/projects">
                                        <Button variant="ghost" size="sm" className="h-auto p-1">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t("dashboard.inProgress.sortedByLastUpdate")}
                                </p>
                                <div className="space-y-2">
                                    {activeProjects.slice(0, 2).map((project) => {
                                        const progress = project.completed_tasks && project.total_tasks
                                            ? Math.round((project.completed_tasks / project.total_tasks) * 100)
                                            : 0;
                                        const dueLabel = formatDate(project.due_date ?? null, locale);

                                        return (
                                            <div key={project.id} className="p-3 border border-slate-200 rounded-lg bg-white">
                                                <div className="flex items-start gap-3">
                                                    <Folder className="h-4 w-4 text-primary-600 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <Link
                                                            href={`/app/projects/${project.id}`}
                                                            className="text-sm font-medium text-foreground hover:text-primary-600 block"
                                                        >
                                                            {project.title}
                                                        </Link>
                                                        {project.total_tasks && project.total_tasks > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className="text-muted-foreground">
                                                                        {t("dashboard.inProgress.projectProgress", {
                                                                            completed: project.completed_tasks || 0,
                                                                            total: project.total_tasks
                                                                        })}
                                                                    </span>
                                                                    <span className="text-muted-foreground">{progress}%</span>
                                                                </div>
                                                                <Progress value={progress} className="h-1" />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                                                {t(`projectstatus.${project.status}`)}
                                                            </Badge>
                                                            {dueLabel && (
                                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {dueLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {activeProjects.length > 2 && (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                            {t("dashboard.inProgress.moreProjects", { count: activeProjects.length - 2 })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}