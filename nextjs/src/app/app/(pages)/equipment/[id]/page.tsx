// nextjs/src/app/app/(pages)/equipment/[id]/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, QrCode } from "lucide-react";

import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import EquipmentDetailView from "@equipment/components/EquipmentDetailView";
import { useEquipment } from "@equipment/hooks/useEquipment";
import { useEquipmentInteractions } from "@equipment/hooks/useEquipmentInteractions";
import { useZones } from "@zones/hooks/useZones";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import QRCodePrintDialog from "@qr-code/components/QRCodePrintDialog";
import type { EquipmentLabelData } from "@qr-code/types";

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { equipment, loading, error, deleteEquipment } = useEquipment(id);
  const { interactions, documentCounts, loading: interactionsLoading, error: interactionsError, reload } =
    useEquipmentInteractions(equipment?.id);
  const { zones } = useZones();
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const equipmentLabelData: EquipmentLabelData | null = useMemo(() => {
    if (!equipment) return null;

    // Build the equipment URL for QR code
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';
    const url = `${baseUrl}/app/equipment/${equipment.id}`;

    return {
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      serialNumber: equipment.serial_number || undefined,
      url,
      // householdName could be added from GlobalContext if needed
    };
  }, [equipment]);

  const layoutActions = useMemo(() => {
    if (!equipment) return [];
    return [
      {
        icon: Pencil,
        href: `/app/equipment/${equipment.id}/edit`,
      } as const,
      {
        icon: QrCode,
        onClick: () => setPrintDialogOpen(true),
        variant: "outline" as const,
      } as const,
    ];
  }, [equipment]);

  const isNotFound = !loading && (!id || !equipment);
  const context = equipment?.zone?.name;

  return (
    <>
      <DetailPageLayout
        context={context}
        actions={layoutActions}
        loading={loading}
        error={error || null}
        errorTitle={t("equipment.loadFailed")}
        isNotFound={isNotFound}
        notFoundState={
          <EmptyState
            title={t("equipment.notFound")}
            description={t("equipment.loadFailed")}
            action={
              <Button asChild variant="outline">
                <LinkWithOverlay href="/app/equipment">{t("equipment.actions.backToList")}</LinkWithOverlay>
              </Button>
            }
          />
        }
      >
        {equipment ? (
          <EquipmentDetailView
            equipment={equipment}
            interactions={interactions}
            documentCounts={documentCounts}
            zones={zones}
            onInteractionAdded={reload}
            onDeleted={() => router.push("/app/equipment")}
            interactionError={interactionsError}
            interactionLoading={interactionsLoading}
            locale={locale}
            t={t}
          />
        ) : null}
      </DetailPageLayout>

      {/* QR Code Print Dialog */}
      {equipmentLabelData && (
        <QRCodePrintDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          equipment={equipmentLabelData}
        />
      )}
    </>
  );
}
