import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { formatTrackerValue, type Tracker, type TrackerEntry } from '@/lib/api/trackers';
import { useCreateEntry, useUpdateEntry } from './hooks';

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracker: Tracker;
  existing?: TrackerEntry;
}

export default function EntryDialog({ open, onOpenChange, tracker, existing }: EntryDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [value, setValue] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const isPending = createEntry.isPending || updateEntry.isPending;

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setValue(formatTrackerValue(existing.value));
      setOccurredAt(toLocalInputValue(existing.occurred_at));
      setNote(existing.note);
    } else {
      setValue('');
      setOccurredAt(toLocalInputValue(new Date().toISOString()));
      setNote('');
    }
    setError(null);
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = value.trim().replace(',', '.');
    if (!normalized || Number.isNaN(Number(normalized)) || !occurredAt) {
      setError(t('trackers.valueRequired'));
      return;
    }

    const payload = {
      value: normalized,
      occurred_at: new Date(occurredAt).toISOString(),
      note: note.trim(),
    };

    try {
      if (isEditing && existing) {
        await updateEntry.mutateAsync({ id: existing.id, payload });
      } else {
        await createEntry.mutateAsync({ tracker: tracker.id, ...payload });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      const first = data ? Object.values(data).flat()[0] : null;
      setError(typeof first === 'string' ? first : t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('trackers.entryEditTitle') : t('trackers.entryNewTitle')}
      size="s"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label={
              tracker.unit
                ? `${t('trackers.fieldValue')} (${tracker.unit})`
                : t('trackers.fieldValue')
            }
            htmlFor="entry-value"
          >
            <Input
              id="entry-value"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              autoFocus
            />
          </FormField>
          <FormField label={t('trackers.fieldDate')} htmlFor="entry-occurred-at">
            <Input
              id="entry-occurred-at"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </FormField>
        </div>

        <FormField label={t('trackers.fieldNote')} htmlFor="entry-note">
          <Input
            id="entry-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </FormField>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isEditing ? t('common.save') : t('common.add')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
