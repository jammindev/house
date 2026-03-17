import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import type { StockItem, StockItemStatus } from '@/lib/api/stock';
import { useCreateStockItem, useUpdateStockItem, useStockCategories, useZones } from './hooks';

interface StockItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingItem?: StockItem;
}

type FormState = {
  name: string;
  category: string;
  zone: string;
  quantity: string;
  unit: string;
  min_quantity: string;
  max_quantity: string;
  status: StockItemStatus;
  expiration_date: string;
  notes: string;
};

const EMPTY_STATE: FormState = {
  name: '',
  category: '',
  zone: '',
  quantity: '0',
  unit: 'unit',
  min_quantity: '',
  max_quantity: '',
  status: 'in_stock',
  expiration_date: '',
  notes: '',
};

const STATUS_OPTIONS: StockItemStatus[] = [
  'in_stock',
  'low_stock',
  'out_of_stock',
  'ordered',
  'expired',
  'reserved',
];

function fromApi(item: StockItem): FormState {
  return {
    name: item.name || '',
    category: item.category || '',
    zone: item.zone || '',
    quantity: item.quantity ? String(item.quantity) : '0',
    unit: item.unit || 'unit',
    min_quantity: item.min_quantity ? String(item.min_quantity) : '',
    max_quantity: item.max_quantity ? String(item.max_quantity) : '',
    status: item.status,
    expiration_date: item.expiration_date || '',
    notes: item.notes || '',
  };
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function StockItemDialog({
  open,
  onOpenChange,
  onSaved,
  existingItem,
}: StockItemDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingItem);

  const [form, setForm] = React.useState<FormState>(EMPTY_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const { data: categories = [] } = useStockCategories();
  const { data: zones = [] } = useZones();
  const createMutation = useCreateStockItem();
  const updateMutation = useUpdateStockItem();

  const isPending = createMutation.isPending || updateMutation.isPending;

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existingItem) {
      setForm(fromApi(existingItem));
    } else {
      setForm({
        ...EMPTY_STATE,
        category: categories.length > 0 ? categories[0].id : '',
      });
    }
  }, [open, existingItem]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError(t('stock.errors.name_required'));
      return;
    }
    if (!form.category) {
      setError(t('stock.errors.category_required'));
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      zone: form.zone || null,
      quantity: toNumberOrNull(form.quantity) ?? 0,
      unit: form.unit.trim() || 'unit',
      min_quantity: toNumberOrNull(form.min_quantity),
      max_quantity: toNumberOrNull(form.max_quantity),
      status: form.status,
      expiration_date: form.expiration_date || null,
      notes: form.notes,
    };

    try {
      if (isEditing && existingItem) {
        await updateMutation.mutateAsync({ id: existingItem.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError(isEditing ? t('stock.errors.update_failed') : t('stock.errors.create_failed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('stock.form.title_edit') : t('stock.form.title_create')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label htmlFor="stock-item-name" className="text-sm font-medium">
              {t('stock.fields.name')} *
            </label>
            <Input
              id="stock-item-name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          {/* Category + Zone */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="stock-item-category" className="text-sm font-medium">
                {t('stock.fields.category')}
              </label>
              <Select
                id="stock-item-category"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
              >
                <option value="">{t('stock.fields.select_category')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="stock-item-zone" className="text-sm font-medium">
                {t('stock.fields.zone')}
              </label>
              <Select
                id="stock-item-zone"
                value={form.zone}
                onChange={(e) => updateField('zone', e.target.value)}
              >
                <option value="">{t('stock.labels.no_zone')}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.full_path || z.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Quantity + Unit + Min + Max */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor="stock-item-qty" className="text-sm font-medium">
                {t('stock.fields.quantity')}
              </label>
              <Input
                id="stock-item-qty"
                type="number"
                step="0.001"
                value={form.quantity}
                onChange={(e) => updateField('quantity', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="stock-item-unit" className="text-sm font-medium">
                {t('stock.fields.unit')}
              </label>
              <Input
                id="stock-item-unit"
                value={form.unit}
                onChange={(e) => updateField('unit', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="stock-item-min" className="text-sm font-medium">
                {t('stock.fields.min_quantity')}
              </label>
              <Input
                id="stock-item-min"
                type="number"
                step="0.001"
                value={form.min_quantity}
                onChange={(e) => updateField('min_quantity', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="stock-item-max" className="text-sm font-medium">
                {t('stock.fields.max_quantity')}
              </label>
              <Input
                id="stock-item-max"
                type="number"
                step="0.001"
                value={form.max_quantity}
                onChange={(e) => updateField('max_quantity', e.target.value)}
              />
            </div>
          </div>

          {/* Status + Expiration */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="stock-item-status" className="text-sm font-medium">
                {t('stock.fields.status')}
              </label>
              <Select
                id="stock-item-status"
                value={form.status}
                onChange={(e) => updateField('status', e.target.value as StockItemStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`stock.status.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="stock-item-expiry" className="text-sm font-medium">
                {t('stock.fields.expiration_date')}
              </label>
              <Input
                id="stock-item-expiry"
                type="date"
                value={form.expiration_date}
                onChange={(e) => updateField('expiration_date', e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label htmlFor="stock-item-notes" className="text-sm font-medium">
              {t('stock.fields.notes')}
            </label>
            <Textarea
              id="stock-item-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t('stock.actions.saving')
                : isEditing
                  ? t('stock.actions.save')
                  : t('stock.actions.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
