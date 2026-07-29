import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { DecimalInput } from '@/design-system/decimal-input';
import { Button } from '@/design-system/button';
import { CheckboxField } from '@/design-system/checkbox-field';
import { Select } from '@/design-system/select';
import type { Budget } from '@/lib/api/budget';
import { useBudgetCategories, useCreateBudget, useUpdateBudget } from './hooks';
import { categoryOptions } from './tree';

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = create, defined = edit. */
  existing?: Budget;
  /** Show the "global budget" toggle (hidden when a global already exists). */
  allowGlobal: boolean;
}

export default function BudgetDialog({ open, onOpenChange, existing, allowGlobal }: BudgetDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [isGlobal, setIsGlobal] = React.useState(false);
  const [categoryId, setCategoryId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const { data: categories } = useBudgetCategories();

  // Toutes les catégories du foyer, sans exception : une catégorie est un
  // intitulé, donc aucune n'est jamais indisponible pour une raison qu'il
  // faudrait expliquer.
  const categoryChoices = React.useMemo(() => categoryOptions(categories), [categories]);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existing) {
      setName(existing.name);
      setAmount(existing.monthly_amount ?? '');
      setIsGlobal(existing.is_global);
      setCategoryId(existing.category?.id ?? '');
    } else {
      setName('');
      setAmount('');
      setIsGlobal(false);
      setCategoryId('');
    }
  }, [open, existing]);

  // The global budget covers everything and needs no name — it's identified by
  // its flag. Named budgets require a name.
  const nameRequired = !isGlobal;
  // Le plafond est optionnel pour une enveloppe nommée : le budget est le seul
  // axe qui catégorise un euro, et exiger un montant obligeait à inventer un
  // plafond pour « Cadeaux ». Le budget global, lui, n'existe que pour plafonner.
  const amountRequired = isGlobal;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const raw = amount.trim();
    const parsed = Number(raw);
    const hasAmount = raw !== '';

    if (hasAmount && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError(t('budget.errors.amountInvalid'));
      return;
    }
    if (amountRequired && !hasAmount) {
      setError(t('budget.errors.amountRequiredForGlobal'));
      return;
    }
    if (nameRequired && !name.trim()) {
      setError(t('budget.errors.nameRequired'));
      return;
    }

    const payload = {
      name: isGlobal ? (name.trim() || t('budget.global.defaultName')) : name.trim(),
      // `null` explicite et pas champ omis : sur une édition, vider le montant
      // doit **retirer** le plafond, ce qu'un PATCH partiel sans la clé ne ferait pas.
      monthly_amount: hasAmount ? parsed : null,
      is_global: isGlobal,
      // `null` explicite, comme le montant : sur une édition, vider la catégorie
      // doit **sortir** le budget de son rangement, ce qu'un PATCH partiel sans
      // la clé ne ferait pas.
      category_id: isGlobal ? null : categoryId || null,
    };

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err) {
      // Le serveur nomme ses refus : les afficher tels quels vaut mieux qu'un
      // « échec » opaque, parce que chacun dit quoi faire.
      const detail = (err as { response?: { data?: Record<string, string[] | string> } })?.response
        ?.data?.category_id;
      setError(
        Array.isArray(detail) ? detail[0] : typeof detail === 'string' ? detail : t('common.saveFailed'),
      );
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('budget.edit.title') : t('budget.new.title')}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {allowGlobal && !isEditing ? (
          <CheckboxField
            id="budget-is-global"
            label={t('budget.fields.isGlobal')}
            checked={isGlobal}
            onChange={setIsGlobal}
          />
        ) : null}

        {!isGlobal ? (
          <FormField label={`${t('budget.fields.name')} *`} htmlFor="budget-name">
            <Input
              id="budget-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('budget.fields.namePlaceholder')}
              autoFocus
            />
          </FormField>
        ) : (
          <p className="text-sm text-muted-foreground">{t('budget.global.hint')}</p>
        )}

        <FormField
          label={amountRequired
            ? `${t('budget.fields.monthlyAmount')} *`
            : t('budget.fields.monthlyAmountOptional')}
          htmlFor="budget-amount"
        >
          <DecimalInput
            id="budget-amount"
            value={amount}
            onChange={setAmount}
            placeholder="0.00"
            autoFocus={isGlobal}
          />
          {amountRequired ? null : (
            <p className="text-xs text-muted-foreground">{t('budget.fields.amountHint')}</p>
          )}
        </FormField>

        {/* La catégorie : « Maison » au-dessus de « Bricolage ». Ranger une
            enveloppe ne lui retire rien — elle reste une cible de dépense comme
            avant, et son plafond continue de la mesurer. */}
        {!isGlobal && categoryChoices.length > 0 ? (
          <FormField label={t('budget.fields.category')} htmlFor="budget-category">
            <Select
              id="budget-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[{ value: '', label: t('budget.fields.categoryNone') }, ...categoryChoices]}
            />
            <p className="text-xs text-muted-foreground">{t('budget.fields.categoryHint')}</p>
          </FormField>
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
