"use client";

import { useRouter } from "next/navigation";

import DeleteWithConfirmButton from "@/components/DeleteWithConfirmButton";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useDeleteProjectGroup } from "@project-groups/hooks/useDeleteProjectGroup";
import type { ProjectGroupWithMetrics } from "@project-groups/types";

type ProjectGroupDeleteButtonProps = {
  group: ProjectGroupWithMetrics;
  onDeleted?: () => void;
};

export default function ProjectGroupDeleteButton({ group, onDeleted }: ProjectGroupDeleteButtonProps) {
  const router = useRouter();
  const { t } = useI18n();
  const deleteGroup = useDeleteProjectGroup();
  const groupName = group.name || t("projectGroups.untitledGroup");

  const handleSuccess = () => {
    onDeleted?.();
    router.push("/app/project-groups?deleted=1");
  };

  return (
    <DeleteWithConfirmButton
      onConfirm={() => deleteGroup(group.id)}
      onSuccess={handleSuccess}
      buttonLabel={t("projectGroups.deleteGroup")}
      loadingLabel={t("common.deleting")}
      confirmTitle={t("projectGroups.deleteTitle")}
      confirmDescription={t("projectGroups.deleteDescription", { name: groupName })}
      confirmActionLabel={t("projectGroups.deleteConfirmCta")}
      cancelLabel={t("common.cancel")}
      successToast={{ title: t("projectGroups.deleteSuccess"), variant: "success" }}
      errorFallback={t("projectGroups.deleteFailed")}
    />
  );
}

