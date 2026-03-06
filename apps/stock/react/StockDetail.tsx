import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { adjustStockQuantity, deleteStockItem, fetchStockItem, type StockItem } from '@/lib/api/stock';

import { useHouseholdId } from '@/lib/useHouseholdId';

interface StockDetailProps {
  itemId: string;
  editUrl?: string;
  listUrl?: string;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

function formatQty(qty: string, unit: string) {
  const parsed = Number(qty);
  if (Number.isNaN(parsed)) return `${qty} ${unit}`;
  return `${parsed % 1 === 0 ? parsed.toString() : parsed.toFixed(3).replace(/\.?0+$/, '')} ${unit}`;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'out_of_stock' || status === 'expired') return 'destructive';
  if (status === 'low_stock') return 'secondary';
  if (status === 'ordered' || status === 'reserved') return 'outline';
  return 'default';
}

export default function StockDetail({
  itemId,
  editUrl,
  listUrl = '/app/equipment/stock/',
}: StockDetailProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [item, setItem] = React.useState<StockItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deltaDraft, setDeltaDraft] = React.useState('1');
  const [adjusting, setAdjusting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchStockItem(itemId, householdId);
      setItem(loaded);
    } catch {
      setError(t('stock.errors.load_item_failed'));
    } finally {
      setLoading(false);
    }
  }, [itemId, householdId, t]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleAdjust(direction: 1 | -1) {
    if (!item) return;
    const parsed = Number(deltaDraft || '1');
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('stock.errors.adjustment_positive'));
      return;
    }

    setAdjusting(true);
    setError(null);
    try {
      const updated = await adjustStockQuantity(item.id, direction * parsed, householdId);
      setItem(updated);
    } catch {
      setError(t('stock.errors.adjust_failed'));
    } finally {
      setAdjusting(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    if (!window.confirm(t('stock.confirm_delete', { name: item.name }))) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteStockItem(item.id, householdId);
      window.location.assign(listUrl);
    } catch {
      setError(t('stock.errors.delete_failed'));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {loading ? <p className="text-sm text-muted-foreground">{t('stock.loading.item')}</p> : null}

      {!loading && error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('stock.errors.title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && !error && item ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{item.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.category_name || t('stock.labels.not_available')} · {item.zone_name || t('stock.labels.no_zone')}
                  </p>
                </div>
                <Badge variant={statusVariant(item.status)}>{t(`stock.status.${item.status}`)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <p><span className="font-medium">{t('stock.fields.quantity')}:</span> {formatQty(item.quantity, item.unit)}</p>
                <p><span className="font-medium">{t('stock.fields.min_max')}:</span> {item.min_quantity || t('stock.labels.not_available')} / {item.max_quantity || t('stock.labels.not_available')}</p>
                <p><span className="font-medium">{t('stock.fields.sku')}:</span> {item.sku || t('stock.labels.not_available')}</p>
                <p><span className="font-medium">{t('stock.fields.barcode')}:</span> {item.barcode || t('stock.labels.not_available')}</p>
                <p><span className="font-medium">{t('stock.fields.supplier')}:</span> {item.supplier || t('stock.labels.not_available')}</p>
                <p><span className="font-medium">{t('stock.fields.unit_price')}:</span> {item.unit_price || t('stock.labels.not_available')}</p>
                <p><span className="font-medium">{t('stock.fields.total_value')}:</span> {item.total_value || t('stock.labels.not_available')}</p>
                <p><span className="font-medium">{t('stock.fields.purchase_date')}:</span> {formatDate(item.purchase_date)}</p>
                <p><span className="font-medium">{t('stock.fields.expiration_date')}:</span> {formatDate(item.expiration_date)}</p>
                <p><span className="font-medium">{t('stock.fields.last_restocked_at')}:</span> {formatDate(item.last_restocked_at)}</p>
              </div>

              {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
              {item.notes ? <p className="text-sm text-muted-foreground">{item.notes}</p> : null}

              <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[120px_auto_auto] sm:items-end">
                <div className="space-y-1">
                  <label htmlFor="stock-adjust" className="text-xs font-medium text-muted-foreground">{t('stock.fields.adjust_by')}</label>
                  <Input id="stock-adjust" type="number" step="0.001" min="0.001" value={deltaDraft} onChange={(event) => setDeltaDraft(event.target.value)} />
                </div>
                <Button type="button" variant="outline" onClick={() => handleAdjust(-1)} disabled={adjusting}>{t('stock.actions.decrease')}</Button>
                <Button type="button" onClick={() => handleAdjust(1)} disabled={adjusting}>{t('stock.actions.increase')}</Button>
              </div>

              <div className="flex items-center gap-2">
                <a href={editUrl || `/app/equipment/stock/${item.id}/edit/`} className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm">
                  {t('stock.actions.edit')}
                </a>
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? t('stock.actions.deleting') : t('stock.actions.delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
