import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import type { EquipmentListItem } from '@/lib/api/equipment';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { useRegisterEquipmentPurchase } from './hooks';

interface EquipmentPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: EquipmentListItem | null;
}

export default function EquipmentPurchaseDialog({
  open,
  onOpenChange,
  equipment,
}: EquipmentPurchaseDialogProps) {
  const { t } = useTranslation();
  const purchaseMutation = useRegisterEquipmentPurchase();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  if (!equipment) return null;

  async function handleSubmit(payload: PurchaseFormPayload) {
    setError(null);
    if (!equipment) return;
    try {
      await purchaseMutation.mutateAsync({
        id: equipment.id,
        payload: {
          amount: payload.amount,
          supplier: payload.supplier,
          occurred_at: payload.occurred_at,
          notes: payload.notes,
          budget_id: payload.budget_id,
        },
      });
      onOpenChange(false);
    } catch {
      setError(t('purchase.errors.save_failed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('equipment.purchase.title', { name: equipment.name })}
    >
        {/* Dire ce que l'action fait — et surtout ce qu'elle ne fait pas. Elle
            recopiait auparavant le montant et la date dans la fiche : changer un
            joint à 12 € réécrivait la date d'achat d'une chaudière de 2015. */}
        <p className="mb-3 text-xs text-muted-foreground">{t('equipment.purchase.hint')}</p>
        <PurchaseForm
          isPending={purchaseMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          externalError={error}
        />
    </SheetDialog>
  );
}
