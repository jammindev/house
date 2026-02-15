"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

type ContactCreateFormProps = {
  onSubmit: (values: ContactCreateFormValues) => Promise<void>;
  onCancel?: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

export default function ContactCreateForm({ onSubmit, onCancel, t }: ContactCreateFormProps) {
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactCreateFormValues>({
    defaultValues: INITIAL_VALUES,
  });

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("contacts.createFailed");
      setSubmitError(message);
    }
  });

  const errorMessage = submitError || errors.firstName?.message || errors.lastName?.message;

  return (
    <form onSubmit={onSubmitForm} className="space-y-6">
      <Card className="border border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold">{t("contacts.createTitle")}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t("contacts.createDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMessage && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{errorMessage}</div>
          )}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="contact-first-name" className="text-sm font-medium text-foreground">
                {t("contacts.firstName")}
              </label>
              <Input
                id="contact-first-name"
                autoFocus
                placeholder={t("contacts.firstNamePlaceholder")}
                {...register("firstName")}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="contact-last-name" className="text-sm font-medium text-foreground">
                {t("contacts.lastName")}
              </label>
              <Input id="contact-last-name" placeholder={t("contacts.lastNamePlaceholder")} {...register("lastName")} />
            </div>

            <div className="space-y-2">
              <label htmlFor="contact-position" className="text-sm font-medium text-foreground">
                {t("contacts.position")}
              </label>
              <Input id="contact-position" placeholder={t("contacts.positionPlaceholder")} {...register("position")} />
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="contact-email" className="text-sm font-medium text-foreground">
                {t("contacts.email")}
              </label>
              <Input id="contact-email" type="email" placeholder={t("contacts.emailPlaceholder")} {...register("email")} />
            </div>

            <div className="space-y-2">
              <label htmlFor="contact-email-label" className="text-sm font-medium text-foreground">
                {t("contacts.emailLabel")}
              </label>
              <Input
                id="contact-email-label"
                placeholder={t("contacts.emailLabelPlaceholder")}
                {...register("emailLabel")}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="contact-phone" className="text-sm font-medium text-foreground">
                {t("contacts.phone")}
              </label>
              <Input id="contact-phone" placeholder={t("contacts.phonePlaceholder")} {...register("phone")} />
            </div>

            <div className="space-y-2">
              <label htmlFor="contact-phone-label" className="text-sm font-medium text-foreground">
                {t("contacts.phoneLabel")}
              </label>
              <Input
                id="contact-phone-label"
                placeholder={t("contacts.phoneLabelPlaceholder")}
                {...register("phoneLabel")}
              />
            </div>
          </section>

          <section className="space-y-2">
            <label htmlFor="contact-notes" className="text-sm font-medium text-foreground">
              {t("contacts.notes")}
            </label>
            <Textarea
              id="contact-notes"
              placeholder={t("contacts.notesPlaceholder")}
              rows={4}
              {...register("notes")}
            />
          </section>
        </CardContent>
        <CardFooter className="flex flex-col justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              {t("common.cancel")}
            </Button>
          ) : null}
          <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("contacts.saveContact")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
