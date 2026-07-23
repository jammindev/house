import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { ShoppingListItem } from '@/lib/api/shopping';

interface Props {
  item: ShoppingListItem;
  onToggle: (item: ShoppingListItem) => void;
  onEdit: (item: ShoppingListItem) => void;
  onDelete: (item: ShoppingListItem) => void;
}

function quantityLabel(item: ShoppingListItem): string | null {
  if (!item.quantity) return null;
  const qty = String(Number(item.quantity)); // trim trailing zeros
  return item.unit ? `${qty} ${item.unit}` : qty;
}

export default function ShoppingListItemRow({ item, onToggle, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const qty = quantityLabel(item);

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(item) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(item), variant: 'danger' },
  ];

  return (
    <Card className="flex items-center gap-3 p-3">
      <input
        type="checkbox"
        checked={item.checked}
        onChange={() => onToggle(item)}
        aria-label={t('shoppingList.actions.toggle', { label: item.label })}
        className="h-5 w-5 shrink-0 cursor-pointer appearance-none rounded border border-border bg-transparent transition-colors checked:border-primary checked:bg-primary checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22white%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M12.207%204.793a1%201%200%20010%201.414l-5%205a1%201%200%2001-1.414%200l-2-2a1%201%200%20011.414-1.414L6.5%209.086l4.293-4.293a1%201%200%20011.414%200z%22%2F%3E%3C%2Fsvg%3E')] checked:bg-no-repeat checked:bg-center"
      />

      <button
        type="button"
        onClick={() => onToggle(item)}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className={cn(
            'flex items-center gap-1.5 text-sm text-foreground',
            item.checked && 'text-muted-foreground line-through',
          )}
        >
          {item.stock_item_emoji ? (
            <span aria-hidden className="shrink-0">{item.stock_item_emoji}</span>
          ) : null}
          <span className="truncate">{item.label}</span>
        </span>
        {(qty || item.note) && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {[qty, item.note].filter(Boolean).join(' · ')}
          </span>
        )}
      </button>

      {item.stock_item ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          {t('shoppingList.fromStock.badge')}
        </span>
      ) : null}

      <CardActions actions={actions} />
    </Card>
  );
}
