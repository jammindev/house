// nextjs/src/app/app/(pages)/project-groups/[id]/page.tsx
"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { FolderX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { useProjectsByGroup } from "@projects/hooks/useProjects";
import { useProjectGroup } from "@project-groups/hooks/useProjectGroup";
import ProjectGroupDetailsView from "@project-groups/components/ProjectGroupDetailsView";

export default function ProjectGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { group, loading, error, reload } = useProjectGroup(id);
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    reload: reloadProjects,
  } = useProjectsByGroup(id);

  const handleRefresh = useCallback(() => {
    void reload();
    void reloadProjects();
  }, [reload, reloadProjects]);

  const isLoading = loading || projectsLoading;
  const combinedError = error || projectsError || null;
  const isNotFound = !isLoading && (!id || !group);

  return (
    <DetailPageLayout
      title={group ? group.name : t("projectGroups.notFound")}
      subtitle={group?.description || undefined}
      loading={isLoading}
      error={combinedError}
      errorTitle={t("projectGroups.loadFailed")}
      isNotFound={isNotFound}
      notFoundState={
        <EmptyState
          icon={FolderX}
          title={t("projectGroups.notFound")}
          description={t("projectGroups.createDescription")}
          action={
            <Button asChild variant="outline">
              <LinkWithOverlay href="/app/project-groups">{t("projectGroups.title")}</LinkWithOverlay>
            </Button>
          }
        />
      }
      className="max-w-5xl"
      contentClassName="flex flex-col gap-6 pb-10"
    >
      {group ? <ProjectGroupDetailsView group={group} projects={projects} onRefresh={handleRefresh} /> : null}
    </DetailPageLayout>
  );
}
