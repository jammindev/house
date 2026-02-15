"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
  hideCancel?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  loading = false,
  destructive = false,
  hideCancel = false,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const titleText = title ?? t("common.areYouSure");
  const confirmLabel = confirmText ?? t("common.confirm");
  const cancelLabel = cancelText ?? t("common.cancel");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titleText}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!hideCancel && (
            <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          )}
          <AlertDialogAction
            className={destructive ? "bg-red-600 text-white hover:bg-red-700" : undefined}
            onClick={async () => {
              await onConfirm();
            }}
            disabled={loading}
          >
            {loading ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmDialog;
