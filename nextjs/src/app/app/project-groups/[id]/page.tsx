// nextjs/src/app/app/project-groups/[id]/page.tsx
"use client";

import { useCallback, useMemo } from "react";
import { useParams } from "next/navigation";

import AppPageLayout from "@/components/layout/AppPageLayout";
import ProjectList from "@projects/components/ProjectList";
import { DEFAULT_PROJECT_FILTERS, useProjects } from "@projects/hooks/useProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectGroupSummary from "@project-groups/components/ProjectGroupSummary";
import { useProjectGroup } from "@project-groups/hooks/useProjectGroup";

export default function ProjectGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { group, loading, error, reload } = useProjectGroup(id);
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    reload: reloadProjects,
  } = useProjects({ ...DEFAULT_PROJECT_FILTERS, statuses: undefined, projectGroupId: id ?? null });

  const handleRefresh = useCallback(() => {
    void reload();
    void reloadProjects();
  }, [reload, reloadProjects]);

  const isLoading = loading || projectsLoading;
  const errorMessage = error || projectsError;

  const projectContent = useMemo(() => {
    if (projectsLoading) {
      return (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          {t("common.loading")}
        </div>
      );
    }
    if (projectsError) {
      return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{projectsError}</div>;
    }
    return <ProjectList projects={projects} />;
  }, [projects, projectsError, projectsLoading, t]);

  if (!id) {
    return <div className="p-6 text-sm text-slate-500">{t("projectGroups.notFound")}</div>;
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">{t("common.loading")}</div>;
  }

  if (errorMessage) {
    return <div className="p-6 text-sm text-rose-600">{errorMessage}</div>;
  }

  if (!group) {
    return <div className="p-6 text-sm text-slate-500">{t("projectGroups.notFound")}</div>;
  }

  return (
    <AppPageLayout
      title={group.name}
      subtitle={group.description || undefined}
      className="max-w-5xl"
      contentClassName="flex flex-col gap-6 pb-10"
    >
      <ProjectGroupSummary group={group} />

      {group.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {group.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{t("projectGroups.projectsSection")}</h2>
        <button
          type="button"
          onClick={handleRefresh}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {t("projectGroups.refresh")}
        </button>
      </div>

      {projectContent}
    </AppPageLayout>
  );
}
