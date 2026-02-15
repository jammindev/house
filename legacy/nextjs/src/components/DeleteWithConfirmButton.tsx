// nextjs/src/components/DeleteWithConfirmButton.tsx
"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/ToastProvider";
import { cn } from "@/lib/utils";

type ToastPayload = {
  title: string;
  description?: string;
  variant?: "success" | "error" | "info" | "warning";
};

type DeleteWithConfirmButtonProps = {
  onConfirm: () => Promise<void>;
  onSuccess?: () => void;
  className?: string;
  buttonLabel: string;
  loadingLabel?: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmActionLabel: string;
  cancelLabel: string;
  successToast?: ToastPayload;
  errorToast?: ToastPayload;
  errorFallback?: string;
  icon?: LucideIcon;
};

export default function DeleteWithConfirmButton({
  onConfirm,
  onSuccess,
  className,
  buttonLabel,
  loadingLabel,
  confirmTitle,
  confirmDescription,
  confirmActionLabel,
  cancelLabel,
  successToast,
  errorToast,
  errorFallback = "Action failed",
  icon: Icon = Trash2,
}: DeleteWithConfirmButtonProps) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      await onConfirm();
      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      const caughtMessage = error instanceof Error ? error.message : errorFallback;
      const message = caughtMessage || errorFallback;
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setErrorMessage("");
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}
      <Button type="button" variant="destructive" disabled={loading} onClick={() => handleToggle(true)}>
        <Icon className="h-4 w-4" aria-hidden />
        {loading ? loadingLabel ?? buttonLabel : buttonLabel}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={handleToggle}
        title={confirmTitle}
        description={confirmDescription}
        confirmText={confirmActionLabel}
        cancelText={cancelLabel}
        destructive
        loading={loading}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
