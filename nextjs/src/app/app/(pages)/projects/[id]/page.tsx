// nextjs/src/app/app/projects/[id]/page.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ClipboardList, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import ProjectDetailView from "@projects/components/ProjectDetailView";
import ProjectLinkInteractionModal from "@projects/components/ProjectLinkInteractionModal";
import ProjectPinButton from "@projects/components/ProjectPinButton";
import { useProject } from "@projects/hooks/useProject";
import { useProjectInteractions } from "@projects/hooks/useProjectInteractions";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import { SheetDialog } from "@/components/ui/sheet-dialog";
import AddProjectInteraction from "@projects/components/AddProjectInteraction";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { project, relatedProjects, loading, error, reload: reloadProject } = useProject(id);
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
  const projectSubtitleParts = project
    ? [
      project.group ? project.group.name : null,
      statusLabel ?? null,
    ].filter((part): part is string => Boolean(part))
    : [];
  const projectSubtitle = projectSubtitleParts.length ? projectSubtitleParts.join(" • ") : undefined;
  const isLoading = loading || interactionsLoading;
  const combinedError = error || interactionsError || null;
  const isNotFound = !isLoading && (!id || !project);

  const actions = useMemo(
    () =>
      project
        ? [
          {
            element: (
              <ProjectPinButton
                projectId={project.id}
                isPinned={project.is_pinned}
                onPinnedChange={handleRefresh}
              />
            ),
          },
          {
            icon: Pencil,
            href: `/app/projects/${project.id}/edit`,
            label: t("projects.editTitle"),
          } as const,
          {
            element: (
              <SheetDialog
                title={t("projects.quickActions.title")}
                description={t("projects.quickActions.subtitle")}
                trigger={(
                  <Button
                    variant="default"
                    size="icon"
                    aria-label={t("projects.quickActions.triggerLabel")}
                    className="shadow-sm"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                )}
              >
                  {({ close }) => (
                    <AddProjectInteraction
                      projectId={project.id}
                      onLinkExisting={() => {
                        close();
                        setLinkOpen(true);
                      }}
                      showHeader={false}
                    />
                  )}
                </SheetDialog>
              ),
          },
        ]
        : undefined,
    [handleRefresh, project, setLinkOpen, t]
  );

  return (
    <DetailPageLayout
      title={project ? project.title : t("projects.notFound")}
      context={project ? undefined : statusLabel}
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
              <LinkWithOverlay href="/app/projects">{t("projects.title")}</LinkWithOverlay>
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
            relatedProjects={relatedProjects}
            interactionsData={{ interactions, documentsByInteraction, tasks, expenses, documents }}
            onRefresh={handleRefresh}
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
