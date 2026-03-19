import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { StockCategory } from '@/lib/api/stock';

interface StockCategoryCardProps {
  category: StockCategory;
  itemCount?: number;
  onEdit: (category: StockCategory) => void;
  onDelete: (categoryId: string) => void;
}

export default function StockCategoryCard({
  category,
  itemCount,
  onEdit,
  onDelete,
}: StockCategoryCardProps) {
  const { t } = useTranslation();

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: () => onEdit(category) },
    { label: t('common.delete'), icon: Trash2, onClick: () => onDelete(category.id), variant: 'danger' },
  ];

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {category.color ? (
              <span
                className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            ) : null}
            <p className="text-sm font-medium text-foreground">
              {category.emoji ? `${category.emoji} ` : ''}{category.name}
            </p>
          </div>
          {category.description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p>
          ) : null}
          {itemCount !== undefined ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('stock.categories.items_count')}: {itemCount}
            </p>
          ) : null}
        </div>

        <CardActions actions={actions} />
      </div>
    </li>
  );
}
