import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import type { EquipmentListItem, EquipmentPayload } from '@/lib/api/equipment';
import { useCreateEquipment, useUpdateEquipment, useZones } from './hooks';

interface EquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingItem?: EquipmentListItem;
}

const STATUS_OPTIONS = ['active', 'maintenance', 'storage', 'retired', 'lost', 'ordered'];

type FormState = {
  name: string;
  category: string;
  zone: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  purchase_date: string;
  purchase_price: string;
  purchase_vendor: string;
  warranty_expires_on: string;
  warranty_provider: string;
  warranty_notes: string;
  maintenance_interval_months: string;
  last_service_at: string;
  status: string;
  condition: string;
  installed_at: string;
  retired_at: string;
  notes: string;
  tags: string;
};

const EMPTY_STATE: FormState = {
  name: '',
  category: 'general',
  zone: '',
  manufacturer: '',
  model: '',
  serial_number: '',
  purchase_date: '',
  purchase_price: '',
  purchase_vendor: '',
  warranty_expires_on: '',
  warranty_provider: '',
  warranty_notes: '',
  maintenance_interval_months: '',
  last_service_at: '',
  status: 'active',
  condition: 'good',
  installed_at: '',
  retired_at: '',
  notes: '',
  tags: '',
};

function toPayload(state: FormState): EquipmentPayload {
  return {
    name: state.name.trim(),
    category: state.category.trim() || 'general',
    zone: state.zone || null,
    manufacturer: state.manufacturer.trim(),
    model: state.model.trim(),
    serial_number: state.serial_number.trim(),
    purchase_date: state.purchase_date || null,
    purchase_price: state.purchase_price ? Number(state.purchase_price) : null,
    purchase_vendor: state.purchase_vendor.trim(),
    warranty_expires_on: state.warranty_expires_on || null,
    warranty_provider: state.warranty_provider.trim(),
    warranty_notes: state.warranty_notes,
    maintenance_interval_months: state.maintenance_interval_months
      ? Number(state.maintenance_interval_months)
      : null,
    last_service_at: state.last_service_at || null,
    status: (state.status || 'active') as EquipmentPayload['status'],
    condition: state.condition.trim() || 'good',
    installed_at: state.installed_at || null,
    retired_at: state.retired_at || null,
    notes: state.notes,
    tags: state.tags
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}

function fromApi(item: EquipmentListItem): FormState {
  return {
    name: item.name || '',
    category: item.category || 'general',
    zone: item.zone || '',
    manufacturer: item.manufacturer || '',
    model: item.model || '',
    serial_number: item.serial_number || '',
    purchase_date: item.purchase_date || '',
    purchase_price: item.purchase_price ? String(item.purchase_price) : '',
    purchase_vendor: item.purchase_vendor || '',
    warranty_expires_on: item.warranty_expires_on || '',
    warranty_provider: item.warranty_provider || '',
    warranty_notes: item.warranty_notes || '',
    maintenance_interval_months: item.maintenance_interval_months
      ? String(item.maintenance_interval_months)
      : '',
    last_service_at: item.last_service_at || '',
    status: item.status || 'active',
    condition: item.condition || 'good',
    installed_at: item.installed_at || '',
    retired_at: item.retired_at || '',
    notes: item.notes || '',
    tags: (item.tags || []).join(', '),
  };
}

export default function EquipmentDialog({
  open,
  onOpenChange,
  onSaved,
  existingItem,
}: EquipmentDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingItem);

  const [form, setForm] = React.useState<FormState>(EMPTY_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const { data: zones = [] } = useZones();
  const createMutation = useCreateEquipment();
  const updateMutation = useUpdateEquipment();

  const isPending = createMutation.isPending || updateMutation.isPending;

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existingItem) {
      setForm(fromApi(existingItem));
    } else {
      setForm(EMPTY_STATE);
    }
  }, [open, existingItem]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError(t('equipment.errors.name_required'));
      return;
    }

    try {
      if (isEditing && existingItem) {
        await updateMutation.mutateAsync({ id: existingItem.id, payload: toPayload(form) });
      } else {
        await createMutation.mutateAsync(toPayload(form));
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError(
        isEditing ? t('equipment.errors.update_failed') : t('equipment.errors.create_failed'),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('equipment.form.title_edit') : t('equipment.form.title_create')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Row 1: name, category */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="eq-name" className="text-sm font-medium">
                {t('equipment.form.fields.name')}
              </label>
              <Input
                id="eq-name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-category" className="text-sm font-medium">
                {t('equipment.form.fields.category')}
              </label>
              <Input
                id="eq-category"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: status, zone */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="eq-status" className="text-sm font-medium">
                {t('equipment.form.fields.status')}
              </label>
              <Select
                id="eq-status"
                value={form.status}
                onChange={(e) => updateField('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`equipment.status.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-zone" className="text-sm font-medium">
                {t('equipment.form.fields.zone')}
              </label>
              <Select
                id="eq-zone"
                value={form.zone}
                onChange={(e) => updateField('zone', e.target.value)}
              >
                <option value="">{t('equipment.no_zone')}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.full_path || z.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Row 3: manufacturer, model, serial_number, condition */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor="eq-manufacturer" className="text-sm font-medium">
                {t('equipment.form.fields.manufacturer')}
              </label>
              <Input
                id="eq-manufacturer"
                value={form.manufacturer}
                onChange={(e) => updateField('manufacturer', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-model" className="text-sm font-medium">
                {t('equipment.form.fields.model')}
              </label>
              <Input
                id="eq-model"
                value={form.model}
                onChange={(e) => updateField('model', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-serial" className="text-sm font-medium">
                {t('equipment.form.fields.serial_number')}
              </label>
              <Input
                id="eq-serial"
                value={form.serial_number}
                onChange={(e) => updateField('serial_number', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-condition" className="text-sm font-medium">
                {t('equipment.form.fields.condition')}
              </label>
              <Input
                id="eq-condition"
                value={form.condition}
                onChange={(e) => updateField('condition', e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: purchase_date, purchase_price, purchase_vendor */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="eq-purchase-date" className="text-sm font-medium">
                {t('equipment.form.fields.purchase_date')}
              </label>
              <Input
                id="eq-purchase-date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => updateField('purchase_date', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-purchase-price" className="text-sm font-medium">
                {t('equipment.form.fields.purchase_price')}
              </label>
              <Input
                id="eq-purchase-price"
                type="number"
                step="0.01"
                value={form.purchase_price}
                onChange={(e) => updateField('purchase_price', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-purchase-vendor" className="text-sm font-medium">
                {t('equipment.form.fields.purchase_vendor')}
              </label>
              <Input
                id="eq-purchase-vendor"
                value={form.purchase_vendor}
                onChange={(e) => updateField('purchase_vendor', e.target.value)}
              />
            </div>
          </div>

          {/* Row 5: warranty_expires_on, warranty_provider, maintenance_interval_months */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="eq-warranty-date" className="text-sm font-medium">
                {t('equipment.form.fields.warranty_expires_on')}
              </label>
              <Input
                id="eq-warranty-date"
                type="date"
                value={form.warranty_expires_on}
                onChange={(e) => updateField('warranty_expires_on', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-warranty-provider" className="text-sm font-medium">
                {t('equipment.form.fields.warranty_provider')}
              </label>
              <Input
                id="eq-warranty-provider"
                value={form.warranty_provider}
                onChange={(e) => updateField('warranty_provider', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-maintenance-interval" className="text-sm font-medium">
                {t('equipment.form.fields.maintenance_interval_months')}
              </label>
              <Input
                id="eq-maintenance-interval"
                type="number"
                min="1"
                value={form.maintenance_interval_months}
                onChange={(e) => updateField('maintenance_interval_months', e.target.value)}
              />
            </div>
          </div>

          {/* Row 6: last_service_at, installed_at, retired_at */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="eq-last-service" className="text-sm font-medium">
                {t('equipment.form.fields.last_service_at')}
              </label>
              <Input
                id="eq-last-service"
                type="date"
                value={form.last_service_at}
                onChange={(e) => updateField('last_service_at', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-installed-at" className="text-sm font-medium">
                {t('equipment.form.fields.installed_at')}
              </label>
              <Input
                id="eq-installed-at"
                type="date"
                value={form.installed_at}
                onChange={(e) => updateField('installed_at', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eq-retired-at" className="text-sm font-medium">
                {t('equipment.form.fields.retired_at')}
              </label>
              <Input
                id="eq-retired-at"
                type="date"
                value={form.retired_at}
                onChange={(e) => updateField('retired_at', e.target.value)}
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <label htmlFor="eq-tags" className="text-sm font-medium">
              {t('equipment.form.fields.tags')}
            </label>
            <Input
              id="eq-tags"
              value={form.tags}
              onChange={(e) => updateField('tags', e.target.value)}
            />
          </div>

          {/* Warranty notes */}
          <div className="space-y-1">
            <label htmlFor="eq-warranty-notes" className="text-sm font-medium">
              {t('equipment.form.fields.warranty_notes')}
            </label>
            <Textarea
              id="eq-warranty-notes"
              rows={3}
              value={form.warranty_notes}
              onChange={(e) => updateField('warranty_notes', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label htmlFor="eq-notes" className="text-sm font-medium">
              {t('equipment.form.fields.notes')}
            </label>
            <Textarea
              id="eq-notes"
              rows={4}
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
                ? t('equipment.form.actions.saving')
                : isEditing
                  ? t('equipment.form.actions.save')
                  : t('equipment.form.actions.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
