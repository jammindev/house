// nextjs/src/app/app/(pages)/interactions/page.tsx
"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NotebookPen, Plus } from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import InteractionList from "@interactions/components/InteractionList";
import InteractionFilters from "@interactions/components/InteractionFilters";
import { useInteractions } from "@interactions/hooks/useInteractions";
import { DEFAULT_INTERACTION_FILTERS } from "@interactions/constants";
import ListPageLayout from "@shared/layout/ListPageLayout";
import EmptyState from "@shared/components/EmptyState";
import FiltersActionSheet from "@shared/components/FiltersActionSheet";
import { Button } from "@/components/ui/button";

export default function InteractionsPage() {
  const { t } = useI18n();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { interactions, documentCounts, loading, error, filters, setFilters } = useInteractions();

  const contactIdFilter = searchParams?.get("contactId") ?? null;
  const contactNameParam = searchParams?.get("contactName") ?? null;
  const contactName = contactNameParam ? decodeURIComponent(contactNameParam) : null;

  const filteredInteractions = useMemo(() => {
    if (!contactIdFilter) return interactions;
    return interactions.filter((interaction) => interaction.contacts.some((contact) => contact.id === contactIdFilter));
  }, [contactIdFilter, interactions]);

  const isFilteredView = Boolean(contactIdFilter);
  const displayedInteractions = isFilteredView ? filteredInteractions : interactions;

  const handleClearContactFilter = useCallback(() => {
    if (!contactIdFilter) return;
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
    nextParams.delete("contactId");
    nextParams.delete("contactName");
    const next = `/app/interactions${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
    router.replace(next, { scroll: false });
  }, [contactIdFilter, router, searchParams]);

  const resetFilters = useCallback(
    () => setFilters({ ...DEFAULT_INTERACTION_FILTERS }),
    [setFilters]
  );

  const actions = useMemo(
    () => [
      {
        element: (
          <FiltersActionSheet
            title={t("interactions.filters.title")}
            ariaLabel={t("common.filter")}
          >
            <InteractionFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
          </FiltersActionSheet>
        ),
      },
      {
        icon: Plus,
        href: "/app/interactions/new",
        variant: "default" as const,
      },
    ],
    [filters, resetFilters, setFilters, t]
  );

  useEffect(() => {
    if (searchParams?.get("created") === "1") {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("created");
      const next = `/app/interactions${sp.toString() ? `?${sp.toString()}` : ""}`;
      router.replace(next, { scroll: false });
      show({
        title: t("interactions.createdSuccess"),
        variant: "success",
      });
    }
  }, [searchParams, router, show, t]);

  const emptyTitle = isFilteredView ? t("contacts.latestInteractionsEmpty") : t("interactionsnone");
  const emptyDescription = isFilteredView
    ? contactName
      ? t("interactions.filteredByContact", { name: contactName })
      : t("interactions.filteredByContactUnknown")
    : t("interactionsnewEntryIntro");

  return (
    <ListPageLayout
      title={t("interactionstitle")}
      hideBackButton
      actions={actions}
      loading={loading}
      isEmpty={!loading && displayedInteractions.length === 0}
      emptyState={
        <EmptyState
          icon={NotebookPen}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button asChild>
              <LinkWithOverlay href="/app/interactions/new">{t("interactionscreateCta")}</LinkWithOverlay>
            </Button>
          }
        />
      }
      error={error}
      errorTitle={t("interactionslistLoadFailed")}
    >
      {isFilteredView ? (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {contactName
              ? t("interactions.filteredByContact", { name: contactName })
              : t("interactions.filteredByContactUnknown")}
          </span>
          <Button size="sm" variant="ghost" onClick={handleClearContactFilter} className="self-start sm:self-auto">
            {t("interactions.filteredByContactClear")}
          </Button>
        </div>
      ) : null}
      <InteractionList interactions={displayedInteractions} documentCounts={documentCounts} t={t} />
    </ListPageLayout>
  );
}
