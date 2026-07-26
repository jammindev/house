import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { useBudgets } from '@/features/budget/hooks';
import {
  useBankAccounts,
  useCreateBankAccount,
  useRecordCashExpense,
} from '@/features/banking/hooks';

interface CashExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dépense en espèces — l'ancienne « dépense ad hoc », devenue une opération de
 * compte (parcours 26, lot 4).
 *
 * Ce qui change n'est pas le formulaire, c'est ce qu'il écrit. Une dépense qui
 * n'existe que comme `Interaction` est une dépense que la banque n'a jamais vue :
 * le contrôle de conformité ne peut que la signaler, et personne ne peut la
 * résoudre. En passant par le compte espèces, l'orphelin disparaît **par
 * construction** — au lieu d'apprendre à l'utilisateur à l'arbitrer chaque mois.
 *
 * Sans compte espèces déclaré il n'y a rien à écrire — mais renvoyer l'utilisateur
 * vers un autre onglet au moment où il veut noter une dépense serait un cul-de-sac.
 * Le dialog propose donc de créer le compte **sur place, en un clic** : la
 * contrainte est tenue sans que la saisie soit interrompue.
 */
export default function CashExpenseDialog({ open, onOpenChange }: CashExpenseDialogProps) {
  const { t } = useTranslation();
  const accountsQuery = useBankAccounts();
  const { data: budgets } = useBudgets();
  const mutation = useRecordCashExpense();
  const createAccount = useCreateBankAccount();

  const [label, setLabel] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [budgetId, setBudgetId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const cashAccounts = React.useMemo(
    () => (accountsQuery.data ?? []).filter((a) => a.kind === 'cash'),
    [accountsQuery.data],
  );

  const budgetOptions = React.useMemo(
    () => (budgets ?? []).filter((b) => !b.is_global).map((b) => ({ value: b.id, label: b.name })),
    [budgets],
  );

  React.useEffect(() => {
    if (!open) {
      setLabel('');
      setBudgetId('');
      setError(null);
      return;
    }
    // Un seul compte espèces est le cas normal : le pré-sélectionner épargne un
    // champ à remplir sur la saisie la plus fréquente de l'app.
    setAccountId((prev) => prev || cashAccounts[0]?.id || '');
  }, [open, cashAccounts]);

  async function handleSubmit(payload: PurchaseFormPayload) {
    setError(null);
    if (!label.trim()) {
      setError(t('banking.cash.labelRequired'));
      return;
    }
    if (!accountId) {
      setError(t('banking.cash.accountRequired'));
      return;
    }
    if (!payload.amount || Number(payload.amount) <= 0) {
      setError(t('banking.cash.amountRequired'));
      return;
    }

    try {
      await mutation.mutateAsync({
        account: accountId,
        label: label.trim(),
        // `PurchaseForm` renvoie un `number` ; l'API attend une décimale en
        // string, comme partout ailleurs sur les montants.
        amount: payload.amount.toFixed(2),
        // `occurred_at` du form est un datetime ; l'opération de compte est datée
        // au jour, comme toute ligne de relevé.
        booked_on: payload.occurred_at ? payload.occurred_at.slice(0, 10) : undefined,
        budget_id: budgetId || null,
        notes: payload.notes,
      });
      onOpenChange(false);
    } catch {
      setError(t('purchase.errors.save_failed'));
    }
  }

  async function createCashAccount() {
    setError(null);
    try {
      const created = await createAccount.mutateAsync({
        name: t('banking.cash.defaultAccountName'),
        kind: 'cash',
        // Un compte espèces qui démarre à zéro aujourd'hui est le point de départ
        // honnête : c'est aussi le prérequis de conformité (sans date d'ouverture,
        // aucun contrôle ne porte sur ce compte).
        opening_balance: '0',
        opening_balance_date: new Date().toISOString().slice(0, 10),
      });
      setAccountId(created.id);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const hasCashAccount = cashAccounts.length > 0;

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.cash.title')}>
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
            <Button
              type="button"
              onClick={createCashAccount}
              disabled={createAccount.isPending}
            >
              {t('banking.cash.createAccount')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <FormField label={`${t('banking.cash.label')} *`} htmlFor="cash-label">
            <Input
              id="cash-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('banking.cash.labelPlaceholder')}
              autoFocus
              required
            />
          </FormField>

          {cashAccounts.length > 1 ? (
            <FormField label={t('banking.cash.account')} htmlFor="cash-account">
              <Select
                id="cash-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
              />
            </FormField>
          ) : null}

          {budgetOptions.length > 0 ? (
            <FormField label={t('banking.cash.budget')} htmlFor="cash-budget">
              <Select
                id="cash-budget"
                value={budgetId}
                onChange={(e) => setBudgetId(e.target.value)}
                placeholder={t('banking.cash.budgetNone')}
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
        </>
      )}
    </SheetDialog>
  );
}
