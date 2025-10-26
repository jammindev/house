"use client";

import { useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useToast } from "@/components/ToastProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import StructureForm, { StructureFormValues } from "@structures/components/StructureForm";
import { useStructures } from "@structures/hooks/useStructures";

export default function StructureEditPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { t } = useI18n();
  const { show } = useToast();
  const { selectedHouseholdId } = useGlobal();
  const { structures, loading, error, updateStructure } = useStructures();

  const structureIdParam = params?.id;
  const structureId = Array.isArray(structureIdParam) ? structureIdParam[0] : structureIdParam ?? "";

  const structure = useMemo(
    () => structures.find((item) => item.id === structureId) ?? null,
    [structures, structureId]
  );

  const heading = useMemo(
    () => ({
      title: t("structures.editTitle"),
      subtitle: t("structures.editSubtitle"),
    }),
    [t]
  );

  const initialValues = useMemo(
    () =>
      structure
        ? {
            name: structure.name ?? "",
            type: structure.type ?? "",
            website: structure.website ?? "",
            description: structure.description ?? "",
            tags: structure.tags ?? [],
            addresses: structure.addresses ?? [],
            emails: structure.emails ?? [],
            phones: structure.phones ?? [],
          }
        : undefined,
    [structure]
  );

  const handleSubmit = useCallback(
    async (values: StructureFormValues) => {
      if (!selectedHouseholdId) {
        throw new Error(t("structures.householdRequired"));
      }
      if (!structureId) {
        throw new Error(t("structures.notFound"));
      }

      await updateStructure({
        structureId,
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

      show({ title: t("structures.updateSuccess"), variant: "success" });
      router.push("/app/structures");
    },
    [router, selectedHouseholdId, show, structureId, t, updateStructure]
  );

  const handleCancel = useCallback(() => {
    router.push("/app/structures");
  }, [router]);

  if (!structureId) {
    return (
      <AppPageLayout title={heading.title} subtitle={heading.subtitle}>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("structures.notFound")}</div>
      </AppPageLayout>
    );
  }

  if (loading) {
    return (
      <AppPageLayout title={heading.title} subtitle={heading.subtitle}>
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      </AppPageLayout>
    );
  }

  if (error) {
    return (
      <AppPageLayout title={heading.title} subtitle={heading.subtitle}>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      </AppPageLayout>
    );
  }

  if (!structure) {
    return (
      <AppPageLayout title={heading.title} subtitle={heading.subtitle}>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("structures.notFound")}</div>
      </AppPageLayout>
    );
  }

  const contextName = structure.name || t("structures.unnamedStructure");

  return (
    <AppPageLayout title={heading.title} subtitle={heading.subtitle} context={contextName}>
      <StructureForm
        initialValues={initialValues}
        submitLabel={t("structures.saveChanges")}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        t={t}
      />
    </AppPageLayout>
  );
}
