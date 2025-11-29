// nextjs/src/features/projects/components/project-card/ProjectCard.tsx
"use client";

import { useState } from "react";
import { useProject } from "@projects/hooks/useProject";

import { Card, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectWithMetrics } from "@projects/types";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { PROJECT_TYPE_META } from "@projects/constants";
import ProjectCardHeader from "@projects/components/project-card/ProjectCardHeader";
import ProjectCardDetails from "@projects/components/project-card/ProjectCardDetails";
import ProjectCardFooter from "@projects/components/project-card/ProjectCardFooter";

interface ProjectCardProps {
  project: ProjectWithMetrics;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const { locale, t } = useI18n();
  const metrics = project.metrics;
  const documentsCount = metrics?.documents_count ?? 0;
  const { interactionsCount } = useProject(project.id);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const detailsId = `project-card-details-${project.id}`;
  const typeMeta = PROJECT_TYPE_META[project.type] ?? PROJECT_TYPE_META.other;
  const helperText = t(typeMeta.helperKey);
  const emptyStateText = typeMeta.emptyStateKey ? t(typeMeta.emptyStateKey) : "";

  const handleToggleDetails = () => {
    setIsCollapsed((prev) => !prev);
  };

  return (
    <Card className="flex flex-col border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <LinkWithOverlay href={`/app/projects/${project.id}`} className="flex flex-col gap-1">
        <CardHeader className="space-y-4">
          <ProjectCardHeader
            project={project}
            typeMeta={typeMeta}
            interactionsCount={interactionsCount}
            documentsCount={documentsCount}
            locale={locale}
            t={t}
          />
        </CardHeader>
      </LinkWithOverlay>
      <div id={detailsId} hidden={isCollapsed}>
        <ProjectCardDetails
          project={project}
          typeMeta={typeMeta}
          locale={locale}
          helperText={helperText}
          emptyStateText={emptyStateText}
          t={t}
        />
      </div>

      <ProjectCardFooter
        isCollapsed={isCollapsed}
        typeMeta={typeMeta}
        detailsId={detailsId}
        locale={locale}
        updatedAt={project.updated_at}
        createdAt={project.created_at}
        t={t}
        onToggle={handleToggleDetails}
      />
    </Card>
  );
}
