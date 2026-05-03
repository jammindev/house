import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { useCreateManualExpense } from './hooks';

interface ExpenseAdHocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExpenseAdHocDialog({ open, onOpenChange }: ExpenseAdHocDialogProps) {
  const { t } = useTranslation();
  const mutation = useCreateManualExpense();
  const [subject, setSubject] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSubject('');
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
      });
      onOpenChange(false);
    } catch {
      setError(t('purchase.errors.save_failed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('expenses.adhoc.title')}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
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
        </div>

        <PurchaseForm
          isPending={mutation.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          externalError={error}
        />
      </DialogContent>
    </Dialog>
  );
}
