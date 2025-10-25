// nextjs/src/features/interactions/components/InteractionDeleteButton.tsx
"use client";

import { useState } from "react";
import { AlertCircle, Trash2 } from "lucide-react";

import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";

import { useDeleteInteraction } from "@interactions/hooks/useDeleteInteraction";

type InteractionDeleteButtonProps = {
  interactionId: string;
  onDeleted?: () => void;
  className?: string;
};

export function InteractionDeleteButton({ interactionId, onDeleted, className }: InteractionDeleteButtonProps) {
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
    } catch (error: unknown) {
      const fallback = t("interactions.deleteFailed");
      const message = error instanceof Error ? error.message : fallback;
      setError(fallback);
      show({ title: fallback, description: message !== fallback ? message : undefined, variant: "error" });
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
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
        {loading ? t("common.deleting") : t("common.delete")}
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
