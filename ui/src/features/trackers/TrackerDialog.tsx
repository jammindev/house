import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Textarea } from '@/design-system/textarea';
import { fetchEquipmentList } from '@/lib/api/equipment';
import { fetchProjects } from '@/lib/api/projects';
import { fetchStockItems } from '@/lib/api/stock';
import { fetchZones } from '@/lib/api/zones';
import type { Tracker } from '@/lib/api/trackers';
import { useCreateTracker, useUpdateTracker } from './hooks';

/** Linkable entity types offered in the picker (all agent-searchable). */
type TargetType = 'equipment' | 'zone' | 'stock_item';
const TARGET_TYPES: TargetType[] = ['equipment', 'zone', 'stock_item'];

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
  const [targetType, setTargetType] = React.useState<'' | TargetType>('');
  const [targetId, setTargetId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const createTracker = useCreateTracker();
  const updateTracker = useUpdateTracker();
  const isPending = createTracker.isPending || updateTracker.isPending;

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(),
    enabled: open && !defaultProjectId,
  });
  const { data: equipment } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => fetchEquipmentList(),
    enabled: open && targetType === 'equipment',
  });
  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
    enabled: open && targetType === 'zone',
  });
  const { data: stockItems } = useQuery({
    queryKey: ['stock-items'],
    queryFn: () => fetchStockItems(),
    enabled: open && targetType === 'stock_item',
  });

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setEmoji(existing.emoji);
      setUnit(existing.unit);
      setDescription(existing.description);
      setProjectId(existing.project ?? '');
      setTargetType((existing.target_type as TargetType | null) ?? '');
      setTargetId(existing.target_id ?? '');
    } else {
      setName('');
      setEmoji('');
      setUnit('');
      setDescription('');
      setProjectId(defaultProjectId ?? '');
      setTargetType('');
      setTargetId('');
    }
    setError(null);
  }, [open, existing, defaultProjectId]);

  const targetOptions = React.useMemo(() => {
    if (targetType === 'equipment') {
      return (equipment ?? []).map((e) => ({ value: e.id, label: e.name }));
    }
    if (targetType === 'zone') {
      return (zones ?? []).map((z) => ({ value: z.id, label: z.name }));
    }
    if (targetType === 'stock_item') {
      return (stockItems ?? []).map((s) => ({ value: s.id, label: s.name }));
    }
    return [];
  }, [targetType, equipment, zones, stockItems]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t('trackers.nameRequired'));
      return;
    }
    if (targetType && !targetId) {
      setError(t('trackers.targetEntityRequired'));
      return;
    }

    const payload = {
      name: name.trim(),
      emoji: emoji.trim(),
      unit: unit.trim(),
      description: description.trim(),
      project: projectId || null,
      target_type: targetType || null,
      target_id: targetType ? targetId : null,
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

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('trackers.fieldLinkedTo')} htmlFor="tracker-target-type">
            <Select
              id="tracker-target-type"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as '' | TargetType);
                setTargetId('');
              }}
              options={[
                { value: '', label: t('trackers.linkedNone') },
                ...TARGET_TYPES.map((type) => ({
                  value: type,
                  label: t(`trackers.linkedType.${type}`),
                })),
              ]}
            />
          </FormField>
          {targetType ? (
            <FormField label={t('trackers.fieldTargetEntity')} htmlFor="tracker-target-id">
              <Select
                id="tracker-target-id"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                options={[{ value: '', label: '—' }, ...targetOptions]}
              />
            </FormField>
          ) : null}
        </div>

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
