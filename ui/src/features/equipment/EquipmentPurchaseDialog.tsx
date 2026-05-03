import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
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
        },
      });
      onOpenChange(false);
    } catch {
      setError(t('purchase.errors.save_failed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('equipment.purchase.title', { name: equipment.name })}</DialogTitle>
        </DialogHeader>

        <PurchaseForm
          isPending={purchaseMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          externalError={error}
        />
      </DialogContent>
    </Dialog>
  );
}
