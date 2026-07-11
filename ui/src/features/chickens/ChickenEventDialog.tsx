import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import {
  CHICKEN_EVENT_TYPES,
  type Chicken,
  type ChickenEvent,
  type ChickenEventType,
} from '@/lib/api/chickens';
import { useCreateChickenEvent, useUpdateChickenEvent } from './hooks';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ChickenEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ChickenEvent;
  /** Pre-selected hen (from a detail page); null = flock-wide. */
  chicken?: Chicken | null;
  /** All hens, for the optional "which hen?" select on the page-level dialog. */
  chickens?: Chicken[];
}

export default function ChickenEventDialog({
  open,
  onOpenChange,
  existing,
  chicken,
  chickens = [],
}: ChickenEventDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateChickenEvent();
  const updateMutation = useUpdateChickenEvent();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [type, setType] = React.useState<ChickenEventType>('care');
  const [title, setTitle] = React.useState('');
  const [occurredOn, setOccurredOn] = React.useState(todayIsoDate());
  const [notes, setNotes] = React.useState('');
  const [chickenId, setChickenId] = React.useState('');
  const [remind, setRemind] = React.useState(false);
  const [reminderDate, setReminderDate] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setType(existing.type);
      setTitle(existing.title);
      setOccurredOn(existing.occurred_on);
      setNotes(existing.notes);
      setChickenId(existing.chicken ?? '');
    } else {
      setType('care');
      setTitle('');
      setOccurredOn(todayIsoDate());
      setNotes('');
      setChickenId(chicken?.id ?? '');
    }
    setRemind(false);
    setReminderDate('');
  }, [open, existing, chicken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      type,
      title: title.trim(),
      occurred_on: occurredOn,
      notes: notes.trim(),
      chicken: chickenId || null,
      ...(remind && reminderDate && !isEditing ? { reminder_due_date: reminderDate } : {}),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('chickens.events.edit_title') : t('chickens.events.new_title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={`${t('chickens.events.fields.type')} *`} htmlFor="event-type">
              <Select
                id="event-type"
                value={type}
                onChange={(e) => setType(e.target.value as ChickenEventType)}
              >
                {CHICKEN_EVENT_TYPES.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {t(`chickens.events.types.${eventType}`)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('chickens.events.fields.occurred_on')} htmlFor="event-date">
              <Input
                id="event-date"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                required
              />
            </FormField>
          </div>

          <FormField label={`${t('chickens.events.fields.title')} *`} htmlFor="event-title">
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </FormField>

          {!chicken ? (
            <FormField label={t('chickens.events.fields.chicken')} htmlFor="event-chicken">
              <Select
                id="event-chicken"
                value={chickenId}
                onChange={(e) => setChickenId(e.target.value)}
              >
                <option value="">{t('chickens.events.whole_flock')}</option>
                {chickens.map((hen) => (
                  <option key={hen.id} value={hen.id}>
                    {hen.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          <FormField label={t('chickens.events.fields.notes')} htmlFor="event-notes">
            <Textarea
              id="event-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>

          {!isEditing && type === 'care' ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={remind}
                  onChange={(e) => setRemind(e.target.checked)}
                  className="h-4 w-4"
                />
                {t('chickens.events.remind_me')}
              </label>
              {remind ? (
                <Input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  min={todayIsoDate()}
                  required
                  aria-label={t('chickens.events.reminder_date')}
                />
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isEditing ? t('common.save') : t('chickens.events.actions.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
