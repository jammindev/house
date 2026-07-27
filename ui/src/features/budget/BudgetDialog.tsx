import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { CheckboxField } from '@/design-system/checkbox-field';
import { Select } from '@/design-system/select';
import type { Budget } from '@/lib/api/budget';
import { useBudgets, useCreateBudget, useUpdateBudget } from './hooks';
import { groupCandidates } from './tree';

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
  const [parentId, setParentId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const { data: budgets } = useBudgets();

  // Un groupe ne se range pas dans un groupe, et un budget déjà rangé n'en
  // devient pas un : deux niveaux, comme le serveur. Le sélecteur disparaît
  // entièrement quand ce budget est lui-même un groupe — proposer une option
  // que l'API refuse est pire que ne rien proposer.
  const parentOptions = React.useMemo(
    () => groupCandidates(budgets, existing?.id),
    [budgets, existing?.id],
  );

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existing) {
      setName(existing.name);
      setAmount(existing.monthly_amount ?? '');
      setIsGlobal(existing.is_global);
      setParentId(existing.parent?.id ?? '');
    } else {
      setName('');
      setAmount('');
      setIsGlobal(false);
      setParentId('');
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

    const raw = amount.trim().replace(',', '.');
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
      // `null` explicite, comme le montant : sur une édition, vider le groupe
      // doit **sortir** le budget de son groupe.
      parent_id: isGlobal ? null : parentId || null,
    };

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err) {
      // Le serveur nomme ses refus de groupe (« porte déjà 3 dépenses », « deux
      // niveaux ») : les afficher tels quels vaut mieux qu'un « échec » opaque,
      // parce que chacun dit quoi faire.
      const detail = (err as { response?: { data?: Record<string, string[] | string> } })?.response
        ?.data?.parent_id;
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
          <Input
            id="budget-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus={isGlobal}
          />
          {amountRequired ? null : (
            <p className="text-xs text-muted-foreground">{t('budget.fields.amountHint')}</p>
          )}
        </FormField>

        {/* Le groupe : « Maison » au-dessus de « Bricolage ». C'est un
            sous-total, jamais une case — on ne ventile que sur les feuilles,
            et c'est ce qui laisse « dépensé » avec un seul sens. */}
        {!isGlobal && !existing?.is_group && parentOptions.length > 0 ? (
          <FormField label={t('budget.fields.parent')} htmlFor="budget-parent">
            <Select
              id="budget-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              options={[{ value: '', label: t('budget.fields.parentNone') }, ...parentOptions]}
            />
            <p className="text-xs text-muted-foreground">{t('budget.fields.parentHint')}</p>
          </FormField>
        ) : null}

        {existing?.is_group ? (
          <p className="text-xs text-muted-foreground">{t('budget.fields.isGroupHint')}</p>
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
