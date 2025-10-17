// nextjs/src/app/app/interactions/page.tsx
"use client";
import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useToast } from "@/components/ToastProvider";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import InteractionHeader from "@interactions/components/InteractionHeader";
import InteractionList from "@interactions/components/InteractionList";
import { useInteractions } from "@interactions/hooks/useInteractions";

export default function InteractionsPage() {
  const { loading: globalLoading, selectedHouseholdId, households } = useGlobal();
  const { t } = useI18n();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { interactions, documentCounts, loading, error } = useInteractions(selectedHouseholdId);

  const currentHousehold = useMemo(
    () => households.find((h) => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

  useEffect(() => {
    if (searchParams?.get("created") === "1") {
      const sp = new URLSearchParams(searchParams as any);
      sp.delete("created");
      const next = `/app/interactions${sp.toString() ? `?${sp.toString()}` : ""}`;
      router.replace(next, { scroll: false });
      show({ title: t("interactionscreatedSuccess"), variant: "success" });
    }
  }, [searchParams, router, show, t]);

  if (globalLoading) return <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>;

  if (!selectedHouseholdId)
    return (
      <div className="max-w-3xl mx-auto lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("interactionstitle")}</CardTitle>
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
    <div className="max-w-4xl mx-auto md:p-6">
      <InteractionHeader title={t("interactionstitle")} householdName={currentHousehold?.name} newHref="/app/interactions/new" />

      {error && (
        <div className="mb-4 text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">{t("interactionsloading")}</div>
      ) : (
        <InteractionList interactions={interactions} documentCounts={documentCounts} t={t} />
      )}
    </div>
  );
}
