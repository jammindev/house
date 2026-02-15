"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectGroupWithMetrics } from "@project-groups/types";
import ProjectGroupCard from "@project-groups/components/ProjectGroupCard";

interface ProjectGroupListProps {
  groups: ProjectGroupWithMetrics[];
}

export default function ProjectGroupList({ groups }: ProjectGroupListProps) {
  const { t } = useI18n();

  if (!groups.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        {t("projectGroups.emptyState")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <ProjectGroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}
