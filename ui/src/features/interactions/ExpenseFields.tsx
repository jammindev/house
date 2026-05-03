import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/design-system/input';
import { Badge } from '@/design-system/badge';

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
  unitPrice,
  unit,
}: ExpenseFieldsProps) {
  const { t } = useTranslation();
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
            {t(`expenses.kind.${kind}`, { defaultValue: kind })}
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

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="expense-amount" className="text-sm font-medium">
            {t('interactions.expense.amount_label')}
          </label>
          <Input
            id="expense-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
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
