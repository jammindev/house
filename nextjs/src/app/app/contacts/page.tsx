// nextjs/src/app/app/contacts/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import ContactList from "@contacts/components/ContactList";
import ContactDetailsDialog from "@contacts/components/ContactDetailsDialog";
import ContactCreateDialog, { ContactCreateFormValues } from "@contacts/components/ContactCreateDialog";
import { useContacts } from "@contacts/hooks/useContacts";
import type { Contact } from "@contacts/types";
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Plus } from "lucide-react";

export default function ContactsPage() {
  const { loading: globalLoading, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { contacts, loading, error, createContact } = useContacts();
  const { show } = useToast();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setCreateOpen(false);
    }
  }, [selectedHouseholdId]);

  const handleSelect = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    setDialogOpen(true);
  }, []);

  const handleDialogChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (!open) {
        setSelectedContact(null);
      }
    },
    [setSelectedContact]
  );

  const heading = useMemo(
    () => ({
      title: t("contacts.title"),
      description: t("contacts.subtitle"),
    }),
    [t]
  );

  const handleCreateContact = useCallback(
    async (values: ContactCreateFormValues) => {
      if (!selectedHouseholdId) {
        throw new Error(t("contacts.householdRequired"));
      }

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

      show({ title: t("contacts.createSuccess"), variant: "success" });
    },
    [createContact, selectedHouseholdId, show, t]
  );

  if (globalLoading)
    return (
      <AppPageLayout
        title={heading.title}
        subtitle={heading.description}
        action={{ label: t("contacts.addContact"), icon: Plus, disabled: true }}
      >
        <div className="text-sm text-gray-500">{t("common.loading")}</div>
      </AppPageLayout>
    );

  return (
    <AppPageLayout
      title={heading.title}
      subtitle={heading.description}
      action={{ icon: Plus, onClick: () => setCreateOpen(true) }}
    >
      {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div> : null}

      {loading ? (
        <div className="text-sm text-gray-500">{t("contacts.loading")}</div>
      ) : (
        <ContactList contacts={contacts} onSelect={handleSelect} t={t} />
      )}

      <ContactDetailsDialog contact={selectedContact} open={dialogOpen} onOpenChange={handleDialogChange} t={t} />
      <ContactCreateDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreateContact} t={t} />
    </AppPageLayout>
  );
}
