import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import type {
  InsuranceContract,
  InsurancePayload,
  InsuranceType,
  InsuranceStatus,
  PaymentFrequency,
} from '@/lib/api/insurance';
import { useCreateInsurance, useUpdateInsurance } from './hooks';

interface InsuranceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existing?: InsuranceContract;
}

const TYPE_OPTIONS: InsuranceType[] = ['health', 'home', 'car', 'life', 'liability', 'other'];
const STATUS_OPTIONS: InsuranceStatus[] = ['active', 'suspended', 'terminated'];
const FREQUENCY_OPTIONS: PaymentFrequency[] = ['monthly', 'quarterly', 'yearly'];

type FormState = {
  name: string;
  provider: string;
  contract_number: string;
  type: InsuranceType;
  insured_item: string;
  start_date: string;
  end_date: string;
  renewal_date: string;
  status: InsuranceStatus;
  payment_frequency: PaymentFrequency;
  monthly_cost: string;
  yearly_cost: string;
  coverage_summary: string;
  notes: string;
};

const EMPTY_STATE: FormState = {
  name: '',
  provider: '',
  contract_number: '',
  type: 'other',
  insured_item: '',
  start_date: '',
  end_date: '',
  renewal_date: '',
  status: 'active',
  payment_frequency: 'monthly',
  monthly_cost: '',
  yearly_cost: '',
  coverage_summary: '',
  notes: '',
};

export default function InsuranceDialog({ open, onOpenChange, onSaved, existing }: InsuranceDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [form, setForm] = React.useState<FormState>(EMPTY_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const createMutation = useCreateInsurance();
  const updateMutation = useUpdateInsurance();

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        name: existing.name,
        provider: existing.provider,
        contract_number: existing.contract_number,
        type: existing.type,
        insured_item: existing.insured_item,
        start_date: existing.start_date ?? '',
        end_date: existing.end_date ?? '',
        renewal_date: existing.renewal_date ?? '',
        status: existing.status,
        payment_frequency: existing.payment_frequency,
        monthly_cost: Number(existing.monthly_cost) > 0 ? existing.monthly_cost : '',
        yearly_cost: Number(existing.yearly_cost) > 0 ? existing.yearly_cost : '',
        coverage_summary: existing.coverage_summary,
        notes: existing.notes,
      });
    } else {
      setForm(EMPTY_STATE);
    }
    setError(null);
  }, [open, existing]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError(t('insurance.name_required'));
      return;
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError(t('insurance.dates_inconsistent'));
      return;
    }

    const payload: InsurancePayload = {
      name: form.name.trim(),
      provider: form.provider.trim(),
      contract_number: form.contract_number.trim(),
      type: form.type,
      insured_item: form.insured_item.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      renewal_date: form.renewal_date || null,
      status: form.status,
      payment_frequency: form.payment_frequency,
      monthly_cost: form.monthly_cost || '0',
      yearly_cost: form.yearly_cost || '0',
      coverage_summary: form.coverage_summary,
      notes: form.notes,
    };

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError(t(existing ? 'insurance.update_failed' : 'insurance.create_failed'));
    }
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('insurance.edit_title') : t('insurance.new_title')}
    >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <FormField label={t('insurance.field.name')} htmlFor="insurance-name">
            <Input
              id="insurance-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder={t('insurance.field.name_placeholder')}
              required
              autoFocus
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('insurance.field.type')} htmlFor="insurance-type">
              <Select
                id="insurance-type"
                value={form.type}
                onChange={(e) => update('type', e.target.value as InsuranceType)}
                options={TYPE_OPTIONS.map((v) => ({ value: v, label: t(`insurance.type.${v}`) }))}
              />
            </FormField>
            <FormField label={t('insurance.field.status')} htmlFor="insurance-status">
              <Select
                id="insurance-status"
                value={form.status}
                onChange={(e) => update('status', e.target.value as InsuranceStatus)}
                options={STATUS_OPTIONS.map((v) => ({ value: v, label: t(`insurance.status.${v}`) }))}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('insurance.field.provider')} htmlFor="insurance-provider">
              <Input
                id="insurance-provider"
                value={form.provider}
                onChange={(e) => update('provider', e.target.value)}
                placeholder={t('insurance.field.provider_placeholder')}
              />
            </FormField>
            <FormField label={t('insurance.field.contract_number')} htmlFor="insurance-contract-number">
              <Input
                id="insurance-contract-number"
                value={form.contract_number}
                onChange={(e) => update('contract_number', e.target.value)}
                placeholder={t('insurance.field.contract_number_placeholder')}
              />
            </FormField>
          </div>

          <FormField label={t('insurance.field.insured_item')} htmlFor="insurance-insured-item">
            <Input
              id="insurance-insured-item"
              value={form.insured_item}
              onChange={(e) => update('insured_item', e.target.value)}
              placeholder={t('insurance.field.insured_item_placeholder')}
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label={t('insurance.field.start_date')} htmlFor="insurance-start-date">
              <Input
                id="insurance-start-date"
                type="date"
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value)}
              />
            </FormField>
            <FormField label={t('insurance.field.end_date')} htmlFor="insurance-end-date">
              <Input
                id="insurance-end-date"
                type="date"
                value={form.end_date}
                onChange={(e) => update('end_date', e.target.value)}
              />
            </FormField>
            <FormField label={t('insurance.field.renewal_date')} htmlFor="insurance-renewal-date">
              <Input
                id="insurance-renewal-date"
                type="date"
                value={form.renewal_date}
                onChange={(e) => update('renewal_date', e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label={t('insurance.field.payment_frequency')} htmlFor="insurance-frequency">
              <Select
                id="insurance-frequency"
                value={form.payment_frequency}
                onChange={(e) => update('payment_frequency', e.target.value as PaymentFrequency)}
                options={FREQUENCY_OPTIONS.map((v) => ({
                  value: v,
                  label: t(`insurance.frequency.${v}`),
                }))}
              />
            </FormField>
            <FormField label={t('insurance.field.monthly_cost')} htmlFor="insurance-monthly-cost">
              <Input
                id="insurance-monthly-cost"
                type="number"
                step="0.01"
                min="0"
                value={form.monthly_cost}
                onChange={(e) => update('monthly_cost', e.target.value)}
                placeholder="0.00"
              />
            </FormField>
            <FormField label={t('insurance.field.yearly_cost')} htmlFor="insurance-yearly-cost">
              <Input
                id="insurance-yearly-cost"
                type="number"
                step="0.01"
                min="0"
                value={form.yearly_cost}
                onChange={(e) => update('yearly_cost', e.target.value)}
                placeholder="0.00"
              />
            </FormField>
          </div>

          <FormField label={t('insurance.field.coverage_summary')} htmlFor="insurance-coverage">
            <Textarea
              id="insurance-coverage"
              rows={3}
              value={form.coverage_summary}
              onChange={(e) => update('coverage_summary', e.target.value)}
              placeholder={t('insurance.field.coverage_summary_placeholder')}
            />
          </FormField>

          <FormField label={t('insurance.field.notes')} htmlFor="insurance-notes">
            <Textarea
              id="insurance-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder={t('insurance.field.notes_placeholder')}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
    </SheetDialog>
  );
}
