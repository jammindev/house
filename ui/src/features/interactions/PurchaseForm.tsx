import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';

export interface PurchaseFormPayload {
  delta?: number;
  amount: number | null;
  supplier: string;
  occurred_at: string | null;
  notes: string;
}

interface PurchaseFormProps {
  /** Show a "quantity added" input. Stock items use this; equipment doesn't. */
  withDelta?: boolean;
  /** Unit label shown next to the delta and as the "per X" toggle option. */
  deltaUnit?: string;
  /** True while the parent mutation is in flight. */
  isPending: boolean;
  onSubmit: (payload: PurchaseFormPayload) => void | Promise<void>;
  onCancel: () => void;
  /** Optional submit-time error message to display above the buttons. */
  externalError?: string | null;
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

function emptyState(): FormState {
  return {
    delta: '',
    priceMode: 'total',
    price: '',
    supplier: '',
    occurredAt: todayIsoDate(),
    notes: '',
  };
}

function parseDecimal(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PurchaseForm({
  withDelta = false,
  deltaUnit,
  isPending,
  onSubmit,
  onCancel,
  externalError,
}: PurchaseFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState<FormState>(emptyState);
  const [internalError, setInternalError] = React.useState<string | null>(null);

  const error = externalError ?? internalError;

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInternalError(null);

    let delta: number | undefined;
    if (withDelta) {
      const parsedDelta = parseDecimal(form.delta);
      if (parsedDelta === null || parsedDelta <= 0) {
        setInternalError(t('purchase.errors.delta_required'));
        return;
      }
      delta = parsedDelta;
    }

    const priceValue = parseDecimal(form.price);
    let amount: number | null = null;
    if (priceValue !== null) {
      if (priceValue < 0) {
        setInternalError(t('purchase.errors.price_invalid'));
        return;
      }
      amount = withDelta && form.priceMode === 'unit' && delta !== undefined
        ? priceValue * delta
        : priceValue;
    }

    const occurredAt = form.occurredAt
      ? new Date(`${form.occurredAt}T12:00:00`).toISOString()
      : null;

    await onSubmit({
      delta,
      amount,
      supplier: form.supplier.trim(),
      occurred_at: occurredAt,
      notes: form.notes.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {withDelta ? (
        <FormField
          label={`${t('purchase.fields.delta', { unit: deltaUnit ?? '' })} *`}
          htmlFor="purchase-delta"
        >
          <Input
            id="purchase-delta"
            type="number"
            step="0.001"
            min="0"
            value={form.delta}
            onChange={(e) => updateField('delta', e.target.value)}
            required
            autoFocus
          />
        </FormField>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {t('purchase.fields.price')}
          </span>
          {withDelta && deltaUnit ? (
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => updateField('priceMode', 'total')}
                className={`rounded px-2 py-1 ${form.priceMode === 'total' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {t('purchase.price_mode.total')}
              </button>
              <button
                type="button"
                onClick={() => updateField('priceMode', 'unit')}
                className={`rounded px-2 py-1 ${form.priceMode === 'unit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                {t('purchase.price_mode.unit', { unit: deltaUnit })}
              </button>
            </div>
          ) : null}
        </div>
        <Input
          id="purchase-price"
          type="number"
          step="0.01"
          min="0"
          value={form.price}
          onChange={(e) => updateField('price', e.target.value)}
          placeholder={t('purchase.fields.price_placeholder')}
          autoFocus={!withDelta}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label={t('purchase.fields.supplier')} htmlFor="purchase-supplier">
          <Input
            id="purchase-supplier"
            value={form.supplier}
            onChange={(e) => updateField('supplier', e.target.value)}
            autoComplete="off"
          />
        </FormField>
        <FormField label={t('purchase.fields.occurred_at')} htmlFor="purchase-date">
          <Input
            id="purchase-date"
            type="date"
            value={form.occurredAt}
            onChange={(e) => updateField('occurredAt', e.target.value)}
          />
        </FormField>
      </div>

      <FormField label={t('purchase.fields.notes')} htmlFor="purchase-notes">
        <Textarea
          id="purchase-notes"
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
          onClick={onCancel}
          disabled={isPending}
        >
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t('purchase.actions.saving') : t('purchase.actions.confirm')}
        </Button>
      </div>
    </form>
  );
}
