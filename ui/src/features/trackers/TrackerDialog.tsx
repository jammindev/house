import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Textarea } from '@/design-system/textarea';
import { fetchProjects } from '@/lib/api/projects';
import type { Tracker } from '@/lib/api/trackers';
import { useCreateTracker, useUpdateTracker } from './hooks';

interface TrackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Tracker;
  /** Locks the tracker to this project (embed in the project detail tab). */
  defaultProjectId?: string;
}

export default function TrackerDialog({
  open,
  onOpenChange,
  existing,
  defaultProjectId,
}: TrackerDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [name, setName] = React.useState('');
  const [emoji, setEmoji] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createTracker = useCreateTracker();
  const updateTracker = useUpdateTracker();
  const isPending = createTracker.isPending || updateTracker.isPending;

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(),
    enabled: open && !defaultProjectId,
  });

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setEmoji(existing.emoji);
      setUnit(existing.unit);
      setDescription(existing.description);
      setProjectId(existing.project ?? '');
    } else {
      setName('');
      setEmoji('');
      setUnit('');
      setDescription('');
      setProjectId(defaultProjectId ?? '');
    }
    setError(null);
  }, [open, existing, defaultProjectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t('trackers.nameRequired'));
      return;
    }

    const payload = {
      name: name.trim(),
      emoji: emoji.trim(),
      unit: unit.trim(),
      description: description.trim(),
      project: projectId || null,
    };

    try {
      if (isEditing && existing) {
        await updateTracker.mutateAsync({ id: existing.id, payload });
      } else {
        await createTracker.mutateAsync(payload);
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
      title={isEditing ? t('trackers.editTitle') : t('trackers.new')}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <FormField label={t('trackers.fieldName')} htmlFor="tracker-name">
            <Input
              id="tracker-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('trackers.namePlaceholder')}
              required
            />
          </FormField>
          <FormField label={t('trackers.fieldEmoji')} htmlFor="tracker-emoji">
            <Input
              id="tracker-emoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="💧"
              maxLength={8}
            />
          </FormField>
        </div>

        <FormField label={t('trackers.fieldUnit')} htmlFor="tracker-unit">
          <Input
            id="tracker-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t('trackers.unitPlaceholder')}
            maxLength={50}
          />
        </FormField>

        <FormField label={t('trackers.fieldDescription')} htmlFor="tracker-description">
          <Textarea
            id="tracker-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </FormField>

        {!defaultProjectId ? (
          <FormField label={t('trackers.fieldProject')} htmlFor="tracker-project">
            <Select
              id="tracker-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={[
                { value: '', label: t('trackers.noProject') },
                ...(projects ?? []).map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
          </FormField>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isEditing ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
