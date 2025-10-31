// nextjs/src/app/app/contacts/[id]/page.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, UserX } from "lucide-react";

import ContactDetailsView from "@contacts/components/ContactDetailsView";
import { useContacts } from "@contacts/hooks/useContacts";
import { formatFullName } from "@contacts/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { Button } from "@/components/ui/button";

export default function ContactDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const { t } = useI18n();
  const { contacts, loading, error } = useContacts();

  const contactIdParam = params?.id;
  const contactId = Array.isArray(contactIdParam) ? contactIdParam[0] : contactIdParam ?? "";

  const contact = useMemo(
    () => contacts.find((item) => item.id === contactId) ?? null,
    [contacts, contactId]
  );

  const title = contact
    ? formatFullName(contact) || t("contacts.unnamedContact")
    : t("contacts.detailFallbackTitle");
  const context = contact?.position ?? contact?.structure?.name ?? undefined;
  const actions = useMemo(
    () =>
      contact
        ? [
            {
              icon: Pencil,
              href: `/app/contacts/${contact.id}/edit`,
              label: t("contacts.editContact"),
            } as const,
          ]
        : undefined,
    [contact, t]
  );

  const isNotFound = !loading && (!contactId || !contact);

  return (
    <DetailPageLayout
      title={title}
      subtitle={t("contacts.detailSubtitle")}
      context={context}
      actions={actions}
      loading={loading}
      error={error}
      errorTitle={t("contacts.loadFailed")}
      isNotFound={isNotFound}
      notFoundState={
        <EmptyState
          icon={UserX}
          title={t("contacts.notFound")}
          description={t("contacts.detailSubtitle")}
          action={
            <Button asChild variant="outline">
              <Link href="/app/contacts">{t("contacts.title")}</Link>
            </Button>
          }
        />
      }
    >
      {contact ? <ContactDetailsView contact={contact} t={t} /> : null}
    </DetailPageLayout>
  );
}
