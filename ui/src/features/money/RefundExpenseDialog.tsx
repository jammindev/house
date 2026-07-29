import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { DecimalInput } from '@/design-system/decimal-input';
import { formatAmount, formatDate } from '@/lib/format';
import type { BankTransaction } from '@/lib/api/banking';
import { useCreditBudgetFromRefund, useTransactions } from '@/features/banking/hooks';

interface RefundExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: { id: string; subject: string; amount: string | null; occurred_at: string };
  budget: { id: string; name: string };
}

/** Écart en jours entre la dépense et la ligne — le seul tri qui aide vraiment. */
function dayGap(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86_400_000);
}

/**
 * « Cette dépense m'a été remboursée » — le geste vu depuis la dépense.
 *
 * Même inversion de sens qu'`AttachToTransactionDialog`, pour la même raison :
 * le remboursement se désignait uniquement depuis la recette, alors que
 * l'utilisateur part de l'achat qu'il regrette. Et surtout, partir de la dépense
 * fait **disparaître la question du budget** — l'enveloppe est la sienne, House
 * n'a rien à demander (« Ne jamais demander une information que House peut
 * calculer », CLAUDE.md).
 *
 * ⚠️ **Ce dialogue ne relie pas la dépense au remboursement.** Il crédite une
 * *enveloppe*, calculée au moment du clic ; ensuite les deux vies sont
 * indépendantes — déplacer ou supprimer la dépense ne déplacera pas le crédit.
 * `RefundAllocation` pointe vers un budget, jamais vers une `Interaction`. D'où
 * le texte du dialogue, qui dit ce qui est écrit plutôt que de promettre un lien
 * qui n'existe pas.
 *
 * ⚠️ **L'écriture est additive** (`credit-budget`, jamais le `PUT` complet) : la
 * recette peut déjà créditer d'autres enveloppes rattachées par d'autres
 * dépenses, et un remplacement les effacerait en silence. Voir
 * `banking.services.credit_budget_from_refund`.
 */
export default function RefundExpenseDialog({
  open,
  onOpenChange,
  expense,
  budget,
}: RefundExpenseDialogProps) {
  const { t } = useTranslation();
  const creditMutation = useCreditBudgetFromRefund();

  const [amount, setAmount] = React.useState('');

  React.useEffect(() => {
    if (open) setAmount(expense.amount ?? '');
  }, [open, expense.amount]);

  const query = useTransactions(
    React.useMemo(() => ({ direction: 'in' as const }), []),
    50,
    { enabled: open },
  );

  /**
   * La place disponible sur une recette **pour cette enveloppe-ci**.
   *
   * Ce que cette enveloppe occupe déjà se libère, puisque l'écriture la
   * remplace : c'est exactement le `exclude_budget_id` du serveur. Sans ce
   * détail le dialogue interdirait de corriger un crédit qu'il vient d'écrire.
   */
  const roomFor = React.useCallback(
    (line: BankTransaction) => {
      const own = (line.refund_allocations ?? []).find((row) => row.budget === budget.id);
      return Number(line.refund_remaining ?? '0') + Number(own?.amount ?? '0');
    },
    [budget.id],
  );

  const value = Number(amount || '0');

  // Une recette déjà classée autrement n'est pas candidate : le serveur la
  // refuse (on n'écrase pas un choix explicite), donc l'afficher offrirait un
  // bouton qui échoue — pire que de ne rien proposer.
  const candidates = React.useMemo(() => {
    const rows = (query.data?.results ?? []).filter(
      (line) =>
        (line.inflow_nature === 'refund' || line.inflow_nature === '') && roomFor(line) > 0,
    );

    /**
     * Trois critères, dans cet ordre : ce qui peut porter le montant, puis le
     * **montant exact**, puis la proximité en date.
     *
     * Trier par date seule enterrait la seule ligne évidente. Un remboursement
     * arrive typiquement deux semaines après l'achat, donc une dizaine de
     * recettes sans rapport passent devant — dont plusieurs trop petites, qui
     * offrent en tête de liste des boutons désactivés.
     *
     * ⚠️ C'est un **ordre de lecture**, jamais une présélection : l'utilisateur
     * désigne toujours la ligne. Un montant identique est un indice fort, pas
     * une preuve — deux achats à 19,75 € existent.
     */
    const rank = (line: BankTransaction): [number, number, number] => [
      roomFor(line) >= value ? 0 : 1,
      Math.abs(Number(line.amount) - value) < 0.005 ? 0 : 1,
      dayGap(line.booked_on, expense.occurred_at),
    ];

    return [...rows].sort((a, b) => {
      const [fa, ea, da] = rank(a);
      const [fb, eb, db] = rank(b);
      return fa - fb || ea - eb || da - db;
    });
  }, [query.data, expense.occurred_at, roomFor, value]);

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('money.refundExpense.title')}
      description={t('money.refundExpense.description', { budget: budget.name })}
    >
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">{expense.subject}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(expense.occurred_at)} · {formatAmount(expense.amount)}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="refund-expense-amount"
            className="text-sm font-medium text-foreground"
          >
            {t('money.refundExpense.amountLabel')}
          </label>
          <DecimalInput id="refund-expense-amount" value={amount} onChange={setAmount} />
          <p className="text-xs text-muted-foreground">
            {t('money.refundExpense.amountHint', { budget: budget.name })}
          </p>
        </div>

        {query.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('money.refundExpense.none')}</p>
        ) : (
          <ul className="space-y-2">
            {candidates.map((line) => {
              const room = roomFor(line);
              const tooSmall = value > room;
              return (
                <li key={line.id}>
                  <Card className="flex items-center gap-2 p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">{line.label_raw}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(line.booked_on)}
                        {` · ${t('money.refundExpense.room', {
                          amount: formatAmount(room.toFixed(2)),
                        })}`}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatAmount(line.amount)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={creditMutation.isPending || value <= 0 || tooSmall}
                      onClick={() =>
                        creditMutation.mutate(
                          { transactionId: line.id, budgetId: budget.id, amount },
                          { onSuccess: () => onOpenChange(false) },
                        )
                      }
                    >
                      {t('money.refundExpense.credit')}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </SheetDialog>
  );
}
