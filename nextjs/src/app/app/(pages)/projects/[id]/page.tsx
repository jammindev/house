// nextjs/src/app/app/projects/[id]/page.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, ClipboardList, Pencil, Plus } from "lucide-react";

import { ProjectAIChatSheet } from "@projects/features/ai-chat";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
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
import VisibilityToggleButton from "@shared/components/VisibilityToggleButton";
import { useToast } from "@/components/ToastProvider";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { show } = useToast();
  const { user } = useGlobal();
  const { project, relatedProjects, loading, error, reload: reloadProject } = useProject(id);
  const {
    interactions,
    documentsByInteraction,
    tasks,
    expenses,
    links,
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
          ...(user && project.created_by === user.id ? [{
            element: (
              <VisibilityToggleButton
                entityType="project"
                entityId={project.id}
                isPrivate={project.is_private}
                onToggled={handleRefresh}
                showToast={show}
              />
            ),
          }] : []),
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
            element: (
              <ProjectAIChatSheet
                projectId={project.id}
                projectTitle={project.title}
                trigger={(
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("projects.ai.chatTitle")}
                    className="shadow-sm"
                  >
                    <Bot className="h-5 w-5" />
                  </Button>
                )}
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
                    projectZones={project.zones?.map(zone => ({
                      id: zone.id,
                      name: zone.name,
                      parent_id: zone.parent_id
                    }))}
                    onLinkExisting={() => {
                      close();
                      setLinkOpen(true);
                    }}
                    onInteractionCreated={() => {
                      close();
                      handleRefresh();
                    }}
                    showHeader={false}
                  />
                )}
              </SheetDialog>
            ),
          },
        ]
        : undefined,
    [handleRefresh, project, setLinkOpen, show, t, user]
  );

  return (
    <DetailPageLayout
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
            interactionsData={{ interactions, documentsByInteraction, tasks, expenses, links, documents }}
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
