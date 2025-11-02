"use client";

import { useRouter } from "next/navigation";

import DeleteWithConfirmButton from "@/components/DeleteWithConfirmButton";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useDeleteProject } from "@projects/hooks/useDeleteProject";
import type { ProjectWithMetrics } from "@projects/types";

type ProjectDeleteButtonProps = {
  project: ProjectWithMetrics;
  onDeleted?: () => void;
};

export default function ProjectDeleteButton({ project, onDeleted }: ProjectDeleteButtonProps) {
  const router = useRouter();
  const { t } = useI18n();
  const deleteProject = useDeleteProject();
  const projectName = project.title || t("projects.untitledProject");

  const handleSuccess = () => {
    onDeleted?.();
    router.push("/app/projects?deleted=1");
  };

  return (
    <DeleteWithConfirmButton
      onConfirm={() => deleteProject(project.id)}
      onSuccess={handleSuccess}
      buttonLabel={t("projects.deleteProject")}
      loadingLabel={t("common.deleting")}
      confirmTitle={t("projects.deleteTitle")}
      confirmDescription={t("projects.deleteDescription", { name: projectName })}
      confirmActionLabel={t("projects.deleteConfirmCta")}
      cancelLabel={t("common.cancel")}
      successToast={{ title: t("projects.deleteSuccess"), variant: "success" }}
      errorFallback={t("projects.deleteFailed")}
    />
  );
}

