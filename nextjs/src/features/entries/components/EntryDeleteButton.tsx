"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";

import { useDeleteEntry } from "@entries/hooks/useDeleteEntry";

type EntryDeleteButtonProps = {
  entryId: string;
  onDeleted?: () => void;
};

export function EntryDeleteButton({ entryId, onDeleted }: EntryDeleteButtonProps) {
  const { t } = useI18n();
  const { show } = useToast();
  const { deleteEntry, loading, error, setError } = useDeleteEntry();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await deleteEntry(entryId);
      show({ title: t("entries.deleteSuccess"), variant: "success" });
      setError("");
      setConfirmOpen(false);
      onDeleted?.();
    } catch (err: any) {
      const fallback = t("entries.deleteFailed");
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
        {loading ? t("common.deleting") : t("entries.deleteEntry")}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setError("");
          }
        }}
        title={t("entries.confirmDeleteTitle")}
        description={t("entries.confirmDeleteDesc")}
        confirmText={t("entries.deleteEntry")}
        cancelText={t("common.cancel")}
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

export default EntryDeleteButton;
