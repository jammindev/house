// Réexport des formatters partagés + helpers spécifiques au stock.
import type { StockItemStatus } from '@/lib/api/stock';

export { formatDate, formatDateTime, formatAmount } from '@/lib/format';

export function formatQty(qty: string, unit: string): string {
  const parsed = Number(qty);
  if (Number.isNaN(parsed)) return `${qty} ${unit}`;
  return `${parsed % 1 === 0 ? parsed.toString() : parsed.toFixed(3).replace(/\.?0+$/, '')} ${unit}`;
}

export function statusVariant(
  status: StockItemStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'out_of_stock' || status === 'expired') return 'destructive';
  if (status === 'low_stock') return 'secondary';
  if (status === 'ordered' || status === 'reserved') return 'outline';
  return 'default';
}
