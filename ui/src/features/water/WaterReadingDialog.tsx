import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { isoDate } from '@/lib/period';
import type { WaterReading } from '@/lib/api/water';
import { useCreateWaterReading, useUpdateWaterReading } from './hooks';

interface WaterReadingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: WaterReading;
}

export default function WaterReadingDialog({ open, onOpenChange, existing }: WaterReadingDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [readingDate, setReadingDate] = React.useState('');
  const [indexM3, setIndexM3] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createReading = useCreateWaterReading();
  const updateReading = useUpdateWaterReading();
  const isPending = createReading.isPending || updateReading.isPending;

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setReadingDate(existing.reading_date);
      setIndexM3(existing.index_m3);
    } else {
      setReadingDate(isoDate(new Date()));
      setIndexM3('');
    }
    setError(null);
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!indexM3.trim() || !readingDate) {
      setError(t('water.reading.indexRequired'));
      return;
    }

    const payload = {
      reading_date: readingDate,
      index_m3: indexM3.trim(),
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
      title={isEditing ? t('water.reading.edit') : t('water.reading.new')}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('water.reading.readingDate')} htmlFor="water-reading-date">
            <Input
              id="water-reading-date"
              type="date"
              value={readingDate}
              onChange={(e) => setReadingDate(e.target.value)}
              required
            />
          </FormField>
          <FormField label={t('water.reading.indexM3')} htmlFor="water-reading-index">
            <Input
              id="water-reading-index"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              value={indexM3}
              onChange={(e) => setIndexM3(e.target.value)}
              placeholder="1250.5"
              required
            />
          </FormField>
        </div>
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
