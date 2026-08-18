import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { DecimalInput } from '@/design-system/decimal-input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { cn } from '@/lib/utils';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CONDITIONS,
  type EquipmentCategory,
  type EquipmentCondition,
  type EquipmentListItem,
  type EquipmentPayload,
} from '@/lib/api/equipment';
import { useCreateEquipment, useUpdateEquipment } from './hooks';
import { categoryKey, conditionKey } from './health';
import ZonePicker from '@/features/zones/ZonePicker';

interface EquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Facultatif : les hooks invalident déjà `equipment`. Ne sert qu'à fermer un
   *  écran appelant ou à rafraîchir autre chose. */
  onSaved?: () => void;
  existingItem?: EquipmentListItem;
}

const STATUS_OPTIONS = ['active', 'maintenance', 'storage', 'retired', 'lost', 'ordered'];

type FormState = {
  name: string;
  category: EquipmentCategory;
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
  condition: EquipmentCondition;
  installed_at: string;
  retired_at: string;
  notes: string;
  tags: string;
};

const EMPTY_STATE: FormState = {
  name: '',
  category: 'other',
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
    category: state.category,
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
    condition: state.condition,
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
    category: categoryKey(item.category),
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
    condition: conditionKey(item.condition),
    installed_at: item.installed_at || '',
    retired_at: item.retired_at || '',
    notes: item.notes || '',
    tags: (item.tags || []).join(', '),
  };
}

/** Une section repliable — le reste du dossier, qui ne se remplit pas le jour de la création. */
function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-foreground"
      >
        {title}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="space-y-4 border-t border-border p-3">{children}</div> : null}
    </div>
  );
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
  }, [open, existingItem]);

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
      onSaved?.();
    } catch {
      setError(
        isEditing ? t('equipment.errors.update_failed') : t('equipment.errors.create_failed'),
      );
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('equipment.form.title_edit') : t('equipment.form.title_create')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* L'essentiel, toujours visible. Le formulaire posait dix-huit champs à
            plat pour ajouter une perceuse : le reste est de la donnée de dossier,
            qui se remplit le jour où on l'a sous les yeux — pas à la création. */}
        <FormField label={t('equipment.form.fields.name')} htmlFor="eq-name">
          <Input
            id="eq-name"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
            autoComplete="off"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('equipment.form.fields.category')} htmlFor="eq-category">
            <Select
              id="eq-category"
              value={form.category}
              onChange={(e) => updateField('category', e.target.value as EquipmentCategory)}
            >
              {EQUIPMENT_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {t(`equipment.category.${key}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('equipment.form.fields.zone')} htmlFor="eq-zone">
            <ZonePicker
              id="eq-zone"
              value={form.zone || null}
              onChange={(id) => updateField('zone', id ?? '')}
              allowEmpty
              emptyLabel={t('equipment.no_zone')}
            />
          </FormField>
        </div>

        <Section title={t('equipment.form.sections.identity')} defaultOpen={isEditing}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('equipment.form.fields.manufacturer')} htmlFor="eq-manufacturer">
              <Input
                id="eq-manufacturer"
                value={form.manufacturer}
                onChange={(e) => updateField('manufacturer', e.target.value)}
              />
            </FormField>
            <FormField label={t('equipment.form.fields.model')} htmlFor="eq-model">
              <Input
                id="eq-model"
                value={form.model}
                onChange={(e) => updateField('model', e.target.value)}
              />
            </FormField>
            <FormField label={t('equipment.form.fields.serial_number')} htmlFor="eq-serial">
              <Input
                id="eq-serial"
                value={form.serial_number}
                onChange={(e) => updateField('serial_number', e.target.value)}
              />
            </FormField>
            <FormField label={t('equipment.form.fields.status')} htmlFor="eq-status">
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
            </FormField>
            <FormField label={t('equipment.form.fields.condition')} htmlFor="eq-condition">
              <Select
                id="eq-condition"
                value={form.condition}
                onChange={(e) => updateField('condition', e.target.value as EquipmentCondition)}
              >
                {EQUIPMENT_CONDITIONS.map((key) => (
                  <option key={key} value={key}>
                    {t(`equipment.condition.${key}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('equipment.form.fields.installed_at')} htmlFor="eq-installed-at">
              <Input
                id="eq-installed-at"
                type="date"
                value={form.installed_at}
                onChange={(e) => updateField('installed_at', e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('equipment.form.fields.tags')} htmlFor="eq-tags">
            <Input
              id="eq-tags"
              value={form.tags}
              onChange={(e) => updateField('tags', e.target.value)}
            />
          </FormField>
        </Section>

        <Section title={t('equipment.form.sections.purchase')}>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t('equipment.form.fields.purchase_date')} htmlFor="eq-purchase-date">
              <Input
                id="eq-purchase-date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => updateField('purchase_date', e.target.value)}
              />
            </FormField>
            <FormField label={t('equipment.form.fields.purchase_price')} htmlFor="eq-purchase-price">
              <DecimalInput
                id="eq-purchase-price"
                value={form.purchase_price}
                onChange={(value) => updateField('purchase_price', value)}
              />
            </FormField>
            <FormField label={t('equipment.form.fields.purchase_vendor')} htmlFor="eq-purchase-vendor">
              <Input
                id="eq-purchase-vendor"
                value={form.purchase_vendor}
                onChange={(e) => updateField('purchase_vendor', e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('equipment.form.fields.retired_at')} htmlFor="eq-retired-at">
            <Input
              id="eq-retired-at"
              type="date"
              value={form.retired_at}
              onChange={(e) => updateField('retired_at', e.target.value)}
            />
          </FormField>
        </Section>

        <Section title={t('equipment.form.sections.warranty')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('equipment.form.fields.warranty_expires_on')} htmlFor="eq-warranty-date">
              <Input
                id="eq-warranty-date"
                type="date"
                value={form.warranty_expires_on}
                onChange={(e) => updateField('warranty_expires_on', e.target.value)}
              />
            </FormField>
            <FormField label={t('equipment.form.fields.warranty_provider')} htmlFor="eq-warranty-provider">
              <Input
                id="eq-warranty-provider"
                value={form.warranty_provider}
                onChange={(e) => updateField('warranty_provider', e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('equipment.form.fields.warranty_notes')} htmlFor="eq-warranty-notes">
            <Textarea
              id="eq-warranty-notes"
              rows={3}
              value={form.warranty_notes}
              onChange={(e) => updateField('warranty_notes', e.target.value)}
            />
          </FormField>
        </Section>

        <Section title={t('equipment.form.sections.maintenance')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('equipment.form.fields.maintenance_interval_months')}
              htmlFor="eq-maintenance-interval"
              /* Le champ qui décide si l'équipement est suivi : sans lui, aucune
                 échéance n'existe et le bouton « Entretien fait » n'a rien à
                 avancer. Il mérite donc de dire à quoi il sert. */
              hint={t('equipment.form.hints.maintenance_interval')}
            >
              <Input
                id="eq-maintenance-interval"
                type="number"
                min="1"
                value={form.maintenance_interval_months}
                onChange={(e) => updateField('maintenance_interval_months', e.target.value)}
              />
            </FormField>
            <FormField label={t('equipment.form.fields.last_service_at')} htmlFor="eq-last-service">
              <Input
                id="eq-last-service"
                type="date"
                value={form.last_service_at}
                onChange={(e) => updateField('last_service_at', e.target.value)}
              />
            </FormField>
          </div>
        </Section>

        <FormField label={t('equipment.form.fields.notes')} htmlFor="eq-notes">
          <Textarea
            id="eq-notes"
            rows={4}
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </FormField>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
    </SheetDialog>
  );
}
