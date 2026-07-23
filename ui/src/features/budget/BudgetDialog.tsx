import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { CheckboxField } from '@/design-system/checkbox-field';
import type { Budget } from '@/lib/api/budget';
import { useCreateBudget, useUpdateBudget } from './hooks';

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = create, defined = edit. */
  existing?: Budget;
  /** Show the "global budget" toggle (hidden when a global already exists). */
  allowGlobal: boolean;
}

export default function BudgetDialog({ open, onOpenChange, existing, allowGlobal }: BudgetDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [isGlobal, setIsGlobal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existing) {
      setName(existing.name);
      setAmount(existing.monthly_amount);
      setIsGlobal(existing.is_global);
    } else {
      setName('');
      setAmount('');
      setIsGlobal(false);
    }
  }, [open, existing]);

  // The global budget covers everything and needs no name — it's identified by
  // its flag. Named budgets require a name.
  const nameRequired = !isGlobal;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = Number(amount.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('budget.errors.amountInvalid'));
      return;
    }
    if (nameRequired && !name.trim()) {
      setError(t('budget.errors.nameRequired'));
      return;
    }

    const payload = {
      name: isGlobal ? (name.trim() || t('budget.global.defaultName')) : name.trim(),
      monthly_amount: parsed,
      is_global: isGlobal,
    };

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('budget.edit.title') : t('budget.new.title')}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {allowGlobal && !isEditing ? (
          <CheckboxField
            id="budget-is-global"
            label={t('budget.fields.isGlobal')}
            checked={isGlobal}
            onChange={setIsGlobal}
          />
        ) : null}

        {!isGlobal ? (
          <FormField label={`${t('budget.fields.name')} *`} htmlFor="budget-name">
            <Input
              id="budget-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('budget.fields.namePlaceholder')}
              autoFocus
            />
          </FormField>
        ) : (
          <p className="text-sm text-muted-foreground">{t('budget.global.hint')}</p>
        )}

        <FormField label={`${t('budget.fields.monthlyAmount')} *`} htmlFor="budget-amount">
          <Input
            id="budget-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus={isGlobal}
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
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
