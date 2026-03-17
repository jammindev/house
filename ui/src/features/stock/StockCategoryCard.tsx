import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
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

  return (
    <li className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {category.color ? (
              <span
                className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            ) : null}
            <p className="text-sm font-medium">
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

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(category)}
            aria-label={t('common.edit')}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(category.id)}
            aria-label={t('common.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}
