"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Loader2, Plus } from "lucide-react";

import InteractionList from "@interactions/components/InteractionList";
import { useInteractions } from "@interactions/hooks/useInteractions";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function InteractionsPage() {
  const { t } = useI18n();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { interactions, documentCounts, loading, error } = useInteractions();
  const setPageLayoutConfig = usePageLayoutConfig();

  // --- Configure dynamiquement le layout ---
  useEffect(() => {
    setPageLayoutConfig({
      title: t("interactionstitle"),
      subtitle: undefined,
      context: undefined,
      actions: [{ icon: Plus, href: "/app/interactions/new" }],
      hideBackButton: true,
      className: undefined,
      contentClassName: undefined,
      loading: false,
    });
  }, [setPageLayoutConfig, t]);

  // --- Gestion du toast de succès ---
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

  if (error) {
    return (
      <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <InteractionList
      interactions={interactions}
      documentCounts={documentCounts}
      t={t}
    />
  );
}
