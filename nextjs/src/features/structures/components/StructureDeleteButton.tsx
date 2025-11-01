"use client";

import { useRouter } from "next/navigation";

import DeleteWithConfirmButton from "@/components/DeleteWithConfirmButton";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Structure } from "@structures/types";

type StructureDeleteButtonProps = {
  structure: Structure;
  onDelete: () => Promise<void>;
  onDeleted?: () => void;
};

export default function StructureDeleteButton({ structure, onDelete, onDeleted }: StructureDeleteButtonProps) {
  const router = useRouter();
  const { t } = useI18n();
  const structureName = structure.name?.trim() || t("structures.unnamedStructure");

  const handleSuccess = () => {
    onDeleted?.();
    router.push("/app/repertoire?view=structures&deleted=1");
  };

  return (
    <DeleteWithConfirmButton
      onConfirm={onDelete}
      onSuccess={handleSuccess}
      buttonLabel={t("structures.deleteStructure")}
      loadingLabel={t("common.deleting")}
      confirmTitle={t("structures.deleteTitle")}
      confirmDescription={t("structures.deleteDescription", { name: structureName })}
      confirmActionLabel={t("structures.deleteConfirmCta")}
      cancelLabel={t("common.cancel")}
      successToast={{ title: t("structures.deleteSuccess"), variant: "success" }}
      errorFallback={t("structures.deleteFailed")}
    />
  );
}
