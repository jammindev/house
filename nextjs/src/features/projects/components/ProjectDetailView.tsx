// nextjs/src/features/projects/components/ProjectDetailView.tsx
"use client";

import { useState } from "react";

import AuditHistoryCard from "@/components/AuditHistoryCard";
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

interface ProjectDetailViewProps {
  project: ProjectWithMetrics;
  interactionsData: ProjectInteractionSummary;
  onRefresh?: () => void;
  onLinkExisting?: () => void;
}

const TABS = ["timeline", "tasks", "documents", "expenses"] as const;

export default function ProjectDetailView({
  project,
  interactionsData,
  onRefresh,
  onLinkExisting,
}: ProjectDetailViewProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<typeof TABS[number]>("timeline");
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

  return (
    <div className="space-y-6 pb-10">
      <ProjectDetailHeader project={project} onProjectChanged={onRefresh} onLinkExisting={onLinkExisting} />

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

          <div className="p-6">
            {tab === "timeline" ? (
              <ProjectTimeline
                interactions={interactionsData.interactions}
                documentsByInteraction={interactionsData.documentsByInteraction}
              />
            ) : null}
            {tab === "tasks" ? <ProjectTasksPanel tasks={interactionsData.tasks} /> : null}
            {tab === "documents" ? <ProjectDocumentsPanel documents={interactionsData.documents} /> : null}
            {tab === "expenses" ? <ProjectExpensesPanel expenses={interactionsData.expenses} /> : null}
          </div>
        </CardContent>
      </Card>

      <AuditHistoryCard
        lines={auditLines}
        actions={<ProjectDeleteButton project={project} onDeleted={onRefresh} />}
      />
    </div>
  );
}
