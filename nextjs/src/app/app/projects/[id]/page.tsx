// nextjs/src/app/app/projects/[id]/page.tsx
"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import AppPageLayout from "@/components/layout/AppPageLayout";
import ProjectDetailView from "@projects/components/ProjectDetailView";
import ProjectLinkInteractionModal from "@projects/components/ProjectLinkInteractionModal";
import { useProject } from "@projects/hooks/useProject";
import { useProjectInteractions } from "@projects/hooks/useProjectInteractions";
import { Pencil } from "lucide-react";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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

  const statusLabel = project.status ? t(`projects.status.${project.status}`) : undefined;

  return (
    <>
      <AppPageLayout
        title={project.title}
        context={statusLabel}
        className="max-w-5xl"
        contentClassName="flex flex-col gap-6 pb-10"
        actions={[{ icon: Pencil, onClick: () => router.push(`/app/projects/${project.id}/edit`), variant: "secondary" }]}

      >
        <ProjectDetailView
          project={project}
          interactionsData={{ interactions, documentsByInteraction, tasks, expenses, documents }}
          onRefresh={handleRefresh}
          onLinkExisting={() => setLinkOpen(true)}
        />
      </AppPageLayout >

      <ProjectLinkInteractionModal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        projectId={project.id}
        onLinked={handleRefresh}
      />
    </>
  );
}
