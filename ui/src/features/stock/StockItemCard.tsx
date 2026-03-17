import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import type { StockItem, StockItemStatus } from '@/lib/api/stock';

interface StockItemCardProps {
  item: StockItem;
  onEdit: (item: StockItem) => void;
  onDelete: (itemId: string) => void;
}

function statusVariant(status: StockItemStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'out_of_stock' || status === 'expired') return 'destructive';
  if (status === 'low_stock') return 'secondary';
  if (status === 'ordered' || status === 'reserved') return 'outline';
  return 'default';
}

function formatQty(qty: string, unit: string): string {
  const parsed = Number(qty);
  if (Number.isNaN(parsed)) return `${qty} ${unit}`;
  return `${parsed % 1 === 0 ? parsed.toString() : parsed.toFixed(3).replace(/\.?0+$/, '')} ${unit}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export default function StockItemCard({ item, onEdit, onDelete }: StockItemCardProps) {
  const { t } = useTranslation();

  return (
    <li className="rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {item.category_name || t('stock.labels.not_available')}
            {item.zone_name ? ` · ${item.zone_name}` : ` · ${t('stock.labels.no_zone')}`}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <Badge variant={statusVariant(item.status)}>
            {t(`stock.status.${item.status}`)}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit(item)}
            aria-label={t('common.edit')}
            type="button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={() => onDelete(item.id)}
            aria-label={t('common.delete')}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
        <p>
          {t('stock.fields.quantity')}: {formatQty(item.quantity, item.unit)}
        </p>
        {item.expiration_date ? (
          <p>
            {t('stock.fields.expiration_date')}: {formatDate(item.expiration_date)}
          </p>
        ) : null}
        {item.min_quantity ? (
          <p>
            {t('stock.fields.min_max')}: {item.min_quantity} / {item.max_quantity || '—'}
          </p>
        ) : null}
      </div>
    </li>
  );
}
