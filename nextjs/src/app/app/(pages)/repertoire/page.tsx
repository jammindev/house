"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Plus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import EmptyState from "@shared/components/EmptyState";
import ListPageLayout from "@shared/layout/ListPageLayout";
import ContactList from "@contacts/components/ContactList";
import { useContacts } from "@contacts/hooks/useContacts";
import StructureList from "@structures/components/StructureList";
import { useStructures } from "@structures/hooks/useStructures";
import type { Structure } from "@structures/types";

type RepertoireView = "contacts" | "structures";

export default function RepertoirePage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show } = useToast();

  const { contacts, loading: contactsLoading, error: contactsError } = useContacts();
  const { structures, loading: structuresLoading, error: structuresError } = useStructures();

  const currentView: RepertoireView = useMemo(() => {
    const param = searchParams?.get("view");
    return param === "structures" ? "structures" : "contacts";
  }, [searchParams]);

  const navigateWithView = useCallback(
    (nextView: RepertoireView) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("view", nextView);
      const queryString = params.toString();
      router.replace(`/app/repertoire${queryString ? `?${queryString}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleSelectContact = useCallback(
    (contactId: string) => {
      router.push(`/app/contacts/${contactId}`);
    },
    [router]
  );

  const handleSelectStructure = useCallback(
    (structure: Structure) => {
      router.push(`/app/structures/${structure.id}`);
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
      show({
        title:
          currentView === "structures"
            ? t("structures.createSuccess")
            : t("contacts.createSuccess"),
        variant: "success",
      });
    }

    if (params.get("deleted") === "1") {
      params.delete("deleted");
      shouldReplace = true;
      show({
        title:
          currentView === "structures"
            ? t("structures.deleteSuccess")
            : t("contacts.deleteSuccess"),
        variant: "success",
      });
    }

    if (shouldReplace) {
      if (!params.has("view")) {
        params.set("view", currentView);
      }
      const queryString = params.toString();
      router.replace(`/app/repertoire${queryString ? `?${queryString}` : ""}`, { scroll: false });
    }
  }, [currentView, router, searchParams, show, t]);

  const actions = useMemo(() => {
    if (currentView === "structures") {
      return [
        {
          icon: Plus,
          href: "/app/structures/new",
          variant: "default" as const,
        },
      ];
    }

    return [
      {
        icon: Plus,
        href: "/app/contacts/new",
        variant: "default" as const,
      },
    ];
  }, [currentView, t]);

  const toggleToolbar = (
    <div className="flex justify-end">
      <div className="inline-flex rounded-md border border-border bg-background p-1">
        <Button
          type="button"
          variant={currentView === "contacts" ? "default" : "ghost"}
          size="sm"
          onClick={() => navigateWithView("contacts")}
          aria-pressed={currentView === "contacts"}
          className={currentView === "contacts" ? "shadow-sm" : ""}
        >
          {t("repertoire.contactsTab")}
        </Button>
        <Button
          type="button"
          variant={currentView === "structures" ? "default" : "ghost"}
          size="sm"
          onClick={() => navigateWithView("structures")}
          aria-pressed={currentView === "structures"}
          className={currentView === "structures" ? "shadow-sm" : ""}
        >
          {t("repertoire.structuresTab")}
        </Button>
      </div>
    </div>
  );

  const layoutProps =
    currentView === "structures"
      ? {
        loading: structuresLoading,
        error: structuresError,
        errorTitle: t("structures.loadFailed"),
        isEmpty: !structuresLoading && structures.length === 0,
        emptyState: (
          <EmptyState
            icon={Building2}
            title={t("structures.empty")}
            description={t("structures.createDescription")}
            action={
              <Button asChild>
                <Link href="/app/structures/new">{t("structures.addStructure")}</Link>
              </Button>
            }
          />
        ),
        children:
          structures.length > 0 ? (
            <StructureList structures={structures} onSelect={handleSelectStructure} t={t} />
          ) : null,
      }
      : {
        loading: contactsLoading,
        error: contactsError,
        errorTitle: t("contacts.loadFailed"),
        isEmpty: !contactsLoading && contacts.length === 0,
        emptyState: (
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
        ),
        children: (
          <ContactList contacts={contacts} onSelect={(contact) => handleSelectContact(contact.id)} t={t} />
        ),
      };

  return (
    <ListPageLayout
      title={t("repertoire.title")}
      subtitle={t("repertoire.subtitle")}
      hideBackButton
      actions={actions}
      loading={layoutProps.loading}
      error={layoutProps.error}
      errorTitle={layoutProps.errorTitle}
      isEmpty={layoutProps.isEmpty}
      emptyState={layoutProps.emptyState}
      toolbar={toggleToolbar}
      showSkeleton
    >
      {layoutProps.children}
    </ListPageLayout>
  );
}
