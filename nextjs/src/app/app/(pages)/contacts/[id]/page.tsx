// nextjs/src/app/app/contacts/[id]/page.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";

import ContactDetailsView from "@contacts/components/ContactDetailsView";
import { useContacts } from "@contacts/hooks/useContacts";
import { formatFullName } from "@contacts/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function ContactDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const { t } = useI18n();
  const { contacts, loading, error } = useContacts();
  const setPageLayoutConfig = usePageLayoutConfig();

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
            } as const,
          ]
        : undefined,
    [contact]
  );

  useEffect(() => {
    setPageLayoutConfig({
      title,
      subtitle: t("contacts.detailSubtitle"),
      context,
      actions,
      hideBackButton: false,
      className: undefined,
      contentClassName: undefined,
      loading: false,
    });
  }, [actions, context, setPageLayoutConfig, t, title]);

  if (!contactId) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("contacts.notFound")}</div>;
  }

  return (
    <>
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
    </>
  );
}
