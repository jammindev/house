"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type StructureCreateFormValues = {
  name: string;
  type: string;
  description: string;
  website: string;
  tags: string;
};

const INITIAL_VALUES: StructureCreateFormValues = {
  name: "",
  type: "",
  description: "",
  website: "",
  tags: "",
};

type StructureCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: StructureCreateFormValues) => Promise<void>;
  t: (key: string, values?: Record<string, unknown>) => string;
};

export default function StructureCreateDialog({ open, onOpenChange, onSubmit, t }: StructureCreateDialogProps) {
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StructureCreateFormValues>({
    defaultValues: INITIAL_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(INITIAL_VALUES);
      setSubmitError("");
    }
  }, [open, reset]);

  const onSubmitForm = handleSubmit(async (values) => {
    setSubmitError("");
    if (!values.name.trim()) {
      setError("name", { type: "manual", message: t("structures.nameRequired") });
      return;
    }

    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("structures.createFailed");
      setSubmitError(message);
    }
  });

  const errorMessage = submitError || errors.name?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-0 sm:rounded-lg">
        <form onSubmit={onSubmitForm} className="flex flex-col">
          <DialogHeader className="border-b border-gray-100 px-4 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-gray-900">{t("structures.createTitle")}</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">{t("structures.createDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 flex-col gap-4 px-4 py-4">
            {errorMessage && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{errorMessage}</div>
            )}

            <div className="grid gap-3">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium text-gray-700">
                  {t("structures.name")}
                </label>
                <Input id="name" autoFocus placeholder={t("structures.namePlaceholder")} {...register("name")} />
              </div>

              <div className="grid gap-2">
                <label htmlFor="type" className="text-sm font-medium text-gray-700">
                  {t("structures.type")}
                </label>
                <Input id="type" placeholder={t("structures.typePlaceholder")} {...register("type")} />
              </div>

              <div className="grid gap-2">
                <label htmlFor="website" className="text-sm font-medium text-gray-700">
                  {t("structures.website")}
                </label>
                <Input id="website" placeholder={t("structures.websitePlaceholder")} {...register("website")} />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="tags" className="text-sm font-medium text-gray-700">
                {t("structures.tags")}
              </label>
              <Input id="tags" placeholder={t("structures.tagsPlaceholder")} {...register("tags")} />
            </div>

            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium text-gray-700">
                {t("structures.description")}
              </label>
              <Textarea
                id="description"
                placeholder={t("structures.descriptionPlaceholder")}
                rows={4}
                {...register("description")}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isSubmitting}>
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("structures.saveStructure")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
