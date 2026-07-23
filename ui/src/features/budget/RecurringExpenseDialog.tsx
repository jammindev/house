import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import type { Cadence, RecurringExpense } from '@/lib/api/budget';
import { useBudgets, useCreateRecurringExpense, useUpdateRecurringExpense } from './hooks';

const CADENCES: Cadence[] = ['monthly', 'quarterly', 'yearly'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: RecurringExpense;
}

export default function RecurringExpenseDialog({ open, onOpenChange, existing }: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateRecurringExpense();
  const updateMutation = useUpdateRecurringExpense();
  const isPending = createMutation.isPending || updateMutation.isPending;
  const { data: budgets } = useBudgets();

  const [label, setLabel] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [cadence, setCadence] = React.useState<Cadence>('monthly');
  const [nextDue, setNextDue] = React.useState(todayIso());
  const [supplier, setSupplier] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [budgetId, setBudgetId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const budgetOptions = React.useMemo(
    () => (budgets ?? []).filter((b) => !b.is_global).map((b) => ({ value: b.id, label: b.name })),
    [budgets],
  );

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existing) {
      setLabel(existing.label);
      setAmount(existing.amount);
      setCadence(existing.cadence);
      setNextDue(existing.next_due_date);
      setSupplier(existing.supplier);
      setNotes(existing.notes);
      setBudgetId(existing.budget?.id ?? '');
    } else {
      setLabel('');
      setAmount('');
      setCadence('monthly');
      setNextDue(todayIso());
      setSupplier('');
      setNotes('');
      setBudgetId('');
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount.trim().replace(',', '.'));
    if (!label.trim()) {
      setError(t('recurring.errors.labelRequired'));
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('recurring.errors.amountInvalid'));
      return;
    }
    if (!nextDue) {
      setError(t('recurring.errors.dateRequired'));
      return;
    }
    const payload = {
      label: label.trim(),
      amount: parsed,
      cadence,
      next_due_date: nextDue,
      supplier: supplier.trim(),
      notes: notes.trim(),
      budget_id: budgetId || null,
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
      title={isEditing ? t('recurring.edit.title') : t('recurring.new.title')}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <FormField label={`${t('recurring.fields.label')} *`} htmlFor="rec-label">
          <Input
            id="rec-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('recurring.fields.labelPlaceholder')}
            autoFocus
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={`${t('recurring.fields.amount')} *`} htmlFor="rec-amount">
            <Input
              id="rec-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
          <FormField label={t('recurring.fields.cadence')} htmlFor="rec-cadence">
            <Select
              id="rec-cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              options={CADENCES.map((c) => ({ value: c, label: t(`recurring.cadence.${c}`) }))}
            />
          </FormField>
          <FormField label={`${t('recurring.fields.nextDue')} *`} htmlFor="rec-due">
            <Input
              id="rec-due"
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
            />
          </FormField>
          <FormField label={t('recurring.fields.supplier')} htmlFor="rec-supplier">
            <Input
              id="rec-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              autoComplete="off"
            />
          </FormField>
        </div>

        {budgetOptions.length > 0 ? (
          <FormField label={t('recurring.fields.budget')} htmlFor="rec-budget">
            <Select
              id="rec-budget"
              value={budgetId}
              onChange={(e) => setBudgetId(e.target.value)}
              placeholder={t('recurring.fields.budgetNone')}
              options={budgetOptions}
            />
          </FormField>
        ) : null}

        <FormField label={t('recurring.fields.notes')} htmlFor="rec-notes">
          <Textarea id="rec-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
