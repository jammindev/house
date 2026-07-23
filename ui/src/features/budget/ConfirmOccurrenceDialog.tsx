import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import type { RecurringExpense } from '@/lib/api/budget';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recurring: RecurringExpense | null;
  /** Called with the (possibly edited) amount for this occurrence. */
  onConfirm: (amount: number) => Promise<void> | void;
  isPending: boolean;
}

export default function ConfirmOccurrenceDialog({
  open,
  onOpenChange,
  recurring,
  onConfirm,
  isPending,
}: Props) {
  const { t } = useTranslation();
  const [amount, setAmount] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && recurring) {
      setAmount(recurring.amount);
      setError(null);
    }
  }, [open, recurring]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('recurring.errors.amountInvalid'));
      return;
    }
    await onConfirm(parsed);
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('recurring.confirm.title')}
      description={recurring ? recurring.label : undefined}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">{t('recurring.confirm.hint')}</p>
        <FormField label={`${t('recurring.confirm.amount')} *`} htmlFor="confirm-amount">
          <Input
            id="confirm-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
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
          <Button type="submit" disabled={isPending}>
            {t('recurring.confirm.action')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
