import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Landmark } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { todayISO } from '@/lib/format';
import {
  useBankAccounts,
  useCreateBankAccount,
  useRecordCashExpense,
} from '@/features/banking/hooks';
import { useCreateManualExpense } from '@/features/expenses/hooks';
import type { BankAccount } from '@/lib/api/banking';

/** Comment la dépense a été payée. C'est la seule question qui change ce qu'on écrit. */
type PaidWith = 'cash' | 'other';

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Pré-verrouille la saisie sur ce compte espèces. Posé depuis la fiche d'un
   * compte espèces, où demander « payé avec quoi ? » serait absurde : on est déjà
   * sur le compte.
   */
  cashAccount?: BankAccount;
}

/**
 * Saisir une dépense — **une seule porte**, qui demande comment on a payé.
 *
 * Il y en avait deux, du même nom, qui n'écrivaient pas la même chose : le bouton
 * « Dépense » du dashboard créait une `Interaction` nue, celui de l'onglet Dépenses
 * forçait un **compte espèces**. Une dépense par carte n'avait donc aucun chemin
 * juste : la passer par l'onglet Dépenses la comptait en liquide et faussait le
 * solde des espèces — jusqu'à déclencher « espèces à découvert », un écart qui ne
 * s'arbitre pas.
 *
 * Les deux branches sont légitimes, et c'est le moyen de paiement qui les sépare :
 *
 * - **espèces** → une vraie opération de compte (`record_cash_expense`). Rien ne
 *   sera jamais importé sur un compte espèces, donc la ligne saisie *est* la
 *   vérité ; l'orphelin disparaît par construction.
 * - **carte, virement, prélèvement** → une `Interaction` seule, et **aucune ligne
 *   bancaire**. En fabriquer une serait le vrai danger : son `dedup_hash` vaut
 *   `manual:{uuid4}` et ne peut par construction jamais coïncider avec une ligne
 *   importée — le relevé ajouterait donc une seconde ligne pour la même dépense.
 *
 * **On ne demande pas *quel* compte bancaire**, volontairement. La fenêtre de
 * conformité d'une dépense est calculée à l'échelle du **foyer**
 * (`coverage.household_covered_period`), dont le commentaire dit pourquoi : la
 * restreindre par compte « demanderait de deviner quel compte a payé, ce qui est
 * exactement le fait qui manque ». Collecter cette information n'aurait aucun
 * consommateur.
 *
 * Et une dépense par carte en attente n'est **pas** un écart : le détecteur borne
 * son horizon au dernier relevé connu, donc une dépense postérieure « attend
 * simplement le prochain import ».
 */
export default function ExpenseDialog({
  open,
  onOpenChange,
  cashAccount,
}: ExpenseDialogProps) {
  const { t } = useTranslation();
  const locked = Boolean(cashAccount);

  const accountsQuery = useBankAccounts();
  const cashMutation = useRecordCashExpense();
  const manualMutation = useCreateManualExpense();
  const createAccount = useCreateBankAccount();

  const [paidWith, setPaidWith] = React.useState<PaidWith>('other');
  const [label, setLabel] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const cashAccounts = React.useMemo(
    () => (accountsQuery.data ?? []).filter((a) => a.kind === 'cash' && !a.archived),
    [accountsQuery.data],
  );

  React.useEffect(() => {
    if (!open) {
      setLabel('');
      setError(null);
      return;
    }
    if (cashAccount) {
      setPaidWith('cash');
      setAccountId(cashAccount.id);
      return;
    }
    // Un seul compte espèces est le cas normal : le pré-sélectionner épargne un
    // champ à remplir sur la saisie la plus fréquente de l'app.
    setAccountId((prev) => prev || cashAccounts[0]?.id || '');
  }, [open, cashAccount, cashAccounts]);

  const payingCash = paidWith === 'cash';
  const needsCashAccount = payingCash && !locked && cashAccounts.length === 0;
  const isPending = payingCash ? cashMutation.isPending : manualMutation.isPending;

  async function handleSubmit(payload: PurchaseFormPayload) {
    setError(null);
    if (!label.trim()) {
      setError(t('money.expense.new.labelRequired'));
      return;
    }

    try {
      if (payingCash) {
        if (!accountId) {
          setError(t('banking.cash.accountRequired'));
          return;
        }
        // Une opération de compte a besoin d'un montant : sans lui il n'y a pas de
        // ligne à écrire. Une dépense en attente, elle, peut n'être qu'un rappel.
        if (!payload.amount || Number(payload.amount) <= 0) {
          setError(t('banking.cash.amountRequired'));
          return;
        }
        await cashMutation.mutateAsync({
          account: accountId,
          label: label.trim(),
          // L'API attend une décimale en string, comme partout sur les montants.
          amount: payload.amount.toFixed(2),
          // L'opération de compte est datée au jour, comme toute ligne de relevé.
          booked_on: payload.occurred_at ? payload.occurred_at.slice(0, 10) : undefined,
          budget_id: payload.budget_id,
          notes: payload.notes,
        });
      } else {
        await manualMutation.mutateAsync({
          subject: label.trim(),
          amount: payload.amount,
          supplier: payload.supplier,
          occurred_at: payload.occurred_at,
          notes: payload.notes,
          budget_id: payload.budget_id,
        });
      }
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
        opening_balance_date: todayISO(),
      });
      setAccountId(created.id);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const title = locked ? t('banking.cash.title') : t('money.expense.new.title');

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={title}>
      <FormField label={`${t('money.expense.new.label')} *`} htmlFor="expense-label">
        <Input
          id="expense-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('money.expense.new.labelPlaceholder')}
          autoFocus
          required
        />
      </FormField>

      {!locked ? (
        <FormField label={t('money.expense.new.paidWith')} htmlFor="expense-paid-with">
          <Select
            id="expense-paid-with"
            value={paidWith}
            onChange={(e) => setPaidWith(e.target.value as PaidWith)}
            options={[
              { value: 'other', label: t('money.expense.new.paidWithOther') },
              { value: 'cash', label: t('money.expense.new.paidWithCash') },
            ]}
          />
        </FormField>
      ) : null}

      {!payingCash ? (
        <p className="text-sm text-muted-foreground">{t('money.expense.new.pendingHint')}</p>
      ) : null}

      {payingCash && !locked && cashAccounts.length > 1 ? (
        <FormField label={t('banking.cash.account')} htmlFor="expense-cash-account">
          <Select
            id="expense-cash-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={cashAccounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        </FormField>
      ) : null}

      {needsCashAccount ? (
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
        <PurchaseForm
          isPending={isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          externalError={error}
        />
      )}
    </SheetDialog>
  );
}
