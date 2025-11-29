// nextjs/src/features/projects/components/ProjectDetailView.tsx
"use client";

import { useEffect, useState } from "react";

import AuditHistoryCard from "@/components/AuditHistoryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProjectInteractionSummary } from "@projects/hooks/useProjectInteractions";
import type { ProjectWithMetrics } from "@projects/types";
import ProjectDetailHeader from "@projects/components/ProjectDetailHeader";
import ProjectTimeline from "@projects/components/ProjectTimeline";
import ProjectTasksPanel from "@projects/components/ProjectTasksPanel";
import ProjectDocumentsPanel from "@projects/components/ProjectDocumentsPanel";
import ProjectExpensesPanel from "@projects/components/ProjectExpensesPanel";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectDeleteButton from "@projects/components/ProjectDeleteButton";
import ProjectCard from "@projects/components/project-card/ProjectCard";
import ProjectPinterestEmbed from "@projects/components/ProjectPinterestEmbed";

interface ProjectDetailViewProps {
  project: ProjectWithMetrics;
  relatedProjects?: ProjectWithMetrics[];
  interactionsData: ProjectInteractionSummary;
  onRefresh?: () => void;
}

// const TABS = ["timeline", "tasks", "documents", "expenses", "pinterest"] as const;
const TABS = ["timeline", "tasks", "documents", "expenses"] as const;
const RELATED_PROJECTS_PAGE_SIZE = 3;

export default function ProjectDetailView({
  project,
  relatedProjects = [],
  interactionsData,
  onRefresh,
}: ProjectDetailViewProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<typeof TABS[number]>("timeline");
  const [visibleRelatedCount, setVisibleRelatedCount] = useState(RELATED_PROJECTS_PAGE_SIZE);
  const auditLines = [
    project.created_at
      ? t("projects.auditCreated", {
        date: new Date(project.created_at).toLocaleString(),
      })
      : null,
    project.updated_at
      ? t("projects.auditUpdated", {
        date: new Date(project.updated_at).toLocaleString(),
      })
      : null,
  ].filter((line): line is string => Boolean(line));

  useEffect(() => {
    setVisibleRelatedCount(RELATED_PROJECTS_PAGE_SIZE);
  }, [project.id, relatedProjects.length]);

  const relatedProjectsToShow = relatedProjects.slice(0, visibleRelatedCount);
  const displayedRelatedCount = relatedProjectsToShow.length;
  const hasMoreRelatedProjects = visibleRelatedCount < relatedProjects.length;
  const remainingRelatedProjects = relatedProjects.length - displayedRelatedCount;
  const nextBatchSize = Math.min(RELATED_PROJECTS_PAGE_SIZE, Math.max(remainingRelatedProjects, 0));

  return (
    <div className="space-y-6 pb-10">
      <ProjectDetailHeader project={project} onProjectChanged={onRefresh} />

      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-wrap border-b border-slate-200">
            {TABS.map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setTab(tabKey)}
                className={cn(
                  "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                  tab === tabKey
                    ? "border-b-2 border-primary-600 bg-white text-primary-700"
                    : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {t(`projects.tabs.${tabKey}`)}
              </button>
            ))}
          </div>

          <div className="p-2 min-h-32">
            {tab === "timeline" ? (
              <ProjectTimeline
                projectId={project.id}
              />
            ) : null}
            {tab === "tasks" ? (
              <ProjectTasksPanel
                projectId={project.id}
                projectZones={project.zones?.map(zone => ({
                  id: zone.id,
                  name: zone.name,
                  parent_id: zone.parent_id
                }))}
              />
            ) : null}
            {tab === "documents" ? <ProjectDocumentsPanel documents={interactionsData.documents} /> : null}
            {tab === "expenses" ? <ProjectExpensesPanel expenses={interactionsData.expenses} /> : null}
            {/* {tab === "pinterest" ? <ProjectPinterestEmbed projectId={project.id} /> : null} */}
          </div>
        </CardContent>
      </Card>

      {project.group ? (
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">
                {t("projects.relatedProjects.title", { group: project.group.name })}
              </h2>
              {typeof project.group.projectsCount === "number" ? (
                <p className="text-sm text-slate-500">
                  {t("projects.relatedProjects.count", { count: project.group.projectsCount })}
                </p>
              ) : null}
            </div>

            {relatedProjects.length ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {relatedProjectsToShow.map((relatedProject) => (
                    <ProjectCard key={relatedProject.id} project={relatedProject} />
                  ))}
                </div>

                {relatedProjects.length > RELATED_PROJECTS_PAGE_SIZE ? (
                  <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      {t("projects.relatedProjects.showing", {
                        displayed: displayedRelatedCount,
                        total: relatedProjects.length,
                      })}
                    </p>
                    {hasMoreRelatedProjects ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setVisibleRelatedCount((count) =>
                            Math.min(count + RELATED_PROJECTS_PAGE_SIZE, relatedProjects.length)
                          )
                        }
                      >
                        {t("projects.relatedProjects.loadMore", {
                          count: nextBatchSize,
                        })}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                {t("projects.relatedProjects.empty", { group: project.group.name })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <AuditHistoryCard
        lines={auditLines}
        actions={<ProjectDeleteButton project={project} onDeleted={onRefresh} />}
      />
    </div>
  );
}
