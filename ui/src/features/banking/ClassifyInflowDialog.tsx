import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import type { BankTransaction, InflowNature } from '@/lib/api/banking';
import { useBudgets } from '@/features/budget/hooks';
import { useQualifyTransaction } from './hooks';

interface ClassifyInflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction;
}

const NATURES: InflowNature[] = ['salary', 'refund', 'transfer', 'other'];

/**
 * Dire ce qu'est une recette (parcours 26, lot 5).
 *
 * Un crédit de 2 100 € peut être un salaire, le remboursement de quelque chose déjà
 * compté comme dépense, ou le retour du propre virement du foyer. Les trois disent
 * des choses complètement différentes sur l'argent réellement disponible, donc
 * laisser le champ vide est un vrai manque — pas un détail cosmétique.
 *
 * « Autre » est un **choix** (« cette recette n'a pas de catégorie qui compte »),
 * distinct du vide qui veut dire « personne n'a regardé ». C'est cette distinction
 * qui permet au contrôle de savoir ce qui reste à faire.
 */
export default function ClassifyInflowDialog({
  open,
  onOpenChange,
  transaction,
}: ClassifyInflowDialogProps) {
  const { t } = useTranslation();
  const mutation = useQualifyTransaction();
  const [nature, setNature] = React.useState<InflowNature | ''>('');
  const [refundBudgetId, setRefundBudgetId] = React.useState('');
  const budgetsQuery = useBudgets();

  React.useEffect(() => {
    if (!open) return;
    setNature(transaction.inflow_nature);
    setRefundBudgetId(transaction.refund_budget ?? '');
  }, [open, transaction.inflow_nature, transaction.refund_budget]);

  const isRefund = nature === 'refund';

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    mutation.mutate(
      {
        id: transaction.id,
        payload: {
          inflow_nature: nature,
          // Le serveur refuse un budget sur autre chose qu'un remboursement, et
          // efface celui d'un remboursement reclassé. On envoie donc `null`
          // plutôt que rien : ne pas envoyer la clé laisserait l'ancien budget.
          refund_budget_id: isRefund ? refundBudgetId || null : null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.inflow.title')}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">{transaction.label_raw}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.booked_on).toLocaleDateString()} ·{' '}
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
            Le laisser vide reste possible — un frais bancaire jamais budgété ne
            recrédite rien — mais c'est alors un écart que le Contrôle signale. */}
        {isRefund ? (
          <FormField label={t('banking.inflow.refundBudget')} htmlFor="inflow-refund-budget">
            <Select
              id="inflow-refund-budget"
              value={refundBudgetId}
              onChange={(e) => setRefundBudgetId(e.target.value)}
              options={[
                { value: '', label: t('banking.inflow.refundBudgetNone') },
                ...(budgetsQuery.data ?? [])
                  .filter((b) => !b.is_global)
                  .map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {t('banking.inflow.refundBudgetHint')}
            </p>
          </FormField>
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
