import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import {
  createStockItem,
  fetchStockItem,
  type StockCategory,
  type StockItem,
  type StockItemStatus,
  updateStockItem,
} from '@/lib/api/stock';
import type { ZoneOption } from '@/lib/api/zones';

interface StockFormProps {
  mode: 'create' | 'edit';
  itemId?: string;
  householdId?: string;
  initialZones?: ZoneOption[];
  initialCategories?: StockCategory[];
  cancelUrl?: string;
  successRedirectUrl?: string;
}

type FormState = {
  category: string;
  zone: string;
  name: string;
  description: string;
  sku: string;
  barcode: string;
  quantity: string;
  unit: string;
  min_quantity: string;
  max_quantity: string;
  unit_price: string;
  purchase_date: string;
  expiration_date: string;
  status: StockItemStatus;
  supplier: string;
  notes: string;
  tags: string;
};

const EMPTY_STATE: FormState = {
  category: '',
  zone: '',
  name: '',
  description: '',
  sku: '',
  barcode: '',
  quantity: '0',
  unit: 'unit',
  min_quantity: '',
  max_quantity: '',
  unit_price: '',
  purchase_date: '',
  expiration_date: '',
  status: 'in_stock',
  supplier: '',
  notes: '',
  tags: '',
};

const STATUS_OPTIONS: StockItemStatus[] = ['in_stock', 'low_stock', 'out_of_stock', 'ordered', 'expired', 'reserved'];

function fromApi(item: StockItem): FormState {
  return {
    category: item.category,
    zone: item.zone || '',
    name: item.name || '',
    description: item.description || '',
    sku: item.sku || '',
    barcode: item.barcode || '',
    quantity: item.quantity ? String(item.quantity) : '0',
    unit: item.unit || 'unit',
    min_quantity: item.min_quantity ? String(item.min_quantity) : '',
    max_quantity: item.max_quantity ? String(item.max_quantity) : '',
    unit_price: item.unit_price ? String(item.unit_price) : '',
    purchase_date: item.purchase_date || '',
    expiration_date: item.expiration_date || '',
    status: item.status,
    supplier: item.supplier || '',
    notes: item.notes || '',
    tags: item.tags.join(', '),
  };
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function StockForm({
  mode,
  itemId,
  householdId,
  initialZones = [],
  initialCategories = [],
  cancelUrl = '/app/equipment/stock/',
  successRedirectUrl = '/app/equipment/stock/',
}: StockFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState<FormState>(EMPTY_STATE);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (mode !== 'edit' || !itemId) {
      if (!form.category && initialCategories.length > 0) {
        setForm((previous) => ({ ...previous, category: initialCategories[0].id }));
      }
      setLoading(false);
      return;
    }

    const resolvedItemId = itemId;

    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const item = await fetchStockItem(resolvedItemId, householdId);
        if (mounted) {
          setForm(fromApi(item));
        }
      } catch {
        if (mounted) setError(t('stock.errors.load_item_failed'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [mode, itemId, householdId, initialCategories, form.category, t]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError(t('stock.errors.name_required'));
      return;
    }
    if (!form.category) {
      setError(t('stock.errors.category_required'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        category: form.category,
        zone: form.zone || null,
        name: form.name.trim(),
        description: form.description.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
        quantity: toNumberOrNull(form.quantity) ?? 0,
        unit: form.unit.trim() || 'unit',
        min_quantity: toNumberOrNull(form.min_quantity),
        max_quantity: toNumberOrNull(form.max_quantity),
        unit_price: toNumberOrNull(form.unit_price),
        purchase_date: form.purchase_date || null,
        expiration_date: form.expiration_date || null,
        status: form.status,
        supplier: form.supplier.trim(),
        notes: form.notes,
        tags: form.tags.split(',').map((entry) => entry.trim()).filter(Boolean),
      };

      if (mode === 'edit' && itemId) {
        await updateStockItem(itemId, payload, householdId);
      } else {
        await createStockItem(payload, householdId);
      }

      window.location.assign(successRedirectUrl);
    } catch {
      setError(mode === 'edit' ? t('stock.errors.update_failed') : t('stock.errors.create_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{mode === 'edit' ? t('stock.form.title_edit') : t('stock.form.title_create')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">{t('stock.loading.item')}</p> : null}
        {!loading ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="stock-name" className="text-sm font-medium">{t('stock.fields.name')}</label>
                <Input id="stock-name" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-category" className="text-sm font-medium">{t('stock.fields.category')}</label>
                <Select id="stock-category" value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                  <option value="">{t('stock.fields.select_category')}</option>
                  {initialCategories.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.emoji} {entry.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-zone" className="text-sm font-medium">{t('stock.fields.zone')}</label>
                <Select id="stock-zone" value={form.zone} onChange={(event) => updateField('zone', event.target.value)}>
                  <option value="">{t('stock.labels.no_zone')}</option>
                  {initialZones.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.full_path || entry.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-status" className="text-sm font-medium">{t('stock.fields.status')}</label>
                <Select id="stock-status" value={form.status} onChange={(event) => updateField('status', event.target.value as StockItemStatus)}>
                  {STATUS_OPTIONS.map((entry) => (
                    <option key={entry} value={entry}>{t(`stock.status.${entry}`)}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <label htmlFor="stock-quantity" className="text-sm font-medium">{t('stock.fields.quantity')}</label>
                <Input id="stock-quantity" type="number" step="0.001" value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-unit" className="text-sm font-medium">{t('stock.fields.unit')}</label>
                <Input id="stock-unit" value={form.unit} onChange={(event) => updateField('unit', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-min" className="text-sm font-medium">{t('stock.fields.min_quantity')}</label>
                <Input id="stock-min" type="number" step="0.001" value={form.min_quantity} onChange={(event) => updateField('min_quantity', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-max" className="text-sm font-medium">{t('stock.fields.max_quantity')}</label>
                <Input id="stock-max" type="number" step="0.001" value={form.max_quantity} onChange={(event) => updateField('max_quantity', event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="stock-unit-price" className="text-sm font-medium">{t('stock.fields.unit_price')}</label>
                <Input id="stock-unit-price" type="number" step="0.01" value={form.unit_price} onChange={(event) => updateField('unit_price', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-purchase" className="text-sm font-medium">{t('stock.fields.purchase_date')}</label>
                <Input id="stock-purchase" type="date" value={form.purchase_date} onChange={(event) => updateField('purchase_date', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-expiration" className="text-sm font-medium">{t('stock.fields.expiration_date')}</label>
                <Input id="stock-expiration" type="date" value={form.expiration_date} onChange={(event) => updateField('expiration_date', event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="stock-sku" className="text-sm font-medium">{t('stock.fields.sku')}</label>
                <Input id="stock-sku" value={form.sku} onChange={(event) => updateField('sku', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-barcode" className="text-sm font-medium">{t('stock.fields.barcode')}</label>
                <Input id="stock-barcode" value={form.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-supplier" className="text-sm font-medium">{t('stock.fields.supplier')}</label>
                <Input id="stock-supplier" value={form.supplier} onChange={(event) => updateField('supplier', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="stock-tags" className="text-sm font-medium">{t('stock.fields.tags')}</label>
                <Input id="stock-tags" value={form.tags} onChange={(event) => updateField('tags', event.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="stock-description" className="text-sm font-medium">{t('stock.fields.description')}</label>
              <Textarea id="stock-description" rows={3} value={form.description} onChange={(event) => updateField('description', event.target.value)} />
            </div>

            <div className="space-y-1">
              <label htmlFor="stock-notes" className="text-sm font-medium">{t('stock.fields.notes')}</label>
              <Textarea id="stock-notes" rows={4} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t('stock.errors.title')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <a href={cancelUrl} className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm">{t('stock.actions.cancel')}</a>
              <Button type="submit" disabled={submitting}>
                {submitting ? t('stock.actions.saving') : mode === 'edit' ? t('stock.actions.save') : t('stock.actions.create')}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
