import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { toast } from '@/lib/toast';
import SupplierCombobox from '@/features/interactions/SupplierCombobox';
import { useBulkUpdateExpenses } from '@/features/interactions/hooks';
import { useBudgets } from '@/features/budget/hooks';
import { selectableBudgets } from '@/features/budget/tree';

/** Ce que le lot change. `''` = ne pas y toucher, jamais « effacer ». */
type BudgetChoice = '' | 'none' | string;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  /** Appelé après un lot réussi — sort du mode sélection. */
  onDone: () => void;
}

/**
 * Corriger le fournisseur et/ou le budget d'une sélection de dépenses.
 *
 * Deux champs, et **aucun n'est obligatoire** : le geste courant ne touche qu'à
 * l'un des deux. Ce qui impose la distinction la plus délicate de cet écran —
 * « laisser tel quel » n'est pas « vider ». Un champ vide ne peut donc pas vouloir
 * dire « efface », sinon renommer le fournisseur de douze lignes leur retirerait
 * leur budget au passage, sans un mot. « Aucun budget » est une entrée du select,
 * c'est-à-dire un choix explicite ; le fournisseur, lui, ne s'efface pas en masse
 * (le laisser vide n'écrit rien) parce que personne ne veut retirer un fournisseur
 * à douze dépenses d'un coup — alors qu'en retirer le budget est un vrai geste,
 * celui qu'on fait après une mauvaise affectation de masse.
 */
export default function BulkEditDialog({ open, onOpenChange, ids, onDone }: Props) {
  const { t } = useTranslation();
  const mutation = useBulkUpdateExpenses();
  const budgetsQuery = useBudgets();

  const [supplier, setSupplier] = React.useState('');
  const [budget, setBudget] = React.useState<BudgetChoice>('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSupplier('');
    setBudget('');
    setError(null);
  }, [open]);

  const budgetOptions = [
    { value: '', label: t('expenses.bulk.keepBudget') },
    { value: 'none', label: t('expenses.bulk.noBudget') },
    ...selectableBudgets(budgetsQuery.data),
  ];

  const changesSupplier = supplier.trim().length > 0;
  const changesBudget = budget !== '';
  const canSubmit = changesSupplier || changesBudget;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError(t('expenses.bulk.nothingToChange'));
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        ids,
        ...(changesSupplier ? { supplier: supplier.trim() } : {}),
        // `null` retire l'enveloppe ; la clé absente n'y touche pas. C'est le
        // serveur qui fait cette distinction, donc elle doit survivre au transport.
        ...(changesBudget ? { budgetId: budget === 'none' ? null : budget } : {}),
      });
      toast({
        description: t('expenses.bulk.done', { count: result.updated }),
        variant: 'success',
      });
      onOpenChange(false);
      onDone();
    } catch {
      // Le lot est atomique côté serveur : en cas d'échec, rien n'a été écrit —
      // il n'y a donc pas de « partiellement appliqué » à annoncer.
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('expenses.bulk.title', { count: ids.length })}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">{t('expenses.bulk.intro')}</p>

        <FormField label={t('purchase.fields.supplier')} htmlFor="bulk-supplier">
          <SupplierCombobox
            id="bulk-supplier"
            value={supplier}
            onChange={setSupplier}
            placeholder={t('expenses.bulk.keepSupplier')}
          />
        </FormField>

        <FormField label={t('purchase.fields.budget')} htmlFor="bulk-budget">
          <Select
            id="bulk-budget"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            options={budgetOptions}
          />
        </FormField>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          {/* Jamais désactivé pendant l'envoi : si la requête traîne, il faut
              pouvoir sortir du dialog. */}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending || !canSubmit}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
