"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";

import { useDeleteInteraction } from "@interactions/hooks/useDeleteInteraction";

type InteractionDeleteButtonProps = {
  interactionId: string;
  onDeleted?: () => void;
};

export function InteractionDeleteButton({ interactionId, onDeleted }: InteractionDeleteButtonProps) {
  const { t } = useI18n();
  const { show } = useToast();
  const { deleteInteraction, loading, error, setError } = useDeleteInteraction();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await deleteInteraction(interactionId);
      show({ title: t("interactions.deleteSuccess"), variant: "success" });
      setError("");
      setConfirmOpen(false);
      onDeleted?.();
    } catch (err: any) {
      const fallback = t("interactions.deleteFailed");
      const message = err?.message || fallback;
      setError(fallback);
      show({ title: fallback, description: message !== fallback ? message : undefined, variant: "error" });
    }
  };

  return (
    <div className="pt-8 border-t border-gray-200 space-y-3">
      {error && (
        <div className="text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">
          {error}
        </div>
      )}
      <Button
        type="button"
        variant="destructive"
        onClick={() => {
          setError("");
          setConfirmOpen(true);
        }}
        disabled={loading}
      >
        <Trash2 className="w-4 h-4" />
        {loading ? t("common.deleting") : t("interactions.deleteInteraction")}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setError("");
          }
        }}
        title={t("interactions.confirmDeleteTitle")}
        description={t("interactions.confirmDeleteDesc")}
        confirmText={t("interactions.deleteInteraction")}
        cancelText={t("common.cancel")}
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

export default InteractionDeleteButton;
