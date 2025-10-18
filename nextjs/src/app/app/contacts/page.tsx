"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ContactList from "@contacts/components/ContactList";
import ContactDetailsDialog from "@contacts/components/ContactDetailsDialog";
import { useContacts } from "@contacts/hooks/useContacts";
import type { Contact } from "@contacts/types";

export default function ContactsPage() {
  const { loading: globalLoading, selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { contacts, loading, error } = useContacts(selectedHouseholdId);

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  if (globalLoading) return <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>;

  if (!selectedHouseholdId)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>{heading.title}</CardTitle>
            <CardDescription>{heading.description}</CardDescription>
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
            <CardTitle className="text-lg">{heading.title}</CardTitle>
            <CardDescription>{heading.description}</CardDescription>
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
    </>
  );
}
