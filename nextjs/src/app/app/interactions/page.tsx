// nextjs/src/app/app/interactions/page.tsx
"use client";
import React, { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useToast } from "@/components/ToastProvider";

import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionList from "@interactions/components/InteractionList";
import { useInteractions } from "@interactions/hooks/useInteractions";

import { Plus } from "lucide-react";
import AppPageLayout from "@/components/layout/AppPageLayout";

export default function InteractionsPage() {
  const { t } = useI18n();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { interactions, documentCounts, loading, error } = useInteractions();

  useEffect(() => {
    if (searchParams?.get("created") === "1") {
      const sp = new URLSearchParams(searchParams as any);
      sp.delete("created");
      const next = `/app/interactions${sp.toString() ? `?${sp.toString()}` : ""}`;
      router.replace(next, { scroll: false });
      show({ title: t("interactionscreatedSuccess"), variant: "success" });
    }
  }, [searchParams, router, show, t]);

  return (
    <AppPageLayout
      title={t("interactionstitle")}
      action={{ icon: Plus, href: "/app/interactions/new" }}
    >
      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div>
      ) : null}

      {loading ? (
        <div className="text-sm text-gray-500">{t("interactionsloading")}</div>
      ) : (
        <InteractionList interactions={interactions} documentCounts={documentCounts} t={t} />
      )}
    </AppPageLayout>
  );
}
