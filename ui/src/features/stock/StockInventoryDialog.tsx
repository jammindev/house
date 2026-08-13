import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { DecimalInput } from '@/design-system/decimal-input';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { todayISO } from '@/lib/format';
import type { StockItem } from '@/lib/api/stock';
import { useRecordInventory } from './hooks';

interface StockInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
}

function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function StockInventoryDialog({ open, onOpenChange, item }: StockInventoryDialogProps) {
  const { t } = useTranslation();
  const inventoryMutation = useRecordInventory();
  const [quantity, setQuantity] = React.useState('');
  const [countedOn, setCountedOn] = React.useState(todayISO);
  const [error, setError] = React.useState<string | null>(null);

  // Prefill with the current quantity each time the dialog opens.
  React.useEffect(() => {
    if (open && item) {
      setQuantity(String(item.quantity));
      setCountedOn(todayISO());
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
      await inventoryMutation.mutateAsync({
        id: item.id,
        payload: {
          quantity: parsed,
          // Midi dans la journée saisie : à minuit, un comptage du 1er ou du 31
          // changerait de jour au passage en UTC — et donc de barre.
          occurred_at: countedOn ? new Date(`${countedOn}T12:00:00`).toISOString() : null,
        },
      });
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
          <DecimalInput
            id="inventory-quantity"
            decimals={3}
            value={quantity}
            onChange={setQuantity}
            required
            autoFocus
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t('stock.inventory.fields.quantity_hint')}
          </p>
        </FormField>

        {/* Le jour du comptage, pas celui de la saisie : une dépense importée
            d'un relevé est antidatée, et l'inventaire qui l'accompagne doit
            pouvoir l'être aussi — sinon la courbe raconte la saisie. */}
        <FormField label={t('stock.inventory.fields.counted_on')} htmlFor="inventory-date">
          <Input
            id="inventory-date"
            type="date"
            value={countedOn}
            onChange={(e) => setCountedOn(e.target.value)}
          />
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
