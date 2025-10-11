"use client";
import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useToast } from "@/components/ToastProvider";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import EntryHeader from "@entries/components/EntryHeader";
import EntryList from "@entries/components/EntryList";
import { useEntries } from "@entries/hooks/useEntries";

export default function EntriesPage() {
  const { loading: globalLoading, selectedHouseholdId, households } = useGlobal();
  const { t } = useI18n();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { entries, fileCounts, loading, error } = useEntries(selectedHouseholdId);

  const currentHousehold = useMemo(
    () => households.find((h) => h.id === selectedHouseholdId) || null,
    [households, selectedHouseholdId]
  );

  useEffect(() => {
    if (searchParams?.get("created") === "1") {
      const sp = new URLSearchParams(searchParams as any);
      sp.delete("created");
      const next = `/app/entries${sp.toString() ? `?${sp.toString()}` : ""}`;
      router.replace(next, { scroll: false });
      show({ title: t("entries.createdSuccess"), variant: "success" });
    }
  }, [searchParams, router, show, t]);

  if (globalLoading) return <div className="p-6 text-sm text-gray-500">{t("common.loading")}</div>;

  if (!selectedHouseholdId)
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("entries.title")}</CardTitle>
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
    <div className="max-w-4xl mx-auto p-6">
      <EntryHeader title={t("entries.title")} householdName={currentHousehold?.name} newHref="/app/entries/new" />

      {error && (
        <div className="mb-4 text-sm text-red-600 border border-red-200 rounded p-2 bg-red-50">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">{t("entries.loading")}</div>
      ) : (
        <EntryList entries={entries} fileCounts={fileCounts} t={t} />
      )}
    </div>
  );
}
