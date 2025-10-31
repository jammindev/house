// nextjs/src/app/app/projects/[id]/page.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardList, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import ProjectDetailView from "@projects/components/ProjectDetailView";
import ProjectLinkInteractionModal from "@projects/components/ProjectLinkInteractionModal";
import { useProject } from "@projects/hooks/useProject";
import { useProjectInteractions } from "@projects/hooks/useProjectInteractions";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { project, loading, error, reload: reloadProject } = useProject(id);
  const {
    interactions,
    documentsByInteraction,
    tasks,
    expenses,
    documents,
    loading: interactionsLoading,
    error: interactionsError,
    reload: reloadInteractions,
  } = useProjectInteractions(id);

  const [linkOpen, setLinkOpen] = useState(false);

  const handleRefresh = useCallback(() => {
    void reloadProject();
    void reloadInteractions();
  }, [reloadProject, reloadInteractions]);

  const statusLabel = project?.status ? t(`projects.status.${project.status}`) : undefined;
  const isLoading = loading || interactionsLoading;
  const combinedError = error || interactionsError || null;
  const isNotFound = !isLoading && (!id || !project);

  const actions = useMemo(
    () =>
      project
        ? [
            {
              icon: Pencil,
              href: `/app/projects/${project.id}/edit`,
              label: t("projects.editTitle"),
            } as const,
          ]
        : undefined,
    [project, t]
  );

  return (
    <DetailPageLayout
      title={project ? project.title : t("projects.notFound")}
      subtitle={project ? undefined : t("projects.subtitle")}
      context={statusLabel}
      actions={actions}
      loading={isLoading}
      error={combinedError}
      errorTitle={t("projects.loadFailed")}
      isNotFound={isNotFound}
      notFoundState={
        <EmptyState
          icon={ClipboardList}
          title={t("projects.notFound")}
          description={t("projects.newSubtitle")}
          action={
            <Button asChild variant="outline">
              <Link href="/app/projects">{t("projects.title")}</Link>
            </Button>
          }
        />
      }
      className="max-w-5xl"
      contentClassName="flex flex-col gap-6 pb-10"
    >
      {project ? (
        <>
          <ProjectDetailView
            project={project}
            interactionsData={{ interactions, documentsByInteraction, tasks, expenses, documents }}
            onRefresh={handleRefresh}
            onLinkExisting={() => setLinkOpen(true)}
          />

          <ProjectLinkInteractionModal
            open={linkOpen}
            onOpenChange={setLinkOpen}
            projectId={project.id}
            onLinked={handleRefresh}
          />
        </>
      ) : null}
    </DetailPageLayout>
  );
}
