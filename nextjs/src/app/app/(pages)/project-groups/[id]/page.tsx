// nextjs/src/app/app/(pages)/project-groups/[id]/page.tsx
"use client";

import { useCallback, useEffect } from "react";
import { useParams } from "next/navigation";

import { DEFAULT_PROJECT_FILTERS, useProjects } from "@projects/hooks/useProjects";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useProjectGroup } from "@project-groups/hooks/useProjectGroup";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";
import ProjectGroupDetailsView from "@project-groups/components/ProjectGroupDetailsView";

export default function ProjectGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const setPageLayoutConfig = usePageLayoutConfig();
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

  useEffect(() => {
    const fallbackTitle = isLoading ? t("projectGroups.title") : t("projectGroups.notFound");

    if (!group) {
      setPageLayoutConfig({
        title: fallbackTitle,
        subtitle: undefined,
        context: undefined,
        actions: undefined,
        hideBackButton: false,
        className: "max-w-5xl",
        contentClassName: "flex flex-col gap-6 pb-10",
      });
      return;
    }

    setPageLayoutConfig({
      title: group.name,
      subtitle: group.description || undefined,
      context: undefined,
      actions: undefined,
      hideBackButton: false,
      className: "max-w-5xl",
      contentClassName: "flex flex-col gap-6 pb-10",
    });
  }, [group, isLoading, setPageLayoutConfig, t]);

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

  return <ProjectGroupDetailsView group={group} projects={projects} onRefresh={handleRefresh} />;
}
