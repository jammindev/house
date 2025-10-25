// nextjs/src/app/app/contacts/[id]/page.tsx
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";

import AppPageLayout from "@/components/layout/AppPageLayout";
import ContactDetailsView from "@contacts/components/ContactDetailsView";
import { useContacts } from "@contacts/hooks/useContacts";
import { formatFullName } from "@contacts/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";

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

  if (!contactId) {
    return (
      <AppPageLayout title={t("contacts.detailFallbackTitle")} subtitle={t("contacts.detailSubtitle")}>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("contacts.notFound")}</div>
      </AppPageLayout>
    );
  }

  const actions = contact
    ? [
      {
        icon: Pencil,
        href: `/app/contacts/${contact.id}/edit`,
      } as const,
    ]
    : undefined;

  return (
    <AppPageLayout title={title} subtitle={t("contacts.detailSubtitle")} context={context} actions={actions}>
      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-500">{t("contacts.loading")}</div>
      ) : contact ? (
        <ContactDetailsView contact={contact} t={t} />
      ) : (
        <div className="rounded border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
          {t("contacts.notFound")}
        </div>
      )}
    </AppPageLayout>
  );
}
