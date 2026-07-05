import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import type { ElectricityMeter, EnergyRegister, MeterReading } from '@/lib/api/electricity';
import { useCreateMeterReading, useUpdateMeterReading } from './hooks';

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface ReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter: ElectricityMeter;
  existing?: MeterReading;
}

export default function ReadingDialog({ open, onOpenChange, meter, existing }: ReadingDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const registers: EnergyRegister[] = meter.tariff_type === 'hp_hc' ? ['hp', 'hc'] : ['base'];

  const [register, setRegister] = React.useState<EnergyRegister>(registers[0]);
  const [readingAt, setReadingAt] = React.useState('');
  const [indexKwh, setIndexKwh] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createReading = useCreateMeterReading();
  const updateReading = useUpdateMeterReading();
  const isPending = createReading.isPending || updateReading.isPending;

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setRegister(existing.register);
      setReadingAt(toLocalInputValue(existing.reading_at));
      setIndexKwh(existing.index_kwh);
    } else {
      setRegister(meter.tariff_type === 'hp_hc' ? 'hp' : 'base');
      setReadingAt(toLocalInputValue(new Date().toISOString()));
      setIndexKwh('');
    }
    setError(null);
  }, [open, existing, meter.tariff_type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!indexKwh.trim() || !readingAt) {
      setError(t('electricity.reading.indexRequired'));
      return;
    }

    const payload = {
      meter: meter.id,
      register,
      reading_at: new Date(readingAt).toISOString(),
      index_kwh: indexKwh.trim(),
    };

    try {
      if (isEditing && existing) {
        await updateReading.mutateAsync({ id: existing.id, payload });
      } else {
        await createReading.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const first = data ? Object.values(data).flat()[0] : null;
      setError(first ?? t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('electricity.reading.edit') : t('electricity.reading.new')}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('electricity.consumption.registerLabel')} htmlFor="reading-register">
            <Select
              id="reading-register"
              value={register}
              onChange={(e) => setRegister(e.target.value as EnergyRegister)}
              disabled={registers.length === 1}
              options={registers.map((r) => ({
                value: r,
                label: t(`electricity.consumption.register.${r}`),
              }))}
            />
          </FormField>
          <FormField label={t('electricity.reading.readingAt')} htmlFor="reading-at">
            <Input
              id="reading-at"
              type="datetime-local"
              value={readingAt}
              onChange={(e) => setReadingAt(e.target.value)}
              required
            />
          </FormField>
        </div>
        <FormField label={t('electricity.reading.indexKwh')} htmlFor="reading-index">
          <Input
            id="reading-index"
            type="number"
            step="0.001"
            min="0"
            inputMode="decimal"
            value={indexKwh}
            onChange={(e) => setIndexKwh(e.target.value)}
            placeholder="45230.5"
            required
          />
        </FormField>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
