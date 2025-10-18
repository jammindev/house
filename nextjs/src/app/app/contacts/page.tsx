"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ToastProvider";
import ContactList from "@contacts/components/ContactList";
import ContactDetailsDialog from "@contacts/components/ContactDetailsDialog";
import ContactHeader from "@contacts/components/ContactHeader";
import ContactCreateDialog, { ContactCreateFormValues } from "@contacts/components/ContactCreateDialog";
import { useContacts } from "@contacts/hooks/useContacts";
import type { Contact } from "@contacts/types";

export default function ContactsPage() {
  const { loading: globalLoading, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { contacts, loading, error, createContact } = useContacts(selectedHouseholdId);
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

  if (globalLoading) return <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>;

  if (!selectedHouseholdId)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <ContactHeader
              title={heading.title}
              description={heading.description}
              addLabel={t("contacts.addContact")}
              onAdd={() => setCreateOpen(true)}
              disabled
            />
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              {t("common.selectHouseholdFirst")}{" "}
              <Link href="/app" className="underline">
                {t("nav.dashboard")}
              </Link>
              .
            </div>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col gap-4 p-2 sm:p-0">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <ContactHeader
              title={heading.title}
              description={heading.description}
              addLabel={t("contacts.addContact")}
              onAdd={() => setCreateOpen(true)}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div>}

            {loading ? (
              <div className="text-sm text-gray-500">{t("contacts.loading")}</div>
            ) : (
              <ContactList contacts={contacts} onSelect={handleSelect} t={t} />
            )}
          </CardContent>
        </Card>
      </div>

      <ContactDetailsDialog contact={selectedContact} open={dialogOpen} onOpenChange={handleDialogChange} t={t} />
      <ContactCreateDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreateContact} t={t} />
    </>
  );
}
