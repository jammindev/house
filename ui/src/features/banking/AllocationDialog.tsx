import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import type { AllocationLine, BankTransaction } from '@/lib/api/banking';
import { useBudgets } from '@/features/budget/hooks';
import { useAllocations, useSetAllocations } from './hooks';

interface AllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction;
}

interface DraftLine {
  key: string;
  subject: string;
  amount: string;
  budgetId: string;
}

let lineCounter = 0;
function blankLine(subject = '', amount = '', budgetId = ''): DraftLine {
  lineCounter += 1;
  return { key: `line-${lineCounter}`, subject, amount, budgetId };
}

/**
 * Ventile une opération en un ou plusieurs postes.
 *
 * Chaque ligne devient une dépense du journal, avec son propre budget — c'est
 * précisément ce qui permet à 120 € au supermarché d'être 80 € de courses et
 * 40 € de bricolage. L'enregistrement est un **remplacement complet** : on
 * envoie la ventilation voulue, pas une suite de modifications.
 */
export default function AllocationDialog({
  open,
  onOpenChange,
  transaction,
}: AllocationDialogProps) {
  const { t } = useTranslation();
  const allocationsQuery = useAllocations(open ? transaction.id : undefined);
  const budgetsQuery = useBudgets();
  const mutation = useSetAllocations();

  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const total = Math.abs(Number(transaction.amount));

  React.useEffect(() => {
    if (!open || !allocationsQuery.data) return;
    setError(null);
    const existing = allocationsQuery.data.allocations;
    setLines(
      existing.length > 0
        ? existing.map((a) => blankLine(a.subject, a.amount ?? '', a.budget?.id ?? ''))
        : // Première ventilation : on pré-remplit une ligne au montant total,
          // le cas le plus fréquent (une opération = un poste).
          [blankLine(transaction.label_raw, total.toFixed(2), '')],
    );
  }, [open, allocationsQuery.data, transaction.label_raw, total]);

  const allocated = lines.reduce((sum, line) => {
    const value = Number(line.amount.replace(',', '.'));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const remaining = total - allocated;

  function update(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine('', remaining > 0 ? remaining.toFixed(2) : '', '')]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: AllocationLine[] = [];
    for (const line of lines) {
      const value = Number(line.amount.replace(',', '.'));
      if (!Number.isFinite(value) || value <= 0) {
        setError(t('banking.allocation.errors.amountInvalid'));
        return;
      }
      payload.push({
        subject: line.subject.trim() || transaction.label_raw,
        amount: value.toFixed(2),
        budget_id: line.budgetId || null,
      });
    }

    if (allocated > total + 0.001) {
      setError(t('banking.allocation.errors.overAllocated', { total: formatAmount(String(total)) }));
      return;
    }

    try {
      await mutation.mutateAsync({ transactionId: transaction.id, lines: payload });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const budgetOptions = [
    { value: '', label: t('banking.allocation.noBudget') },
    ...(budgetsQuery.data ?? [])
      .filter((b) => !b.is_global)
      .map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.allocation.title')}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">{transaction.label_raw}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.booked_on).toLocaleDateString()} ·{' '}
            {formatAmount(transaction.amount)}
          </p>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div key={line.key} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('banking.allocation.line', { n: index + 1 })}
                </span>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t('banking.allocation.removeLine')}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <FormField label={t('banking.allocation.fields.subject')} htmlFor={`s-${line.key}`}>
                  <Input
                    id={`s-${line.key}`}
                    value={line.subject}
                    onChange={(e) => update(line.key, { subject: e.target.value })}
                    placeholder={transaction.label_raw}
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    label={t('banking.allocation.fields.amount')}
                    htmlFor={`a-${line.key}`}
                  >
                    <Input
                      id={`a-${line.key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount}
                      onChange={(e) => update(line.key, { amount: e.target.value })}
                    />
                  </FormField>

                  <FormField
                    label={t('banking.allocation.fields.budget')}
                    htmlFor={`b-${line.key}`}
                  >
                    <Select
                      id={`b-${line.key}`}
                      value={line.budgetId}
                      onChange={(e) => update(line.key, { budgetId: e.target.value })}
                      options={budgetOptions}
                    />
                  </FormField>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          {t('banking.allocation.addLine')}
        </Button>

        <div
          className={`rounded-lg border p-3 text-sm ${
            remaining < -0.001
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-border bg-muted/40 text-foreground'
          }`}
        >
          <div className="flex justify-between">
            <span>{t('banking.allocation.allocated')}</span>
            <span className="font-semibold tabular-nums">{formatAmount(allocated.toFixed(2))}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>{t('banking.allocation.remaining')}</span>
            <span className="font-semibold tabular-nums">{formatAmount(remaining.toFixed(2))}</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
