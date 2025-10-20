"use client";

import { useParams, useRouter } from "next/navigation";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ProjectForm from "@projects/components/ProjectForm";
import { useProject } from "@projects/hooks/useProject";

export default function ProjectEditPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();

  const projectIdParam = params?.id;
  const projectId = Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam ?? "";

  const { project, loading, error } = useProject(projectId);

  const title = t("projects.editTitle");
  const subtitle = t("projects.editSubtitle");

  let content: JSX.Element;

  if (!projectId) {
    content = (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("projects.notFound")}</div>
    );
  } else if (!selectedHouseholdId) {
    content = (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        {t("projects.householdRequired")}
      </div>
    );
  } else if (loading) {
    content = <div className="text-sm text-slate-600">{t("common.loading")}</div>;
  } else if (error) {
    content = <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  } else if (!project) {
    content = (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("projects.notFound")}</div>
    );
  } else {
    content = (
      <ProjectForm
        project={project}
        mode="edit"
        onSuccess={(updatedId) => {
          router.push(`/app/projects/${updatedId}`);
        }}
      />
    );
  }

  return (
    <AppPageLayout title={title} subtitle={subtitle} contentClassName="mt-4 px-4 pb-6 sm:px-0">
      {content}
    </AppPageLayout>
  );
}
