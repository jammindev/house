import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { useBudgets } from '@/features/budget/hooks';
import { useCreateManualExpense } from './hooks';

interface ExpenseAdHocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExpenseAdHocDialog({ open, onOpenChange }: ExpenseAdHocDialogProps) {
  const { t } = useTranslation();
  const mutation = useCreateManualExpense();
  const { data: budgets } = useBudgets();
  const [subject, setSubject] = React.useState('');
  const [budgetId, setBudgetId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const budgetOptions = React.useMemo(
    () =>
      (budgets ?? [])
        .filter((b) => !b.is_global)
        .map((b) => ({ value: b.id, label: b.name })),
    [budgets],
  );

  React.useEffect(() => {
    if (!open) {
      setSubject('');
      setBudgetId('');
      setError(null);
    }
  }, [open]);

  async function handleSubmit(payload: PurchaseFormPayload) {
    setError(null);
    if (!subject.trim()) {
      setError(t('expenses.adhoc.subjectRequired'));
      return;
    }
    try {
      await mutation.mutateAsync({
        subject: subject.trim(),
        amount: payload.amount,
        supplier: payload.supplier,
        occurred_at: payload.occurred_at,
        notes: payload.notes,
        budget_id: budgetId || null,
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
      title={t('expenses.adhoc.title')}
    >
        <FormField label={`${t('expenses.adhoc.subject')} *`} htmlFor="adhoc-subject">
          <Input
            id="adhoc-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('expenses.adhoc.subjectPlaceholder')}
            autoFocus
            required
          />
        </FormField>

        {budgetOptions.length > 0 ? (
          <FormField label={t('expenses.adhoc.budget')} htmlFor="adhoc-budget">
            <Select
              id="adhoc-budget"
              value={budgetId}
              onChange={(e) => setBudgetId(e.target.value)}
              placeholder={t('expenses.adhoc.budgetNone')}
              options={budgetOptions}
            />
          </FormField>
        ) : null}

        <PurchaseForm
          isPending={mutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          externalError={error}
        />
    </SheetDialog>
  );
}
