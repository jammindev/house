"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProjectDetailView from "@projects/components/ProjectDetailView";
import ProjectForm from "@projects/components/ProjectForm";
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

  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const handleRefresh = useCallback(() => {
    void reloadProject();
    void reloadInteractions();
  }, [reloadProject, reloadInteractions]);

  if (!id) {
    return <div className="p-6 text-sm text-slate-500">{t("projects.notFound")}</div>;
  }

  if (loading || interactionsLoading) {
    return <div className="p-6 text-sm text-slate-500">{t("common.loading")}</div>;
  }

  if (error || interactionsError) {
    return <div className="p-6 text-sm text-rose-600">{error || interactionsError}</div>;
  }

  if (!project) {
    return <div className="p-6 text-sm text-slate-500">{t("projects.notFound")}</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <ProjectDetailView
        project={project}
        interactionsData={{ interactions, documentsByInteraction, tasks, expenses, documents }}
        onRefresh={handleRefresh}
        onLinkExisting={() => setLinkOpen(true)}
        onEdit={() => setEditOpen(true)}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("projects.editTitle")}</DialogTitle>
          </DialogHeader>
          <ProjectForm
            project={project}
            mode="edit"
            onSuccess={() => {
              setEditOpen(false);
              handleRefresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <ProjectLinkInteractionModal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        projectId={project.id}
        onLinked={handleRefresh}
      />
    </div>
  );
}
