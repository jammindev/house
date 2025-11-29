"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectWithMetrics } from "@projects/types";
import ProjectCard from "@projects/components/project-card/ProjectCard";

interface ProjectListProps {
  projects: ProjectWithMetrics[];
}

export default function ProjectList({ projects }: ProjectListProps) {
  const { t } = useI18n();

  if (!projects.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        {t("projects.emptyState")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
