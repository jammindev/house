import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import type { StockItem } from '@/lib/api/stock';
import { useRecordInventory } from './hooks';

interface StockInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
}

function parseDecimal(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function StockInventoryDialog({ open, onOpenChange, item }: StockInventoryDialogProps) {
  const { t } = useTranslation();
  const inventoryMutation = useRecordInventory();
  const [quantity, setQuantity] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Prefill with the current quantity each time the dialog opens.
  React.useEffect(() => {
    if (open && item) {
      setQuantity(String(item.quantity));
      setError(null);
    }
  }, [open, item]);

  if (!item) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!item) return;

    const parsed = parseDecimal(quantity);
    if (parsed === null || parsed < 0) {
      setError(t('stock.inventory.errors.invalid'));
      return;
    }

    try {
      await inventoryMutation.mutateAsync({ id: item.id, payload: { quantity: parsed } });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('stock.inventory.title', { name: item.name })}
    >
      <p className="text-sm text-muted-foreground">
        {t('stock.inventory.current_quantity', { quantity: item.quantity, unit: item.unit })}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <FormField
          label={`${t('stock.inventory.fields.quantity', { unit: item.unit })} *`}
          htmlFor="inventory-quantity"
        >
          <Input
            id="inventory-quantity"
            type="number"
            step="0.001"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            autoFocus
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t('stock.inventory.fields.quantity_hint')}
          </p>
        </FormField>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={inventoryMutation.isPending}>
            {inventoryMutation.isPending ? t('purchase.actions.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
