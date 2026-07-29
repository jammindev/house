import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark, Plus, Trash2 } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { formatAmount, todayISO } from '@/lib/format';
import { useBudgets } from '@/features/budget/hooks';
import { selectableBudgets } from '@/features/budget/tree';
import {
  useBankAccounts,
  useCreateBankAccount,
  useRecordCashDeposit,
} from '@/features/banking/hooks';
import type { CashDepositPayload } from '@/lib/api/banking';

interface CashDepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** `transfer` est absent : le serveur le refuse, voir plus bas. */
const NATURES = ['other', 'refund', 'salary'] as const;

interface DraftLine {
  key: string;
  budgetId: string;
  amount: string;
}

let lineCounter = 0;
function blankLine(amount = ''): DraftLine {
  lineCounter += 1;
  return { key: `deposit-${lineCounter}`, budgetId: '', amount };
}

/**
 * Une **rentrée** d'espèces — la moitié manquante de l'histoire du liquide.
 *
 * Jusqu'ici les espèces ne pouvaient entrer qu'en miroir d'un retrait bancaire.
 * Un billet donné à un repas de famille, un vélo vendu, la part d'un ami payée en
 * pièces n'avaient donc **aucune représentation** : le seul conseil possible était
 * de gonfler le solde d'ouverture du compte espèces, c'est-à-dire de réécrire
 * l'histoire pour enregistrer un fait daté. C'est exactement le genre de mensonge
 * que le module refuse partout ailleurs.
 *
 * ⚠️ **Pas de « transfert interne » ici.** Un mouvement interne promet une
 * contrepartie sur un autre compte suivi ; les espèces venues d'un retrait ont
 * déjà leur chemin (« Verser en caisse » sur la ligne de retrait). En déclarer un
 * à la main laisserait une jambe dont rien ne fournira jamais l'autre moitié —
 * l'écart `internal_without_counterpart`, fabriqué par le geste censé combler un
 * trou.
 *
 * Née **classée**, comme la dépense en espèces naît ventilée : la nature est
 * obligatoire, sinon la rentrée atterrirait dans « À ranger » et l'app se
 * fabriquerait son propre travail.
 */
export default function CashDepositDialog({ open, onOpenChange }: CashDepositDialogProps) {
  const { t } = useTranslation();
  const accountsQuery = useBankAccounts();
  const mutation = useRecordCashDeposit();
  const createAccount = useCreateBankAccount();
  const budgetsQuery = useBudgets();
  const budgetOptions = React.useMemo(
    () => selectableBudgets(budgetsQuery.data),
    [budgetsQuery.data],
  );

  const [label, setLabel] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [bookedOn, setBookedOn] = React.useState(todayISO());
  const [nature, setNature] = React.useState<(typeof NATURES)[number]>('other');
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [accountId, setAccountId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const cashAccounts = React.useMemo(
    () => (accountsQuery.data ?? []).filter((a) => a.kind === 'cash'),
    [accountsQuery.data],
  );

  React.useEffect(() => {
    if (!open) return;
    setLabel('');
    setAmount('');
    setBookedOn(todayISO());
    setNature('other');
    setLines([blankLine()]);
    setNotes('');
    setError(null);
    setAccountId((prev) => prev || cashAccounts[0]?.id || '');
  }, [open, cashAccounts]);

  const total = Number(amount.replace(',', '.')) || 0;
  const credited = lines.reduce((sum, line) => {
    const value = Number(line.amount.replace(',', '.'));
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const remaining = total - credited;
  const isRefund = nature === 'refund';

  function update(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError(t('banking.cash.labelRequired'));
      return;
    }
    if (!accountId) {
      setError(t('banking.cash.accountRequired'));
      return;
    }
    if (!(total > 0)) {
      setError(t('banking.cash.amountRequired'));
      return;
    }

    // Un remboursement en espèces recrédite une enveloppe comme n'importe quel
    // autre : ses parts partent dans le même appel, sinon il resterait l'écart
    // « remboursement dont le reste ne crédite rien ».
    const refundLines: { budget_id: string; amount: string }[] = [];
    if (isRefund) {
      for (const line of lines) {
        const value = Number(line.amount.replace(',', '.'));
        if (!line.budgetId && !line.amount.trim()) continue;
        if (!line.budgetId) {
          setError(t('banking.inflow.errors.budgetRequired'));
          return;
        }
        if (!Number.isFinite(value) || value <= 0) {
          setError(t('banking.inflow.errors.amountInvalid'));
          return;
        }
        refundLines.push({ budget_id: line.budgetId, amount: value.toFixed(2) });
      }
      if (credited > total + 0.001) {
        setError(
          t('banking.inflow.errors.overCredited', { total: formatAmount(total.toFixed(2)) }),
        );
        return;
      }
    }

    const payload: CashDepositPayload = {
      account: accountId,
      label: label.trim(),
      amount: total.toFixed(2),
      booked_on: bookedOn || undefined,
      inflow_nature: nature,
      notes,
    };
    if (isRefund && refundLines.length > 0) payload.refund_lines = refundLines;

    try {
      await mutation.mutateAsync(payload);
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  async function createCashAccount() {
    setError(null);
    try {
      const created = await createAccount.mutateAsync({
        name: t('banking.cash.defaultAccountName'),
        kind: 'cash',
        opening_balance: '0',
        opening_balance_date: todayISO(),
      });
      setAccountId(created.id);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const hasCashAccount = cashAccounts.length > 0;

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.deposit.title')}>
      {!hasCashAccount ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">{t('banking.cash.noAccount')}</p>
              <p className="text-muted-foreground">{t('banking.cash.noAccountHint')}</p>
            </div>
          </div>
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={createCashAccount} disabled={createAccount.isPending}>
              {t('banking.cash.createAccount')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <FormField label={`${t('banking.cash.label')} *`} htmlFor="deposit-label">
            <Input
              id="deposit-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('banking.deposit.labelPlaceholder')}
              autoFocus
              required
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={`${t('banking.deposit.amount')} *`} htmlFor="deposit-amount">
              <Input
                id="deposit-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </FormField>
            <FormField label={t('banking.deposit.date')} htmlFor="deposit-date">
              <Input
                id="deposit-date"
                type="date"
                value={bookedOn}
                onChange={(e) => setBookedOn(e.target.value)}
              />
            </FormField>
          </div>

          {cashAccounts.length > 1 ? (
            <FormField label={t('banking.cash.account')} htmlFor="deposit-account">
              <Select
                id="deposit-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
              />
            </FormField>
          ) : null}

          <FormField label={t('banking.inflow.nature')} htmlFor="deposit-nature">
            <Select
              id="deposit-nature"
              value={nature}
              onChange={(e) => setNature(e.target.value as (typeof NATURES)[number])}
              options={NATURES.map((value) => ({
                value,
                label: t(`banking.inflow.natures.${value}`),
              }))}
            />
            <p className="text-xs text-muted-foreground">{t('banking.deposit.natureHint')}</p>
          </FormField>

          {isRefund ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {t('banking.inflow.refundBudget')}
                </span>
                <span
                  className={`text-xs tabular-nums ${
                    remaining < -0.001 ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {t('banking.inflow.remaining', { amount: formatAmount(remaining.toFixed(2)) })}
                </span>
              </div>

              {lines.map((line, index) => (
                <div key={line.key} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      id={index === 0 ? 'deposit-refund-budget' : `deposit-refund-budget-${index}`}
                      aria-label={t('banking.inflow.refundBudget')}
                      value={line.budgetId}
                      onChange={(e) => update(line.key, { budgetId: e.target.value })}
                      options={[
                        { value: '', label: t('banking.inflow.refundBudgetNone') },
                        ...budgetOptions,
                      ]}
                    />
                  </div>
                  <Input
                    className="w-28"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-label={t('banking.inflow.refundAmount')}
                    value={line.amount}
                    onChange={(e) => update(line.key, { amount: e.target.value })}
                  />
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="mb-2 text-muted-foreground hover:text-destructive"
                      aria-label={t('banking.inflow.removeLine')}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines((prev) => [...prev, blankLine(remaining > 0 ? remaining.toFixed(2) : '')])
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('banking.inflow.addLine')}
              </Button>
            </div>
          ) : null}

          <FormField label={t('purchase.fields.notes')} htmlFor="deposit-notes">
            <Input
              id="deposit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            <Button type="submit" disabled={mutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      )}
    </SheetDialog>
  );
}
