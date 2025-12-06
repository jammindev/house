// nextjs/src/app/app/(pages)/equipment/[id]/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, Printer } from "lucide-react";

import DetailPageLayout from "@shared/layout/DetailPageLayout";
import EmptyState from "@shared/components/EmptyState";
import EquipmentDetailView from "@equipment/components/EquipmentDetailView";
import { useEquipment } from "@equipment/hooks/useEquipment";
import { useEquipmentInteractions } from "@equipment/hooks/useEquipmentInteractions";
import { useZones } from "@zones/hooks/useZones";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import LinkWithOverlay from "@/components/layout/LinkWithOverlay";
import ConfirmDialog from "@/components/ConfirmDialog";
import QRCodePrintDialog from "@qr-code/components/QRCodePrintDialog";
import type { EquipmentLabelData } from "@qr-code/types";

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { equipment, loading, error, deleteEquipment } = useEquipment(id);
  const { interactions, documentCounts, loading: interactionsLoading, error: interactionsError, reload } =
    useEquipmentInteractions(equipment?.id);
  const { zones } = useZones();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

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
        icon: Printer,
        onClick: () => setPrintDialogOpen(true),
        variant: "outline" as const,
      } as const,
      {
        icon: Trash2,
        variant: "destructive" as const,
        onClick: () => setConfirmOpen(true),
      } as const,
    ];
  }, [equipment]);

  const isNotFound = !loading && (!id || !equipment);
  const title = equipment?.name ?? t("equipment.title");
  const subtitle = equipment?.category;
  const context = equipment?.zone?.name;

  return (
    <>
      <DetailPageLayout
        title={title}
        subtitle={subtitle}
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
            interactionError={interactionsError}
            interactionLoading={interactionsLoading}
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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("equipment.actions.deleteTitle")}
        description={t("equipment.actions.deleteConfirm", { name: equipment?.name ?? "" })}
        confirmText={t("equipment.actions.delete")}
        cancelText={t("equipment.actions.cancel")}
        destructive
        loading={deleting}
        onConfirm={async () => {
          if (!equipment) return;
          try {
            setDeleting(true);
            setDeleteError("");
            await deleteEquipment();
            router.push("/app/equipment");
          } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : t("common.unexpectedError");
            setDeleteError(message);
          } finally {
            setDeleting(false);
            setConfirmOpen(false);
          }
        }}
      />

      {deleteError ? (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
          {deleteError}
        </div>
      ) : null}
    </>
  );
}
