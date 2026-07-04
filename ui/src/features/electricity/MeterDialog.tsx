import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { fetchZones, type Zone } from '@/lib/api/zones';
import type { ElectricityMeter, MeterTariffType } from '@/lib/api/electricity';
import { useCreateMeter, useUpdateMeter } from './hooks';

interface MeterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ElectricityMeter;
}

export default function MeterDialog({ open, onOpenChange, existing }: MeterDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [name, setName] = React.useState('');
  const [serialNumber, setSerialNumber] = React.useState('');
  const [tariffType, setTariffType] = React.useState<MeterTariffType>('base');
  const [zoneId, setZoneId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const createMeter = useCreateMeter();
  const updateMeter = useUpdateMeter();
  const isPending = createMeter.isPending || updateMeter.isPending;

  React.useEffect(() => {
    if (!open) return;
    fetchZones().then(setZones).catch(() => setZones([]));
    if (existing) {
      setName(existing.name);
      setSerialNumber(existing.serial_number ?? '');
      setTariffType(existing.tariff_type);
      setZoneId(existing.zone ?? '');
      setNotes(existing.notes ?? '');
    } else {
      setName('');
      setSerialNumber('');
      setTariffType('base');
      setZoneId('');
      setNotes('');
    }
    setError(null);
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t('electricity.meter.nameRequired'));
      return;
    }

    const payload = {
      name: name.trim(),
      serial_number: serialNumber.trim(),
      tariff_type: tariffType,
      zone: zoneId || null,
      notes: notes.trim(),
    };

    try {
      if (isEditing && existing) {
        await updateMeter.mutateAsync({ id: existing.id, payload });
      } else {
        // the metering point lives where the user is — day boundaries follow it
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        await createMeter.mutateAsync({ ...payload, timezone });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const first = data ? Object.values(data).flat()[0] : null;
      setError(first ?? t('common.saveFailed'));
    }
  }

  const zoneOptions = [
    { value: '', label: t('electricity.meter.noZone') },
    ...zones.map((z) => ({ value: z.id, label: z.name })),
  ];

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('electricity.meter.edit') : t('electricity.meter.new')}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <FormField label={t('electricity.meter.name')} htmlFor="meter-name">
          <Input
            id="meter-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('electricity.meter.namePlaceholder')}
            required
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('electricity.meter.tariffType')} htmlFor="meter-tariff">
            <Select
              id="meter-tariff"
              value={tariffType}
              onChange={(e) => setTariffType(e.target.value as MeterTariffType)}
              options={[
                { value: 'base', label: t('electricity.consumption.register.base') },
                { value: 'hp_hc', label: t('electricity.meter.tariffHpHc') },
              ]}
            />
          </FormField>
          <FormField label={t('electricity.meter.serialNumber')} htmlFor="meter-serial">
            <Input
              id="meter-serial"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </FormField>
        </div>
        <FormField label={t('electricity.meter.zone')} htmlFor="meter-zone">
          <Select
            id="meter-zone"
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            options={zoneOptions}
          />
        </FormField>
        <FormField label={t('electricity.meter.notes')} htmlFor="meter-notes">
          <Textarea
            id="meter-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
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
