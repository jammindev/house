// nextjs/src/app/app/(pages)/equipment/[id]/edit/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import EquipmentForm from "@equipment/components/EquipmentForm";
import { useEquipment } from "@equipment/hooks/useEquipment";
import { useI18n } from "@/lib/i18n/I18nProvider";
import EmptyState from "@shared/components/EmptyState";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";

export default function EditEquipmentPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const { equipment, loading, error } = useEquipment(id);

  if (loading) {
    return (
      <ResourcePageShell title={t("equipment.editTitle")} subtitle={t("equipment.editSubtitle")}>
        <p className="text-sm text-gray-500">{t("equipment.loading")}</p>
      </ResourcePageShell>
    );
  }

  if (!equipment) {
    return (
      <ResourcePageShell title={t("equipment.editTitle")} subtitle={t("equipment.editSubtitle")}>
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
        ) : (
          <EmptyState
            title={t("equipment.notFound")}
            description={t("equipment.loadFailed")}
            action={
              <Button asChild variant="outline">
                <LinkWithOverlay href="/app/equipment">{t("equipment.actions.backToList")}</LinkWithOverlay>
              </Button>
            }
          />
        )}
      </ResourcePageShell>
    );
  }

  return (
    <ResourcePageShell title={t("equipment.editTitle")} subtitle={t("equipment.editSubtitle")} bodyClassName="mt-4">
      <EquipmentForm
        equipment={equipment}
        mode="edit"
        onSaved={(nextId) => {
          router.push(`/app/equipment/${nextId}`);
        }}
      />
    </ResourcePageShell>
  );
}
