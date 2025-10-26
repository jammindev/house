"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import StructureForm, { StructureFormValues } from "@structures/components/StructureForm";
import { useStructures } from "@structures/hooks/useStructures";

export default function NewStructurePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { selectedHouseholdId } = useGlobal();
  const { createStructure } = useStructures();

  const heading = useMemo(
    () => ({
      title: t("structures.createTitle"),
      subtitle: t("structures.createDescription"),
    }),
    [t]
  );

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

      router.push("/app/structures?created=1");
    },
    [createStructure, router, selectedHouseholdId, t]
  );

  const handleCancel = useCallback(() => {
    router.push("/app/structures");
  }, [router]);

  return (
    <AppPageLayout title={heading.title} subtitle={heading.subtitle}>
      <StructureForm submitLabel={t("structures.saveStructure")} onSubmit={handleSubmit} onCancel={handleCancel} t={t} />
    </AppPageLayout>
  );
}
