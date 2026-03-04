import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/design-system/alert';
import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import {
  createEquipment,
  fetchEquipment,
  updateEquipment,
  type EquipmentPayload,
} from '@/lib/api/equipment';
import type { ZoneOption } from '@/lib/api/zones';

interface EquipmentFormProps {
  title?: string;
  mode: 'create' | 'edit';
  submitLabel?: string;
  equipmentId?: string;
  householdId?: string;
  initialZones?: ZoneOption[];
  initialZonesLoaded?: boolean;
  cancelUrl?: string;
  successRedirectUrl?: string;
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
    maintenance_interval_months: state.maintenance_interval_months ? Number(state.maintenance_interval_months) : null,
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

function fromApi(item: Awaited<ReturnType<typeof fetchEquipment>>): FormState {
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
    maintenance_interval_months: item.maintenance_interval_months ? String(item.maintenance_interval_months) : '',
    last_service_at: item.last_service_at || '',
    status: item.status || 'active',
    condition: item.condition || 'good',
    installed_at: item.installed_at || '',
    retired_at: item.retired_at || '',
    notes: item.notes || '',
    tags: (item.tags || []).join(', '),
  };
}

export default function EquipmentForm({
  title,
  mode,
  submitLabel,
  equipmentId,
  householdId,
  initialZones = [],
  cancelUrl = '/app/equipment/',
  successRedirectUrl = '/app/equipment/',
}: EquipmentFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = React.useState<FormState>(EMPTY_STATE);
  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(mode === 'edit');
  const [error, setError] = React.useState<string | null>(null);
  const resolvedTitle = title ?? (mode === 'edit' ? t('equipment.form.title_edit') : t('equipment.form.title_create'));
  const resolvedSubmitLabel = submitLabel ?? (mode === 'edit' ? t('equipment.form.actions.save') : t('equipment.form.actions.create'));

  React.useEffect(() => {
    if (mode !== 'edit' || !equipmentId) {
      setLoading(false);
      return;
    }

    const resolvedEquipmentId = equipmentId;

    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const item = await fetchEquipment(resolvedEquipmentId, householdId);
        if (mounted) {
          setForm(fromApi(item));
        }
      } catch {
        if (mounted) setError(t('equipment.errors.load_failed'));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [mode, equipmentId, householdId, t]);

  function updateField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError(t('equipment.errors.name_required'));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'edit' && equipmentId) {
        await updateEquipment(equipmentId, toPayload(form), householdId);
      } else {
        await createEquipment(toPayload(form), householdId);
      }

      if (typeof window !== 'undefined') {
        window.location.assign(successRedirectUrl);
      }
    } catch {
      setError(mode === 'edit' ? t('equipment.errors.update_failed') : t('equipment.errors.create_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{resolvedTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">{t('equipment.loading')}</p> : null}

        {!loading ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="eq-name" className="text-sm font-medium">{t('equipment.form.fields.name')}</label>
                <Input id="eq-name" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
              </div>

              <div className="space-y-1">
                <label htmlFor="eq-category" className="text-sm font-medium">{t('equipment.form.fields.category')}</label>
                <Input id="eq-category" value={form.category} onChange={(event) => updateField('category', event.target.value)} />
              </div>

              <div className="space-y-1">
                <label htmlFor="eq-status" className="text-sm font-medium">{t('equipment.form.fields.status')}</label>
                <Select id="eq-status" value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                  {STATUS_OPTIONS.map((entry) => (
                    <option key={entry} value={entry}>
                      {t(`equipment.status.${entry}`)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label htmlFor="eq-zone" className="text-sm font-medium">{t('equipment.form.fields.zone')}</label>
                <Select id="eq-zone" value={form.zone} onChange={(event) => updateField('zone', event.target.value)}>
                  <option value="">{t('equipment.no_zone')}</option>
                  {initialZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.full_path || zone.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="eq-manufacturer" className="text-sm font-medium">{t('equipment.form.fields.manufacturer')}</label>
                <Input id="eq-manufacturer" value={form.manufacturer} onChange={(event) => updateField('manufacturer', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-model" className="text-sm font-medium">{t('equipment.form.fields.model')}</label>
                <Input id="eq-model" value={form.model} onChange={(event) => updateField('model', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-serial" className="text-sm font-medium">{t('equipment.form.fields.serial_number')}</label>
                <Input id="eq-serial" value={form.serial_number} onChange={(event) => updateField('serial_number', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-condition" className="text-sm font-medium">{t('equipment.form.fields.condition')}</label>
                <Input id="eq-condition" value={form.condition} onChange={(event) => updateField('condition', event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="eq-purchase-date" className="text-sm font-medium">{t('equipment.form.fields.purchase_date')}</label>
                <Input id="eq-purchase-date" type="date" value={form.purchase_date} onChange={(event) => updateField('purchase_date', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-purchase-price" className="text-sm font-medium">{t('equipment.form.fields.purchase_price')}</label>
                <Input id="eq-purchase-price" type="number" step="0.01" value={form.purchase_price} onChange={(event) => updateField('purchase_price', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-purchase-vendor" className="text-sm font-medium">{t('equipment.form.fields.purchase_vendor')}</label>
                <Input id="eq-purchase-vendor" value={form.purchase_vendor} onChange={(event) => updateField('purchase_vendor', event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="eq-warranty-date" className="text-sm font-medium">{t('equipment.form.fields.warranty_expires_on')}</label>
                <Input id="eq-warranty-date" type="date" value={form.warranty_expires_on} onChange={(event) => updateField('warranty_expires_on', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-warranty-provider" className="text-sm font-medium">{t('equipment.form.fields.warranty_provider')}</label>
                <Input id="eq-warranty-provider" value={form.warranty_provider} onChange={(event) => updateField('warranty_provider', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-maintenance-interval" className="text-sm font-medium">{t('equipment.form.fields.maintenance_interval_months')}</label>
                <Input id="eq-maintenance-interval" type="number" min="1" value={form.maintenance_interval_months} onChange={(event) => updateField('maintenance_interval_months', event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="eq-last-service" className="text-sm font-medium">{t('equipment.form.fields.last_service_at')}</label>
                <Input id="eq-last-service" type="date" value={form.last_service_at} onChange={(event) => updateField('last_service_at', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-installed-at" className="text-sm font-medium">{t('equipment.form.fields.installed_at')}</label>
                <Input id="eq-installed-at" type="date" value={form.installed_at} onChange={(event) => updateField('installed_at', event.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="eq-retired-at" className="text-sm font-medium">{t('equipment.form.fields.retired_at')}</label>
                <Input id="eq-retired-at" type="date" value={form.retired_at} onChange={(event) => updateField('retired_at', event.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="eq-tags" className="text-sm font-medium">{t('equipment.form.fields.tags')}</label>
              <Input id="eq-tags" value={form.tags} onChange={(event) => updateField('tags', event.target.value)} />
            </div>

            <div className="space-y-1">
              <label htmlFor="eq-warranty-notes" className="text-sm font-medium">{t('equipment.form.fields.warranty_notes')}</label>
              <Textarea id="eq-warranty-notes" rows={3} value={form.warranty_notes} onChange={(event) => updateField('warranty_notes', event.target.value)} />
            </div>

            <div className="space-y-1">
              <label htmlFor="eq-notes" className="text-sm font-medium">{t('equipment.form.fields.notes')}</label>
              <Textarea id="eq-notes" rows={4} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{t('equipment.error_title')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <a href={cancelUrl} className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm">
                {t('equipment.form.actions.cancel')}
              </a>
              <Button type="submit" disabled={submitting}>
                {submitting ? t('equipment.form.actions.saving') : resolvedSubmitLabel}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
