import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { DecimalInput } from '@/design-system/decimal-input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import type { BankAccount, BankTransaction } from '@/lib/api/banking';
import { useWithdrawToCash } from './hooks';

interface WithdrawToCashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction;
  cashAccounts: BankAccount[];
}

/**
 * Verse un retrait sur un compte espèces.
 *
 * Proposé, jamais imposé : tous les retraits ne finissent pas dans le pot commun
 * du foyer. Le montant est modifiable pour couvrir le cas où seule une partie y
 * arrive.
 */
export default function WithdrawToCashDialog({
  open,
  onOpenChange,
  transaction,
  cashAccounts,
}: WithdrawToCashDialogProps) {
  const { t } = useTranslation();
  const mutation = useWithdrawToCash();

  const fullAmount = Math.abs(Number(transaction.amount)).toFixed(2);
  const [cashAccount, setCashAccount] = React.useState('');
  const [amount, setAmount] = React.useState(fullAmount);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setAmount(fullAmount);
    setCashAccount(cashAccounts[0]?.id ?? '');
  }, [open, fullAmount, cashAccounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!cashAccount) {
      setError(t('banking.withdraw.errors.accountRequired'));
      return;
    }
    const parsed = Number(amount.trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > Number(fullAmount)) {
      setError(t('banking.withdraw.errors.amountInvalid', { max: formatAmount(fullAmount) }));
      return;
    }

    try {
      await mutation.mutateAsync({
        transactionId: transaction.id,
        payload: { cash_account: cashAccount, amount: parsed.toFixed(2) },
      });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.withdraw.title')}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">{t('banking.withdraw.intro')}</p>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">{transaction.label_raw}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.booked_on).toLocaleDateString()} ·{' '}
            {formatAmount(transaction.amount)}
          </p>
        </div>

        {cashAccounts.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            {t('banking.withdraw.noCashAccount')}
          </div>
        ) : (
          <>
            <FormField label={t('banking.withdraw.fields.account')} htmlFor="cash-account">
              <Select
                id="cash-account"
                value={cashAccount}
                onChange={(e) => setCashAccount(e.target.value)}
                options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
              />
            </FormField>

            <FormField label={t('banking.withdraw.fields.amount')} htmlFor="cash-amount">
              <DecimalInput
                id="cash-amount"
                value={amount}
                onChange={setAmount}
              />
              <p className="text-xs text-muted-foreground">{t('banking.withdraw.fields.amountHint')}</p>
            </FormField>
          </>
        )}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending || cashAccounts.length === 0}>
            {t('banking.withdraw.action')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
