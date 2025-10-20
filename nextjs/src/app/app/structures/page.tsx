// nextjs/src/app/app/structures/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import AppPageLayout from "@/components/layout/AppPageLayout";
import { useToast } from "@/components/ToastProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import StructureList from "@structures/components/StructureList";
import StructureDetailsDialog from "@structures/components/StructureDetailsDialog";
import StructureCreateDialog, { StructureCreateFormValues } from "@structures/components/StructureCreateDialog";
import { useStructures } from "@structures/hooks/useStructures";
import type { Structure } from "@structures/types";

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export default function StructuresPage() {
  const { selectedHouseholdId } = useGlobal();
  const { t } = useI18n();
  const { show } = useToast();
  const { structures, loading, error, createStructure } = useStructures();

  const [selectedStructure, setSelectedStructure] = useState<Structure | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!selectedHouseholdId) {
      setCreateOpen(false);
    }
  }, [selectedHouseholdId]);

  const handleSelect = useCallback((structure: Structure) => {
    setSelectedStructure(structure);
    setDetailsOpen(true);
  }, []);

  const handleDetailsChange = useCallback(
    (open: boolean) => {
      setDetailsOpen(open);
      if (!open) {
        setSelectedStructure(null);
      }
    },
    [setSelectedStructure]
  );

  const heading = useMemo(
    () => ({
      title: t("structures.title"),
      description: t("structures.subtitle"),
    }),
    [t]
  );

  const handleCreateStructure = useCallback(
    async (values: StructureCreateFormValues) => {
      if (!selectedHouseholdId) {
        throw new Error(t("structures.householdRequired"));
      }

      await createStructure({
        householdId: selectedHouseholdId,
        name: values.name.trim(),
        type: values.type.trim(),
        description: values.description.trim(),
        website: values.website.trim(),
        tags: parseTags(values.tags),
      });

      show({ title: t("structures.createSuccess"), variant: "success" });
    },
    [createStructure, selectedHouseholdId, show, t]
  );

  return (
    <AppPageLayout
      title={heading.title}
      subtitle={heading.description}
      action={{ icon: Plus, onClick: () => setCreateOpen(true) }}
      hideBackButton
    >
      {error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div> : null}

      {loading ? (
        <div className="text-sm text-gray-500">{t("structures.loading")}</div>
      ) : (
        <StructureList structures={structures} onSelect={handleSelect} t={t} />
      )}

      <StructureDetailsDialog structure={selectedStructure} open={detailsOpen} onOpenChange={handleDetailsChange} t={t} />
      <StructureCreateDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreateStructure} t={t} />
    </AppPageLayout>
  );
}
