import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import type { ShoppingListItem } from '@/lib/api/shopping';
import { useUpdateShoppingItem } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ShoppingListItem;
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ShoppingItemDialog({ open, onOpenChange, existing }: Props) {
  const { t } = useTranslation();
  const updateMutation = useUpdateShoppingItem();

  const [label, setLabel] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (!open || !existing) return;
    setLabel(existing.label);
    setQuantity(existing.quantity ? String(Number(existing.quantity)) : '');
    setUnit(existing.unit || '');
    setNote(existing.note || '');
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!existing || !label.trim()) return;
    await updateMutation.mutateAsync({
      id: existing.id,
      payload: {
        label: label.trim(),
        quantity: toNumberOrNull(quantity),
        unit: unit.trim(),
        note: note.trim(),
      },
    });
    onOpenChange(false);
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('shoppingList.edit.title')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={`${t('shoppingList.fields.label')} *`} htmlFor="shopping-label">
          <Input
            id="shopping-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            autoComplete="off"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('shoppingList.fields.quantity')} htmlFor="shopping-qty">
            <Input
              id="shopping-qty"
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </FormField>
          <FormField label={t('shoppingList.fields.unit')} htmlFor="shopping-unit">
            <Input
              id="shopping-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label={t('shoppingList.fields.note')} htmlFor="shopping-note">
          <Textarea
            id="shopping-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
