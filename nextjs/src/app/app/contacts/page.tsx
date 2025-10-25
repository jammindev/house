// nextjs/src/app/app/contacts/page.tsx
"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import ContactList from "@contacts/components/ContactList";
import { useContacts } from "@contacts/hooks/useContacts";
import AppPageLayout from "@/components/layout/AppPageLayout";
import { Plus } from "lucide-react";

export default function ContactsPage() {
  const { t } = useI18n();
  const { contacts, loading, error } = useContacts();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = useCallback(
    (contactId: string) => {
      router.push(`/app/contacts/${contactId}`);
    },
    [router]
  );

  useEffect(() => {
    if (!searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    let shouldReplace = false;

    if (params.get("created") === "1") {
      params.delete("created");
      shouldReplace = true;
      show({ title: t("contacts.createSuccess"), variant: "success" });
    }

    if (params.get("deleted") === "1") {
      params.delete("deleted");
      shouldReplace = true;
      show({ title: t("contacts.deleteSuccess"), variant: "success" });
    }

    if (shouldReplace) {
      const next = `/app/contacts${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(next, { scroll: false });
    }
  }, [router, searchParams, show, t]);

  const heading = useMemo(
    () => ({
      title: t("contacts.title"),
      description: t("contacts.subtitle"),
    }),
    [t]
  );

  return (
    <AppPageLayout
      title={heading.title}
      subtitle={heading.description}
      actions={[
        {
          icon: Plus,
          href: "/app/contacts/new",
        },
      ]}
      hideBackButton
    >
      {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div> : null}

      {loading ? (
        <div className="text-sm text-gray-500">{t("contacts.loading")}</div>
      ) : (
        <ContactList contacts={contacts} onSelect={(contact) => handleSelect(contact.id)} t={t} />
      )}
    </AppPageLayout>
  );
}
