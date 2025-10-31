// nextjs/src/app/app/contacts/page.tsx
"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import ContactList from "@contacts/components/ContactList";
import { useContacts } from "@contacts/hooks/useContacts";
import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus } from "lucide-react";

export default function ContactsPage() {
  const { t } = useI18n();
  const { contacts, loading, error } = useContacts();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const actions = useMemo(
    () => [
      {
        icon: Plus,
        href: "/app/contacts/new",
        label: t("contacts.addContact"),
        variant: "default" as const,
      },
    ],
    [t]
  );

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

  return (
    <ListPageLayout
      title={t("contacts.title")}
      subtitle={t("contacts.subtitle")}
      hideBackButton
      actions={actions}
      loading={loading}
      isEmpty={!loading && contacts.length === 0}
      errorTitle={t("contacts.loadFailed")}
      emptyState={
        <EmptyState
          icon={UserPlus}
          title={t("contacts.empty")}
          description={t("contacts.createDescription")}
          action={
            <Button asChild>
              <Link href="/app/contacts/new">{t("contacts.addContact")}</Link>
            </Button>
          }
        />
      }
      error={error}
    >
      <ContactList contacts={contacts} onSelect={(contact) => handleSelect(contact.id)} t={t} />
    </ListPageLayout>
  );
}
