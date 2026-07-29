import * as React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/design-system/input';
import { DecimalInput } from '@/design-system/decimal-input';
import { Badge } from '@/design-system/badge';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import { useBudgets } from '@/features/budget/hooks';
import { selectableBudgets } from '@/features/budget/tree';
import LinkedLineActions from '@/features/banking/LinkedLineActions';
import { isOwnedByAllocationEditor } from '@/features/banking/ownership';
import type { BankLineRef } from '@/lib/api/interactions';

interface ExpenseFieldsProps {
  amount: string;
  onAmountChange: (value: string) => void;
  supplier: string;
  onSupplierChange: (value: string) => void;
  /** When source-bound (purchase from a stock item, equipment, project), shown read-only. */
  sourceLabel?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  /** Read-only display of the kind metadata (stock_purchase / equipment_purchase / project_purchase / manual). */
  kind?: string | null;
  /** Id de la dépense — nécessaire au détachement, qui s'opère depuis ici. */
  expenseId: string;
  /** L'opération qui justifie cette dépense, `null` quand rien ne la justifie. */
  bankLine?: BankLineRef | null;
  /** Sortie du formulaire quand la dépense vient d'être supprimée d'ici. */
  onDeleted?: () => void;
  /** Enveloppe actuelle (id), et son écriture. */
  budgetId: string;
  onBudgetChange: (value: string) => void;
  /** Read-only unit_price displayed when filled (computed for stock purchases from delta×amount). */
  unitPrice?: string | null;
  unit?: string | null;
}

function sourceLink(sourceType: string | null | undefined, sourceId: string | null | undefined): string | null {
  if (!sourceType || !sourceId) return null;
  if (sourceType === 'stock.stockitem') return `/app/stock`; // pas de page détail item, on renvoie vers la liste
  if (sourceType === 'equipment.equipment') return `/app/equipment/${sourceId}`;
  if (sourceType === 'projects.project') return `/app/projects/${sourceId}`;
  return null;
}

export default function ExpenseFields({
  amount,
  onAmountChange,
  supplier,
  onSupplierChange,
  sourceLabel,
  sourceType,
  sourceId,
  kind,
  expenseId,
  bankLine,
  onDeleted,
  budgetId,
  onBudgetChange,
  unitPrice,
  unit,
}: ExpenseFieldsProps) {
  const { t } = useTranslation();
  const budgetsQuery = useBudgets();
  // Le plafond global n'est la catégorie de rien : le serveur le refuse.
  const budgetOptions = React.useMemo(
    () => selectableBudgets(budgetsQuery.data),
    [budgetsQuery.data],
  );
  const hasSource = Boolean(sourceLabel && sourceType);
  const link = sourceLink(sourceType, sourceId);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t('interactions.expense.section_title')}
        </h3>
        {kind ? (
          <Badge variant="outline" className="text-xs">
            {t(`expenses.kind.${kind}`)}
          </Badge>
        ) : null}
      </div>

      {hasSource ? (
        <div className="text-xs text-muted-foreground">
          {t('interactions.expense.linked_to')}{' '}
          {link ? (
            <Link to={link} className="font-medium text-foreground underline-offset-2 hover:underline">
              {sourceLabel}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{sourceLabel}</span>
          )}
        </div>
      ) : null}

      {/* L'opération qui justifie la dépense, et le lien pour aller la voir.
          ⚠️ **Un seul geste par écran** : sur une dépense née de la ventilation,
          « défaire » veut dire *supprimer*, et l'en-tête de la page le propose
          déjà — deux boutons de suppression sur le même formulaire ne se
          distinguent pas l'un de l'autre. Ne reste donc ici que le détachement,
          qui n'existe nulle part ailleurs sur cet écran. */}
      {bankLine ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link
            to={`/app/money/transactions/${bankLine.id}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {bankLine.account_name} · {bankLine.label}
          </Link>
          {!isOwnedByAllocationEditor(kind) ? (
            <LinkedLineActions
              expenseId={expenseId}
              kind={kind}
              transactionId={bankLine.id}
              onDeleted={onDeleted}
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="expense-amount" className="text-sm font-medium">
            {t('interactions.expense.amount_label')}
          </label>
          <DecimalInput
            id="expense-amount"
            value={amount}
            onChange={onAmountChange}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expense-supplier" className="text-sm font-medium">
            {t('interactions.expense.supplier_label')}
          </label>
          <Input
            id="expense-supplier"
            value={supplier}
            onChange={(e) => onSupplierChange(e.target.value)}
            placeholder={t('interactions.expense.supplier_placeholder')}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Le budget se corrige ici, et pas seulement à la création : c'est le
          seul axe qui classe un euro, et l'écran d'édition était le seul à ne
          pas le proposer — on pouvait donc lire « hors budget » sur une dépense
          sans pouvoir y remédier depuis la page ouverte pour ça. */}
      {budgetOptions.length > 0 ? (
        <FormField label={t('purchase.fields.budget')} htmlFor="expense-budget">
          <Select
            id="expense-budget"
            value={budgetId}
            onChange={(e) => onBudgetChange(e.target.value)}
            options={[
              { value: '', label: t('purchase.fields.budget_none') },
              ...budgetOptions,
            ]}
          />
        </FormField>
      ) : null}

      {unitPrice ? (
        <p className="text-xs text-muted-foreground">
          {t('interactions.expense.unit_price_info', {
            price: unitPrice,
            unit: unit ?? '',
          })}
        </p>
      ) : null}
    </div>
  );
}
