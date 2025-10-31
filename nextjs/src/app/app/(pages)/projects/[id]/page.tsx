// nextjs/src/app/app/projects/[id]/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectDetailView from "@projects/components/ProjectDetailView";
import ProjectLinkInteractionModal from "@projects/components/ProjectLinkInteractionModal";
import { useProject } from "@projects/hooks/useProject";
import { useProjectInteractions } from "@projects/hooks/useProjectInteractions";
import { Pencil } from "lucide-react";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

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
  const setPageLayoutConfig = usePageLayoutConfig();

  const handleRefresh = useCallback(() => {
    void reloadProject();
    void reloadInteractions();
  }, [reloadProject, reloadInteractions]);

  useEffect(() => {
    if (!project) {
      setPageLayoutConfig({
        title: t("projects.notFound"),
        subtitle: undefined,
        context: undefined,
        className: undefined,
        contentClassName: undefined,
        actions: undefined,
        hideBackButton: false,
        loading: false,
      });
      return;
    }

    const statusLabel = project.status ? t(`projects.status.${project.status}`) : undefined;

    setPageLayoutConfig({
      title: project.title,
      subtitle: undefined,
      context: statusLabel,
      className: "max-w-5xl",
      contentClassName: "flex flex-col gap-6 pb-10",
      actions: [
        {
          icon: Pencil,
          onClick: () => router.push(`/app/projects/${project.id}/edit`),
        },
      ],
      hideBackButton: false,
      loading: false,
    });
  }, [project, router, setPageLayoutConfig, t]);

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
  );
}
