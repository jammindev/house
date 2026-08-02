import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Textarea } from '@/design-system/textarea';
import { todayISO } from '@/lib/format';
import type { ChickenChore } from '@/lib/api/chickens';

import { useCreateChore, useUpdateChore } from './hooks';

interface ChoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** undefined = create, defined = edit. */
  existing?: ChickenChore;
}

export default function ChoreDialog({ open, onOpenChange, existing }: ChoreDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateChore();
  const updateMutation = useUpdateChore();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = React.useState('');
  const [emoji, setEmoji] = React.useState('');
  const [intervalDays, setIntervalDays] = React.useState('7');
  const [startsOn, setStartsOn] = React.useState(todayISO());
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setEmoji(existing.emoji);
      setIntervalDays(String(existing.interval_days));
      setStartsOn(existing.starts_on);
      setNotes(existing.notes);
    } else {
      setName('');
      setEmoji('');
      setIntervalDays('7');
      setStartsOn(todayISO());
      setNotes('');
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      emoji: emoji.trim(),
      interval_days: Number(intervalDays),
      starts_on: startsOn,
      notes: notes.trim(),
    };
    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast handled by the mutation hooks
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('chickens.chores.edit_title') : t('chickens.chores.new_title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_6rem]">
          <FormField label={`${t('chickens.chores.fields.name')} *`} htmlFor="chore-name">
            <Input
              id="chore-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('chickens.chores.fields.name_placeholder')}
              required
              autoFocus
            />
          </FormField>
          <FormField label={t('chickens.chores.fields.emoji')} htmlFor="chore-emoji">
            <Input
              id="chore-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              placeholder="🧹"
            />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* An interval is a whole number of days — a counter, so it keeps the
              native arrows. Decimals go through DecimalInput; this is not one. */}
          <FormField
            label={`${t('chickens.chores.fields.interval_days')} *`}
            htmlFor="chore-interval"
          >
            <Input
              id="chore-interval"
              type="number"
              min={1}
              max={3650}
              step={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              required
            />
          </FormField>
          <FormField label={t('chickens.chores.fields.starts_on')} htmlFor="chore-starts">
            <Input
              id="chore-starts"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              required
            />
          </FormField>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          {t('chickens.chores.fields.starts_on_help')}
        </p>

        <FormField label={t('chickens.chores.fields.notes')} htmlFor="chore-notes">
          <Textarea
            id="chore-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </FormField>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
