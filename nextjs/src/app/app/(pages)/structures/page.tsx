// nextjs/src/app/app/structures/page.tsx
"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import StructureList from "@structures/components/StructureList";
import { useStructures } from "@structures/hooks/useStructures";
import type { Structure } from "@structures/types";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function StructuresPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const { structures, loading, error } = useStructures();
  const setPageLayoutConfig = usePageLayoutConfig();
  const title = t("structures.title");
  const subtitle = t("structures.subtitle");

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

  useEffect(() => {
    setPageLayoutConfig({
      title,
      subtitle,
      context: undefined,
      actions: [
        {
          icon: Plus,
          href: "/app/structures/new",
        },
      ],
      hideBackButton: true,
      className: undefined,
      contentClassName: undefined,
      loading: false,
    });
  }, [setPageLayoutConfig, subtitle, title]);

  return (
    <>
      {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div> : null}

      {loading ? (
        <div className="text-sm text-gray-500">{t("structures.loading")}</div>
      ) : (
        <StructureList structures={structures} onSelect={handleSelect} t={t} />
      )}
    </>
  );
}
