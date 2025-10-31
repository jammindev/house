// nextjs/src/app/app/contacts/new/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ContactCreateForm, { ContactCreateFormValues } from "@contacts/components/ContactCreateForm";
import { useContacts } from "@contacts/hooks/useContacts";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function NewContactPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { createContact } = useContacts();
  const setPageLayoutConfig = usePageLayoutConfig();

  const [submitError, setSubmitError] = useState("");

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

  useEffect(() => {
    setPageLayoutConfig({
      title: t("contacts.createTitle"),
      subtitle: t("contacts.createDescription"),
      context: undefined,
      actions: undefined,
      className: undefined,
      contentClassName: undefined,
      hideBackButton: false,
      loading: false,
    });
  }, [setPageLayoutConfig, t]);

  return (
    <>
      {submitError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{submitError}</div>
      )}

      <ContactCreateForm onSubmit={handleSubmit} onCancel={handleCancel} t={t} />
    </>
  );
}
