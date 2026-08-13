import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Select } from '@/design-system/select';
import { DecimalInput } from '@/design-system/decimal-input';
import { Button } from '@/design-system/button';
import { appLocale, formatAmount } from '@/lib/format';
import type { BankTransaction, InflowNature } from '@/lib/api/banking';
import { useBudgets } from '@/features/budget/hooks';
import { selectableBudgets } from '@/features/budget/tree';
import { useQualifyTransaction, useSetRefundAllocations } from './hooks';

interface ClassifyInflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction;
}

const NATURES: InflowNature[] = ['salary', 'refund', 'transfer', 'other'];

interface DraftLine {
  key: string;
  budgetId: string;
  amount: string;
}

let lineCounter = 0;
function blankLine(budgetId = '', amount = ''): DraftLine {
  lineCounter += 1;
  return { key: `refund-${lineCounter}`, budgetId, amount };
}

/**
 * Dire ce qu'est une recette (parcours 26, lot 5) — et, si c'est un
 * remboursement, **à quelles enveloppes** elle rend de l'argent.
 *
 * Un crédit de 2 100 € peut être un salaire, le remboursement de quelque chose déjà
 * compté comme dépense, ou le retour du propre virement du foyer. Les trois disent
 * des choses complètement différentes sur l'argent réellement disponible, donc
 * laisser le champ vide est un vrai manque — pas un détail cosmétique.
 *
 * « Autre » est un **choix** (« cette recette n'a pas de catégorie qui compte »),
 * distinct du vide qui veut dire « personne n'a regardé ». C'est cette distinction
 * qui permet au contrôle de savoir ce qui reste à faire.
 *
 * ⚠️ Un remboursement se **ventile**, exactement comme une sortie : 70 € rendus
 * par une amie peuvent couvrir 40 € de resto et 30 € de courses. Une seule
 * enveloppe par recette laissait « 150 € / 400 € » faux dès qu'un remboursement
 * traversait deux catégories. Le reste non attribué est un écart que le Contrôle
 * réclame — et qu'on arbitre quand il n'y a réellement rien à créditer.
 */
export default function ClassifyInflowDialog({
  open,
  onOpenChange,
  transaction,
}: ClassifyInflowDialogProps) {
  const { t } = useTranslation();
  const qualify = useQualifyTransaction();
  const setRefund = useSetRefundAllocations();
  const [nature, setNature] = React.useState<InflowNature | ''>('');
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const budgetsQuery = useBudgets();
  const budgetOptions = React.useMemo(
    () => selectableBudgets(budgetsQuery.data),
    [budgetsQuery.data],
  );

  const total = Number(transaction.amount);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setNature(transaction.inflow_nature);
    const existing = transaction.refund_allocations ?? [];
    setLines(
      existing.length > 0
        ? existing.map((row) => blankLine(row.budget, row.amount))
        : // Première répartition : une ligne pré-remplie au montant total, le cas
          // le plus fréquent (un remboursement = une enveloppe).
          [blankLine('', total > 0 ? total.toFixed(2) : '')],
    );
  }, [open, transaction.inflow_nature, transaction.refund_allocations, total]);

  const isRefund = nature === 'refund';
  const credited = lines.reduce((sum, line) => {
    const value = Number(line.amount);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const remaining = total - credited;

  function update(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // La nature d'abord : le serveur refuse de créditer une enveloppe depuis une
    // recette qui ne se déclare pas remboursement, et il a raison — ce serait
    // retirer de l'argent à un budget sans qu'aucun euro ne soit revenu.
    try {
      await qualify.mutateAsync({ id: transaction.id, payload: { inflow_nature: nature } });
    } catch {
      setError(t('common.saveFailed'));
      return;
    }

    if (!isRefund) {
      // Reclasser efface les attributions côté serveur : rien à envoyer ici.
      onOpenChange(false);
      return;
    }

    const payload: { budget_id: string; amount: string }[] = [];
    for (const line of lines) {
      const value = Number(line.amount);
      if (!line.budgetId && !line.amount.trim()) continue; // ligne laissée vide
      if (!line.budgetId) {
        setError(t('banking.inflow.errors.budgetRequired'));
        return;
      }
      if (!Number.isFinite(value) || value <= 0) {
        setError(t('banking.inflow.errors.amountInvalid'));
        return;
      }
      payload.push({ budget_id: line.budgetId, amount: value.toFixed(2) });
    }

    if (credited > total + 0.001) {
      setError(t('banking.inflow.errors.overCredited', { total: formatAmount(total.toFixed(2)) }));
      return;
    }

    try {
      await setRefund.mutateAsync({ transactionId: transaction.id, lines: payload });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  const isPending = qualify.isPending || setRefund.isPending;

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.inflow.title')}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">{transaction.label_raw}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.booked_on).toLocaleDateString(appLocale())} ·{' '}
            {formatAmount(transaction.amount)}
          </p>
        </div>

        <FormField label={t('banking.inflow.nature')} htmlFor="inflow-nature">
          <Select
            id="inflow-nature"
            value={nature}
            onChange={(e) => setNature(e.target.value as InflowNature | '')}
            options={[
              { value: '', label: t('banking.inflow.unclassified') },
              ...NATURES.map((value) => ({
                value,
                label: t(`banking.inflow.natures.${value}`),
              })),
            ]}
          />
          <p className="text-xs text-muted-foreground">{t('banking.inflow.hint')}</p>
        </FormField>

        {/* Un remboursement est la seule recette qui *annule* une dépense : sans
            enveloppe nommée, le budget continue de compter de l'argent revenu.
            Laisser vide reste possible — un frais bancaire jamais budgété ne
            recrédite rien — mais c'est alors un écart que le Contrôle signale. */}
        {isRefund ? (
          <div className="space-y-3">
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
                    id={index === 0 ? 'inflow-refund-budget' : `inflow-refund-budget-${index}`}
                    aria-label={t('banking.inflow.refundBudget')}
                    value={line.budgetId}
                    onChange={(e) => update(line.key, { budgetId: e.target.value })}
                    options={[
                      { value: '', label: t('banking.inflow.refundBudgetNone') },
                      ...budgetOptions,
                    ]}
                  />
                </div>
                <DecimalInput
                  className="w-28"
                  aria-label={t('banking.inflow.refundAmount')}
                  value={line.amount}
                  onChange={(value) => update(line.key, { amount: value })}
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
                setLines((prev) => [
                  ...prev,
                  blankLine('', remaining > 0 ? remaining.toFixed(2) : ''),
                ])
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t('banking.inflow.addLine')}
            </Button>

            <p className="text-xs text-muted-foreground">{t('banking.inflow.refundBudgetHint')}</p>
          </div>
        ) : null}

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
