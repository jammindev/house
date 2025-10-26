"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectCard from "@projects/components/ProjectCard";

import type { ProjectWithMetrics } from "@projects/types";

type DashboardProjectsPanelProps = {
  projects: ProjectWithMetrics[];
  loading?: boolean;
};

export default function DashboardProjectsPanel({ projects, loading = false }: DashboardProjectsPanelProps) {
  const { t } = useI18n();

  return (
    <Card aria-labelledby="dashboard-projects">
      <CardHeader>
        <CardTitle id="dashboard-projects" className="text-lg font-semibold text-slate-900">
          {t("dashboard.projects.title")}
        </CardTitle>
        <CardDescription>{t("dashboard.projects.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div data-testid="projects-loading" className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-600" role="status">
            {t("dashboard.projects.empty")}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
