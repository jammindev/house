// nextjs/src/app/app/structures/page.tsx
"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Plus } from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import EmptyState from "@shared/components/EmptyState";
import ListPageLayout from "@shared/layout/ListPageLayout";
import StructureList from "@structures/components/StructureList";
import { useStructures } from "@structures/hooks/useStructures";
import type { Structure } from "@structures/types";

export default function StructuresPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const { structures, loading, error } = useStructures();

  const handleSelect = useCallback(
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
      show({ title: t("structures.createSuccess"), variant: "success" });
    }

    if (shouldReplace) {
      const next = `/app/structures${params.toString() ? `?${params.toString()}` : ""}`;
      router.replace(next, { scroll: false });
    }
  }, [router, searchParams, show, t]);

  const actions = useMemo(
    () => [
      {
        icon: Plus,
        href: "/app/structures/new",
        label: t("structures.addStructure"),
        variant: "default" as const,
      },
    ],
    [t]
  );

  return (
    <ListPageLayout
      title={t("structures.title")}
      subtitle={t("structures.subtitle")}
      hideBackButton
      actions={actions}
      loading={loading}
      error={error}
      errorTitle={t("structures.loadFailed")}
      isEmpty={!loading && structures.length === 0}
      emptyState={
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
      }
    >
      {structures.length > 0 ? <StructureList structures={structures} onSelect={handleSelect} t={t} /> : null}
    </ListPageLayout>
  );
}
