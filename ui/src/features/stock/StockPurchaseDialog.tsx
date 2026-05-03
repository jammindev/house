import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import type { StockItem } from '@/lib/api/stock';
import { usePurchaseStockItem } from './hooks';

interface StockPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItem | null;
}

type PriceMode = 'total' | 'unit';

interface FormState {
  delta: string;
  priceMode: PriceMode;
  price: string;
  supplier: string;
  occurredAt: string;
  notes: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_STATE: FormState = {
  delta: '',
  priceMode: 'total',
  price: '',
  supplier: '',
  occurredAt: todayIsoDate(),
  notes: '',
};

function parseDecimal(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function StockPurchaseDialog({ open, onOpenChange, item }: StockPurchaseDialogProps) {
  const { t } = useTranslation();
  const purchaseMutation = usePurchaseStockItem();

  const [form, setForm] = React.useState<FormState>(EMPTY_STATE);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm(EMPTY_STATE);
    setError(null);
  }, [open, item?.id]);

  if (!item) return null;

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setError(null);

    const delta = parseDecimal(form.delta);
    if (delta === null || delta <= 0) {
      setError(t('stock.purchase.errors.delta_required'));
      return;
    }

    const priceValue = parseDecimal(form.price);
    let amount: number | null = null;
    if (priceValue !== null) {
      if (priceValue < 0) {
        setError(t('stock.purchase.errors.price_invalid'));
        return;
      }
      amount = form.priceMode === 'unit' ? priceValue * delta : priceValue;
    }

    const occurredAt = form.occurredAt
      ? new Date(`${form.occurredAt}T12:00:00`).toISOString()
      : null;

    try {
      await purchaseMutation.mutateAsync({
        id: item.id,
        payload: {
          delta,
          amount,
          supplier: form.supplier.trim(),
          occurred_at: occurredAt,
          notes: form.notes.trim(),
        },
      });
      onOpenChange(false);
    } catch {
      setError(t('stock.purchase.errors.save_failed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('stock.purchase.title', { name: item.name })}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t('stock.purchase.current_quantity', { quantity: item.quantity, unit: item.unit })}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <FormField
            label={`${t('stock.purchase.fields.delta', { unit: item.unit })} *`}
            htmlFor="stock-purchase-delta"
          >
            <Input
              id="stock-purchase-delta"
              type="number"
              step="0.001"
              min="0"
              value={form.delta}
              onChange={(e) => updateField('delta', e.target.value)}
              required
              autoFocus
            />
          </FormField>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {t('stock.purchase.fields.price')}
              </span>
              <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => updateField('priceMode', 'total')}
                  className={`rounded px-2 py-1 ${form.priceMode === 'total' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {t('stock.purchase.price_mode.total')}
                </button>
                <button
                  type="button"
                  onClick={() => updateField('priceMode', 'unit')}
                  className={`rounded px-2 py-1 ${form.priceMode === 'unit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                >
                  {t('stock.purchase.price_mode.unit', { unit: item.unit })}
                </button>
              </div>
            </div>
            <Input
              id="stock-purchase-price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
              placeholder={t('stock.purchase.fields.price_placeholder')}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('stock.purchase.fields.supplier')} htmlFor="stock-purchase-supplier">
              <Input
                id="stock-purchase-supplier"
                value={form.supplier}
                onChange={(e) => updateField('supplier', e.target.value)}
                autoComplete="off"
              />
            </FormField>
            <FormField label={t('stock.purchase.fields.occurred_at')} htmlFor="stock-purchase-date">
              <Input
                id="stock-purchase-date"
                type="date"
                value={form.occurredAt}
                onChange={(e) => updateField('occurredAt', e.target.value)}
              />
            </FormField>
          </div>

          <FormField label={t('stock.purchase.fields.notes')} htmlFor="stock-purchase-notes">
            <Textarea
              id="stock-purchase-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </FormField>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={purchaseMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={purchaseMutation.isPending}>
              {purchaseMutation.isPending
                ? t('stock.purchase.actions.saving')
                : t('stock.purchase.actions.confirm')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
