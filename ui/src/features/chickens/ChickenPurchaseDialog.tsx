import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import type { Chicken } from '@/lib/api/chickens';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { usePurchaseChicken } from './hooks';

interface ChickenPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chicken: Chicken | null;
}

export default function ChickenPurchaseDialog({ open, onOpenChange, chicken }: ChickenPurchaseDialogProps) {
  const { t } = useTranslation();
  const purchaseMutation = usePurchaseChicken();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  if (!chicken) return null;

  async function handleSubmit(payload: PurchaseFormPayload) {
    setError(null);
    if (!chicken) return;
    try {
      await purchaseMutation.mutateAsync({
        id: chicken.id,
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
          <DialogTitle>{t('chickens.purchase.title', { name: chicken.name })}</DialogTitle>
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
