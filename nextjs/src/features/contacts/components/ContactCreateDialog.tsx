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

export type ContactCreateFormValues = {
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  emailLabel: string;
  phone: string;
  phoneLabel: string;
  notes: string;
};

const INITIAL_VALUES: ContactCreateFormValues = {
  firstName: "",
  lastName: "",
  position: "",
  email: "",
  emailLabel: "",
  phone: "",
  phoneLabel: "",
  notes: "",
};

type ContactCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ContactCreateFormValues) => Promise<void>;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export default function ContactCreateDialog({ open, onOpenChange, onSubmit, t }: ContactCreateDialogProps) {
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactCreateFormValues>({
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
    const hasName = values.firstName.trim().length > 0 || values.lastName.trim().length > 0;
    if (!hasName) {
      setError("firstName", { type: "manual", message: t("contacts.nameRequired") });
      setError("lastName", { type: "manual", message: t("contacts.nameRequired") });
      return;
    }

    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("contacts.createFailed");
      setSubmitError(message);
    }
  });

  const errorMessage = submitError || errors.firstName?.message || errors.lastName?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-0 sm:rounded-lg">
        <form onSubmit={onSubmitForm} className="flex flex-col">
          <DialogHeader className="border-b border-gray-100 px-4 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-gray-900">{t("contacts.createTitle")}</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">{t("contacts.createDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 flex-col gap-4 px-4 py-4">
            {errorMessage && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{errorMessage}</div>
            )}

            <div className="grid gap-3">
              <div className="grid gap-2">
                <label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                  {t("contacts.firstName")}
                </label>
                <Input
                  id="firstName"
                  autoFocus
                  placeholder={t("contacts.firstNamePlaceholder")}
                  {...register("firstName")}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                  {t("contacts.lastName")}
                </label>
                <Input id="lastName" placeholder={t("contacts.lastNamePlaceholder")} {...register("lastName")} />
              </div>

              <div className="grid gap-2">
                <label htmlFor="position" className="text-sm font-medium text-gray-700">
                  {t("contacts.position")}
                </label>
                <Input id="position" placeholder={t("contacts.positionPlaceholder")} {...register("position")} />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  {t("contacts.email")}
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("contacts.emailPlaceholder")}
                  {...register("email")}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="emailLabel" className="text-sm font-medium text-gray-700">
                  {t("contacts.emailLabel")}
                </label>
                <Input id="emailLabel" placeholder={t("contacts.emailLabelPlaceholder")} {...register("emailLabel")} />
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <label htmlFor="phone" className="text-sm font-medium text-gray-700">
                  {t("contacts.phone")}
                </label>
                <Input id="phone" placeholder={t("contacts.phonePlaceholder")} {...register("phone")} />
              </div>

              <div className="grid gap-2">
                <label htmlFor="phoneLabel" className="text-sm font-medium text-gray-700">
                  {t("contacts.phoneLabel")}
                </label>
                <Input id="phoneLabel" placeholder={t("contacts.phoneLabelPlaceholder")} {...register("phoneLabel")} />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="notes" className="text-sm font-medium text-gray-700">
                {t("contacts.notes")}
              </label>
              <Textarea
                id="notes"
                placeholder={t("contacts.notesPlaceholder")}
                rows={4}
                {...register("notes")}
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
              {isSubmitting ? t("common.saving") : t("contacts.saveContact")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
