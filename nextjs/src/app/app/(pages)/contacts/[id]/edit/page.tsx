// nextjs/src/app/app/contacts/[id]/edit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ToastProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useContacts } from "@contacts/hooks/useContacts";
import { getPrimaryEmail, getPrimaryPhone, formatFullName } from "@contacts/lib/format";
import { useStructures } from "@structures/hooks/useStructures";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

type ContactEditFormValues = {
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  emailLabel: string;
  phone: string;
  phoneLabel: string;
  notes: string;
  structureId: string;
};

export default function ContactEditPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { t } = useI18n();
  const { show } = useToast();
  const { selectedHouseholdId } = useGlobal();
  const setPageLayoutConfig = usePageLayoutConfig();

  const contactIdParam = params?.id;
  const contactId = Array.isArray(contactIdParam) ? contactIdParam[0] : contactIdParam ?? "";

  const {
    contacts,
    loading: contactsLoading,
    error: contactsError,
    updateContact,
  } = useContacts();
  const { structures, loading: structuresLoading, error: structuresError } = useStructures();

  const [submitError, setSubmitError] = useState("");

  const contact = useMemo(
    () => contacts.find((item) => item.id === contactId) ?? null,
    [contacts, contactId]
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactEditFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      position: "",
      email: "",
      emailLabel: "",
      phone: "",
      phoneLabel: "",
      notes: "",
      structureId: "",
    },
  });

  useEffect(() => {
    if (!contact) return;

    const primaryEmail = getPrimaryEmail(contact);
    const primaryPhone = getPrimaryPhone(contact);

    reset({
      firstName: contact.first_name ?? "",
      lastName: contact.last_name ?? "",
      position: contact.position ?? "",
      email: primaryEmail?.email ?? "",
      emailLabel: primaryEmail?.label ?? "",
      phone: primaryPhone?.phone ?? "",
      phoneLabel: primaryPhone?.label ?? "",
      notes: contact.notes ?? "",
      structureId: contact.structure_id ?? "",
    });
  }, [contact, reset]);

  const structureOptions = useMemo(() => {
    return structures.map((structure) => {
      const name = structure.name?.trim().length
        ? structure.name
        : t("structures.unnamedStructure");
      const type = structure.type?.trim();
      return {
        id: structure.id,
        label: type ? `${name} (${type})` : name,
      };
    });
  }, [structures, t]);

  const title = t("contacts.editTitle");
  const subtitle = t("contacts.editSubtitle");
  const context = contact ? formatFullName(contact) || t("contacts.unnamedContact") : undefined;

  useEffect(() => {
    setPageLayoutConfig({
      title,
      subtitle,
      context,
      hideBackButton: false,
      actions: undefined,
      className: undefined,
      contentClassName: undefined,
      loading: false,
    });
  }, [context, setPageLayoutConfig, subtitle, title]);

  const onSubmit = handleSubmit(async (values) => {
    if (!selectedHouseholdId) {
      setSubmitError(t("contacts.householdRequired"));
      return;
    }

    if (!contactId) {
      setSubmitError(t("contacts.notFound"));
      return;
    }

    if (!values.firstName.trim() && !values.lastName.trim()) {
      setError("firstName", { type: "manual", message: t("contacts.nameRequired") });
      setError("lastName", { type: "manual", message: t("contacts.nameRequired") });
      return;
    }

    try {
      setSubmitError("");
      await updateContact({
        contactId,
        householdId: selectedHouseholdId,
        firstName: values.firstName,
        lastName: values.lastName,
        position: values.position,
        notes: values.notes,
        structureId: values.structureId || null,
        email: values.email.trim()
          ? {
            email: values.email,
            label: values.emailLabel,
            is_primary: true,
          }
          : null,
        phone: values.phone.trim()
          ? {
            phone: values.phone,
            label: values.phoneLabel,
            is_primary: true,
          }
          : null,
      });
      router.push("/app/repertoire?view=contacts");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("contacts.updateFailed");
      setSubmitError(message);
    }
  });

  const fieldError = submitError || errors.firstName?.message || errors.lastName?.message;

  if (!contactId) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("contacts.notFound")}</div>;
  }

  if (contactsLoading) {
    return <div className="text-sm text-gray-500">{t("common.loading")}</div>;
  }

  if (contactsError) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{contactsError}</div>;
  }

  if (!contact) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("contacts.notFound")}</div>;
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      {fieldError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{fieldError}</div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="contact-first-name" className="text-sm font-medium text-gray-700">
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
          <label htmlFor="contact-last-name" className="text-sm font-medium text-gray-700">
            {t("contacts.lastName")}
          </label>
          <Input
            id="contact-last-name"
            placeholder={t("contacts.lastNamePlaceholder")}
            {...register("lastName")}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-position" className="text-sm font-medium text-gray-700">
            {t("contacts.position")}
          </label>
          <Input
            id="contact-position"
            placeholder={t("contacts.positionPlaceholder")}
            {...register("position")}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-structure" className="text-sm font-medium text-gray-700">
            {t("contacts.structureLabel")}
          </label>
          <select
            id="contact-structure"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={structuresLoading}
            {...register("structureId")}
          >
            <option value="">{t("contacts.structureNone")}</option>
            {structureOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">{t("contacts.structureHelper")}</p>
          {structuresError ? (
            <p className="text-xs text-red-600">{structuresError}</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="contact-email" className="text-sm font-medium text-gray-700">
            {t("contacts.email")}
          </label>
          <Input id="contact-email" type="email" placeholder={t("contacts.emailPlaceholder")} {...register("email")} />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-email-label" className="text-sm font-medium text-gray-700">
            {t("contacts.emailLabel")}
          </label>
          <Input
            id="contact-email-label"
            placeholder={t("contacts.emailLabelPlaceholder")}
            {...register("emailLabel")}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-phone" className="text-sm font-medium text-gray-700">
            {t("contacts.phone")}
          </label>
          <Input id="contact-phone" placeholder={t("contacts.phonePlaceholder")} {...register("phone")} />
        </div>

        <div className="space-y-2">
          <label htmlFor="contact-phone-label" className="text-sm font-medium text-gray-700">
            {t("contacts.phoneLabel")}
          </label>
          <Input
            id="contact-phone-label"
            placeholder={t("contacts.phoneLabelPlaceholder")}
            {...register("phoneLabel")}
          />
        </div>
      </section>

      <div className="space-y-2">
        <label htmlFor="contact-notes" className="text-sm font-medium text-gray-700">
          {t("contacts.notes")}
        </label>
        <Textarea
          id="contact-notes"
          rows={4}
          placeholder={t("contacts.notesPlaceholder")}
          {...register("notes")}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/app/repertoire?view=contacts")}
          disabled={isSubmitting}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("common.saving") : t("contacts.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
