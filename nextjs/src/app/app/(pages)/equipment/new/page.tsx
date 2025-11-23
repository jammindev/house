// nextjs/src/app/app/(pages)/equipment/new/page.tsx
"use client";

import { useRouter } from "next/navigation";

import ResourcePageShell from "@shared/layout/ResourcePageShell";
import EquipmentForm from "@equipment/components/EquipmentForm";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function NewEquipmentPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <ResourcePageShell title={t("equipment.newTitle")} subtitle={t("equipment.newSubtitle")} bodyClassName="mt-4">
      <EquipmentForm
        mode="create"
        onSaved={(id) => {
          router.push(`/app/equipment/${id}`);
        }}
      />
    </ResourcePageShell>
  );
}
