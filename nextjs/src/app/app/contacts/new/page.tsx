// nextjs/src/app/app/contacts/new/page.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ContactCreateForm, { ContactCreateFormValues } from "@contacts/components/ContactCreateForm";
import { useContacts } from "@contacts/hooks/useContacts";

export default function NewContactPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { createContact } = useContacts();

  const [submitError, setSubmitError] = useState("");

  const heading = useMemo(
    () => ({
      title: t("contacts.createTitle"),
      subtitle: t("contacts.createDescription"),
    }),
    [t]
  );

  const handleSubmit = useCallback(
    async (values: ContactCreateFormValues) => {
      if (!selectedHouseholdId) {
        setSubmitError(t("contacts.householdRequired"));
        return;
      }

      try {
        setSubmitError("");
        await createContact({
          householdId: selectedHouseholdId,
          firstName: values.firstName,
          lastName: values.lastName,
          position: values.position,
          notes: values.notes,
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

        router.push("/app/contacts?created=1");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : t("contacts.createFailed");
        setSubmitError(message);
      }
    },
    [createContact, router, selectedHouseholdId, t]
  );

  const handleCancel = useCallback(() => {
    router.push("/app/contacts");
  }, [router]);

  return (
    <AppPageLayout title={heading.title} subtitle={heading.subtitle}>
      {submitError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{submitError}</div>
      )}

      <ContactCreateForm onSubmit={handleSubmit} onCancel={handleCancel} t={t} />
    </AppPageLayout>
  );
}
