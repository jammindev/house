import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import type { StockItem } from '@/lib/api/stock';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { usePurchaseStockItem } from './hooks';

interface StockPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
}

export default function StockPurchaseDialog({ open, onOpenChange, item }: StockPurchaseDialogProps) {
  const { t } = useTranslation();
  const purchaseMutation = usePurchaseStockItem();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  if (!item) return null;

  async function handleSubmit(payload: PurchaseFormPayload) {
    setError(null);
    if (!item || payload.delta === undefined) return;
    try {
      await purchaseMutation.mutateAsync({
        id: item.id,
        payload: {
          delta: payload.delta,
          amount: payload.amount,
          supplier: payload.supplier,
          brand: payload.brand,
          remaining_before: payload.remaining_before,
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
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('stock.purchase.title', { name: item.name })}
    >
        <p className="text-sm text-muted-foreground">
          {t('stock.purchase.current_quantity', { quantity: item.quantity, unit: item.unit })}
        </p>

        <PurchaseForm
          withDelta
          deltaUnit={item.unit}
          currentQuantity={Number(item.quantity)}
          isPending={purchaseMutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          externalError={error}
        />
    </SheetDialog>
  );
}
