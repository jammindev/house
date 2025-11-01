"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

import { useToast } from "@/components/ToastProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import StructureForm, { StructureFormValues } from "@structures/components/StructureForm";
import { useStructures } from "@structures/hooks/useStructures";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

export default function StructureEditPage() {
  const params = useParams<{ id?: string | string[] }>();
  const router = useRouter();
  const { t } = useI18n();
  const { show } = useToast();
  const { selectedHouseholdId } = useGlobal();
  const { structures, loading, error, updateStructure } = useStructures();
  const setPageLayoutConfig = usePageLayoutConfig();

  const structureIdParam = params?.id;
  const structureId = Array.isArray(structureIdParam) ? structureIdParam[0] : structureIdParam ?? "";

  const structure = useMemo(
    () => structures.find((item) => item.id === structureId) ?? null,
    [structures, structureId]
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
      router.push("/app/repertoire?view=structures");
    },
    [router, selectedHouseholdId, show, structureId, t, updateStructure]
  );

  const handleCancel = useCallback(() => {
    router.push("/app/repertoire?view=structures");
  }, [router]);

  const title = t("structures.editTitle");
  const subtitle = t("structures.editSubtitle");
  const contextName = structure?.name || t("structures.unnamedStructure");

  useEffect(() => {
    setPageLayoutConfig({
      title,
      subtitle,
      context: structure ? contextName : undefined,
      hideBackButton: false,
      actions: undefined,
      className: undefined,
      contentClassName: undefined,
      loading: false,
    });
  }, [contextName, setPageLayoutConfig, structure, subtitle, title]);

  if (!structureId) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("structures.notFound")}</div>;
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t("common.loading")}</div>;
  }

  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  if (!structure) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-600">{t("structures.notFound")}</div>;
  }

  return (
    <StructureForm
      initialValues={initialValues}
      submitLabel={t("structures.saveChanges")}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      t={t}
    />
  );
}
