// nextjs/src/app/app/contacts/new/page.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import ContactCreateForm, { ContactCreateFormValues } from "@contacts/components/ContactCreateForm";
import { useContacts } from "@contacts/hooks/useContacts";
import ResourcePageShell from "@shared/layout/ResourcePageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function NewContactPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { createContact } = useContacts();

  const [submitError, setSubmitError] = useState("");

  const layoutTitle = useMemo(() => t("contacts.createTitle"), [t]);
  const layoutSubtitle = useMemo(() => t("contacts.createDescription"), [t]);
  const errorTitle = useMemo(() => t("contacts.createFailed"), [t]);

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
    <ResourcePageShell title={layoutTitle} subtitle={layoutSubtitle}>
      {submitError && (
        <Alert variant="destructive">
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <ContactCreateForm onSubmit={handleSubmit} onCancel={handleCancel} t={t} />
    </ResourcePageShell>
  );
}
