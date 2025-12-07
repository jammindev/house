// nextjs/src/features/equipment/components/EquipmentDeleteButton.tsx
"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEquipment } from "../hooks/useEquipment";

type EquipmentDeleteButtonProps = {
    equipmentId: string;
    equipmentName: string;
    onDeleted?: () => void;
};

export default function EquipmentDeleteButton({
    equipmentId,
    equipmentName,
    onDeleted,
}: EquipmentDeleteButtonProps) {
    const { t } = useI18n();
    const router = useRouter();
    const { deleteEquipment } = useEquipment(equipmentId);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        try {
            setDeleting(true);
            setDeleteError("");
            await deleteEquipment();
            onDeleted?.();
            router.push("/app/equipment");
        } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : t("common.unexpectedError");
            setDeleteError(message);
        } finally {
            setDeleting(false);
            setConfirmOpen(false);
        }
    };

    return (
        <>
            <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                className="gap-2"
            >
                <Trash2 className="h-4 w-4" />
                {t("equipment.actions.delete")}
            </Button>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={t("equipment.actions.deleteTitle")}
                description={t("equipment.actions.deleteConfirm", { name: equipmentName })}
                confirmText={t("equipment.actions.delete")}
                cancelText={t("equipment.actions.cancel")}
                destructive
                loading={deleting}
                onConfirm={handleDelete}
            />

            {deleteError ? (
                <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
                    {deleteError}
                </div>
            ) : null}
        </>
    );
}