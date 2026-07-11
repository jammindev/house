import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import { fetchZones } from '@/lib/api/zones';
import { CHICKEN_STATUSES, type Chicken, type ChickenStatus } from '@/lib/api/chickens';
import { useCreateChicken, useUpdateChicken } from './hooks';

interface ChickenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Chicken;
}

export default function ChickenDialog({ open, onOpenChange, existing }: ChickenDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateChicken();
  const updateMutation = useUpdateChicken();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const { data: zones = [] } = useQuery({ queryKey: ['zones'], queryFn: fetchZones });

  const [name, setName] = React.useState('');
  const [breed, setBreed] = React.useState('');
  const [color, setColor] = React.useState('');
  const [hatchedOn, setHatchedOn] = React.useState('');
  const [acquiredOn, setAcquiredOn] = React.useState('');
  const [status, setStatus] = React.useState<ChickenStatus>('active');
  const [notes, setNotes] = React.useState('');
  const [zoneId, setZoneId] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setBreed(existing.breed);
      setColor(existing.color);
      setHatchedOn(existing.hatched_on ?? '');
      setAcquiredOn(existing.acquired_on ?? '');
      setStatus(existing.status);
      setNotes(existing.notes);
      setZoneId(existing.zone ?? '');
    } else {
      setName('');
      setBreed('');
      setColor('');
      setHatchedOn('');
      setAcquiredOn('');
      setStatus('active');
      setNotes('');
      setZoneId('');
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      breed: breed.trim(),
      color: color.trim(),
      hatched_on: hatchedOn || null,
      acquired_on: acquiredOn || null,
      status,
      notes: notes.trim(),
      zone_id: zoneId || null,
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
            {isEditing ? t('chickens.dialog.edit_title') : t('chickens.dialog.new_title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <FormField label={`${t('chickens.fields.name')} *`} htmlFor="chicken-name">
            <Input
              id="chicken-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('chickens.fields.breed')} htmlFor="chicken-breed">
              <Input id="chicken-breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
            </FormField>
            <FormField label={t('chickens.fields.color')} htmlFor="chicken-color">
              <Input id="chicken-color" value={color} onChange={(e) => setColor(e.target.value)} />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('chickens.fields.hatched_on')} htmlFor="chicken-hatched">
              <Input
                id="chicken-hatched"
                type="date"
                value={hatchedOn}
                onChange={(e) => setHatchedOn(e.target.value)}
              />
            </FormField>
            <FormField label={t('chickens.fields.acquired_on')} htmlFor="chicken-acquired">
              <Input
                id="chicken-acquired"
                type="date"
                value={acquiredOn}
                onChange={(e) => setAcquiredOn(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {isEditing ? (
              <FormField label={t('chickens.fields.status')} htmlFor="chicken-status">
                <Select
                  id="chicken-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ChickenStatus)}
                >
                  {CHICKEN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`chickens.status.${s}`)}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}
            <FormField label={t('chickens.fields.zone')} htmlFor="chicken-zone">
              <Select id="chicken-zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                <option value="">{t('chickens.fields.no_zone')}</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.full_path || zone.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label={t('chickens.fields.notes')} htmlFor="chicken-notes">
            <Textarea
              id="chicken-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isEditing ? t('common.save') : t('chickens.actions.create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
