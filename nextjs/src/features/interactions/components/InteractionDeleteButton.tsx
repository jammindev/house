// nextjs/src/features/interactions/components/InteractionDeleteButton.tsx
"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import DeleteWithConfirmButton from "@/components/DeleteWithConfirmButton";

import { useDeleteInteraction } from "@interactions/hooks/useDeleteInteraction";

type InteractionDeleteButtonProps = {
  interactionId: string;
  onDeleted?: () => void;
  className?: string;
};

export function InteractionDeleteButton({ interactionId, onDeleted, className }: InteractionDeleteButtonProps) {
  const { t } = useI18n();
  const deleteInteraction = useDeleteInteraction();

  return (
    <DeleteWithConfirmButton
      className={className}
      onConfirm={() => deleteInteraction(interactionId)}
      onSuccess={onDeleted}
      buttonLabel={t("common.delete")}
      loadingLabel={t("common.deleting")}
      confirmTitle={t("interactions.confirmDeleteTitle")}
      confirmDescription={t("interactions.confirmDeleteDesc")}
      confirmActionLabel={t("interactions.deleteInteraction")}
      cancelLabel={t("common.cancel")}
      successToast={{ title: t("interactions.deleteSuccess"), variant: "success" }}
      errorFallback={t("interactions.deleteFailed")}
    />
  );
}

export default InteractionDeleteButton;
