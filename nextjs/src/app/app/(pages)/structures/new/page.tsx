"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import StructureForm, { StructureFormValues } from "@structures/components/StructureForm";
import { useStructures } from "@structures/hooks/useStructures";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function NewStructurePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { createStructure } = useStructures();
  const setPageLayoutConfig = usePageLayoutConfig();

  const handleSubmit = useCallback(
    async (values: StructureFormValues) => {
      if (!selectedHouseholdId) {
        throw new Error(t("structures.householdRequired"));
      }

      await createStructure({
        householdId: selectedHouseholdId,
        name: values.name,
        type: values.type,
        description: values.description,
        website: values.website,
        tags: values.tags,
        addresses: values.addresses,
        emails: values.emails,
        phones: values.phones,
      });

      router.push("/app/repertoire?view=structures&created=1");
    },
    [createStructure, router, selectedHouseholdId, t]
  );

  const handleCancel = useCallback(() => {
    router.push("/app/repertoire?view=structures");
  }, [router]);

  useEffect(() => {
    setPageLayoutConfig({
      title: t("structures.createTitle"),
      subtitle: t("structures.createDescription"),
      context: undefined,
      actions: undefined,
      className: undefined,
      contentClassName: undefined,
      hideBackButton: false,
      loading: false,
    });
  }, [setPageLayoutConfig, t]);

  return (
    <StructureForm submitLabel={t("structures.saveStructure")} onSubmit={handleSubmit} onCancel={handleCancel} t={t} />
  );
}
