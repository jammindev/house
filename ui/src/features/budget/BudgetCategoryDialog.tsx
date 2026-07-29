import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { DecimalInput } from '@/design-system/decimal-input';
import { Button } from '@/design-system/button';
import type { BudgetCategory } from '@/lib/api/budget';
import { useCreateBudgetCategory, useUpdateBudgetCategory } from './hooks';

interface BudgetCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = create, defined = edit. */
  existing?: BudgetCategory;
}

/**
 * Créer ou renommer une catégorie de budgets.
 *
 * Volontairement minuscule : une catégorie est un intitulé et un plafond
 * optionnel, rien d'autre. Elle ne porte pas d'argent, donc il n'y a ni règle à
 * expliquer ni refus à afficher — c'est ce que le modèle précédent, où un budget
 * *devenait* un groupe, ne pouvait pas offrir.
 */
export default function BudgetCategoryDialog({
  open,
  onOpenChange,
  existing,
}: BudgetCategoryDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateBudgetCategory();
  const updateMutation = useUpdateBudgetCategory();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setName(existing?.name ?? '');
    setAmount(existing?.monthly_amount ?? '');
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Pas de `.replace(',', '.')` : l'état du parent est déjà canonique, c'est
    // `DecimalInput` qui affiche le séparateur de la locale.
    const raw = amount.trim();
    const parsed = Number(raw);
    const hasAmount = raw !== '';

    if (hasAmount && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError(t('budget.errors.amountInvalid'));
      return;
    }
    if (!name.trim()) {
      setError(t('budget.errors.nameRequired'));
      return;
    }

    const payload = {
      name: name.trim(),
      // `null` explicite : vider le champ doit **retirer** le plafond propre et
      // rendre la catégorie à la somme de ses budgets, ce qu'un PATCH partiel
      // sans la clé ne ferait pas.
      monthly_amount: hasAmount ? parsed : null,
    };

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err) {
      const detail = (err as { response?: { data?: Record<string, string[] | string> } })?.response
        ?.data?.name;
      setError(
        Array.isArray(detail)
          ? detail[0]
          : typeof detail === 'string'
            ? detail
            : t('common.saveFailed'),
      );
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('budget.category.edit.title') : t('budget.category.new.title')}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <FormField label={`${t('budget.fields.name')} *`} htmlFor="budget-category-name">
          <Input
            id="budget-category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('budget.category.namePlaceholder')}
            autoFocus
          />
        </FormField>

        <FormField
          label={t('budget.fields.monthlyAmountOptional')}
          htmlFor="budget-category-amount"
        >
          <DecimalInput
            id="budget-category-amount"
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
          />
          <p className="text-xs text-muted-foreground">{t('budget.category.amountHint')}</p>
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
          <Button type="submit" disabled={isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
