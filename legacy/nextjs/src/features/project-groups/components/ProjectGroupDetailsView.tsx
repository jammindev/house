"use client";

import AuditHistoryCard from "@/components/AuditHistoryCard";
import ProjectGroupDeleteButton from "@project-groups/components/ProjectGroupDeleteButton";
import ProjectGroupSummary from "@project-groups/components/ProjectGroupSummary";
import ProjectList from "@projects/components/ProjectList";
import type { ProjectWithMetrics } from "@projects/types";
import type { ProjectGroupWithMetrics } from "@project-groups/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  group: ProjectGroupWithMetrics;
  projects: ProjectWithMetrics[];
  onRefresh?: () => void;
};

export default function ProjectGroupDetailsView({ group, projects, onRefresh }: Props) {
  const { t } = useI18n();
  const auditLines = [
    group.created_at
      ? t("projectGroups.auditCreated", {
        date: new Date(group.created_at).toLocaleString(),
      })
      : null,
    group.updated_at
      ? t("projectGroups.auditUpdated", {
        date: new Date(group.updated_at).toLocaleString(),
      })
      : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="flex flex-col gap-4 pb-10">
      {group.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {group.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
      <ProjectGroupSummary group={group} projects={projects} />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">{t("projectGroups.projectsSection")}</h2>
        <ProjectList projects={projects} hideGroupBadge={true} />
      </div>

      <AuditHistoryCard
        lines={auditLines}
        actions={<ProjectGroupDeleteButton group={group} onDeleted={onRefresh} />}
      />
    </div>
  );
}
