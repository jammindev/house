import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import PurchaseForm, { type PurchaseFormPayload } from '@/features/interactions/PurchaseForm';
import { useStockCategories } from '@/features/stock/hooks';
import type { ShoppingListItem } from '@/lib/api/shopping';
import { useCommitToStock } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ShoppingListItem;
}

/**
 * Lot 4 — record a purchase from a checked shopping line, reincrementing the
 * stock and creating the expense. A linked line reuses its stock item; a
 * free-text line first needs a category to create the stock item.
 */
export default function ShoppingCommitDialog({ open, onOpenChange, item }: Props) {
  const { t } = useTranslation();
  const commit = useCommitToStock();
  const { data: categories = [] } = useStockCategories();

  const isFreeText = Boolean(item && !item.stock_item);
  const [category, setCategory] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setCategory(categories.length > 0 ? categories[0].id : '');
  }, [open, item]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(payload: PurchaseFormPayload) {
    if (!item) return;
    setError(null);
    if (isFreeText && !category) {
      setError(t('shoppingList.commit.categoryRequired'));
      return;
    }
    try {
      await commit.mutateAsync({
        id: item.id,
        payload: {
          delta: payload.delta ?? 0,
          amount: payload.amount,
          supplier: payload.supplier,
          occurred_at: payload.occurred_at,
          notes: payload.notes,
          category: isFreeText ? category : undefined,
          unit: item.unit || undefined,
        },
      });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('shoppingList.commit.title', { name: item?.label ?? '' })}
    >
      <p className="text-sm text-muted-foreground">
        {isFreeText
          ? t('shoppingList.commit.createHint')
          : t('shoppingList.commit.restockHint', { name: item?.stock_item_name ?? item?.label ?? '' })}
      </p>

      {isFreeText ? (
        <div className="mt-4">
          <FormField label={`${t('shoppingList.commit.category')} *`} htmlFor="commit-category">
            <Select
              id="commit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">{t('shoppingList.commit.selectCategory')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji} {cat.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      ) : null}

      <PurchaseForm
        withDelta
        deltaUnit={item?.unit || undefined}
        isPending={commit.isPending}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
        externalError={error}
      />
    </SheetDialog>
  );
}
