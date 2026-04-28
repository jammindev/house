import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import { fetchZones } from '@/lib/api/zones';
import type { Zone } from '@/lib/api/zones';
import { useCreateUsagePoint, useBulkCreateUsagePoints, useUpdateUsagePoint } from './hooks';
import type { UsagePoint, UsagePointKind } from '@/lib/api/electricity';

interface UsagePointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: UsagePoint;
}

export default function UsagePointDialog({ open, onOpenChange, existing }: UsagePointDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [label, setLabel] = React.useState('');
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<UsagePointKind>('socket');
  const [zoneId, setZoneId] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [quantity, setQuantity] = React.useState(1);
  const [zones, setZones] = React.useState<Zone[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const createUsagePoint = useCreateUsagePoint();
  const bulkCreateUsagePoints = useBulkCreateUsagePoints();
  const updateUsagePoint = useUpdateUsagePoint();
  const isPending = createUsagePoint.isPending || bulkCreateUsagePoints.isPending || updateUsagePoint.isPending;

  React.useEffect(() => {
    if (!open) return;
    fetchZones().then(setZones).catch(() => setZones([]));
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setLabel(existing.label);
      setName(existing.name);
      setKind(existing.kind as UsagePointKind);
      setZoneId(existing.zone ?? '');
      setNotes(existing.notes ?? '');
    } else {
      setLabel('');
      setName('');
      setKind('socket');
      setZoneId('');
      setNotes('');
      setQuantity(1);
    }
    setError(null);
  }, [open, existing]);

  // Pré-sélection de la racine pour les nouvelles entrées.
  React.useEffect(() => {
    if (!open || existing || !zones.length || zoneId) return;
    const root = zones.find((z) => !z.parent);
    if (root) setZoneId(root.id);
  }, [open, existing, zones, zoneId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) { setError(t('electricity.usagePoint.labelRequired')); return; }
    if (!name.trim()) { setError(t('electricity.usagePoint.nameRequired')); return; }

    const payload = {
      label: label.trim(),
      name: name.trim(),
      kind,
      zone: zoneId || null,
      notes: notes.trim(),
    };

    try {
      if (isEditing && existing) {
        await updateUsagePoint.mutateAsync({ id: existing.id, payload });
      } else if (quantity > 1) {
        await bulkCreateUsagePoints.mutateAsync({ ...payload, quantity });
      } else {
        await createUsagePoint.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string[]> } })?.response?.data;
      if (data) {
        const first = Object.values(data).flat()[0];
        setError(first ?? t('common.saveFailed'));
      } else {
        setError(t('common.saveFailed'));
      }
    }
  }

  const kindOptions = [
    { value: 'socket', label: t('electricity.usagePoint.kindSocket') },
    { value: 'light', label: t('electricity.usagePoint.kindLight') },
  ];

  const zoneOptions = [
    { value: '', label: '—' },
    ...zones.map((z) => ({ value: z.id, label: z.full_path ?? z.name })),
  ];

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('electricity.usagePoint.edit') : t('electricity.usagePoint.new')}
    >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('electricity.usagePoint.label')} htmlFor="up-label">
              <Input
                id="up-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={quantity > 1 ? 'UP-SAL' : 'UP-01'}
                required
              />
            </FormField>
            <FormField label={t('electricity.usagePoint.kind')} htmlFor="up-kind">
              <Select
                id="up-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as UsagePointKind)}
                options={kindOptions}
              />
            </FormField>
          </div>

          <FormField label={t('electricity.usagePoint.name')} htmlFor="up-name">
            <Input
              id="up-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('electricity.usagePoint.namePlaceholder')}
              required
            />
          </FormField>

          <FormField label={t('electricity.usagePoint.zone')} htmlFor="up-zone">
            <Select
              id="up-zone"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              options={zoneOptions}
            />
          </FormField>

          {!isEditing && (
            <FormField label={t('electricity.usagePoint.quantity')} htmlFor="up-quantity">
              <Input
                id="up-quantity"
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value))))}
              />
              {quantity > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('electricity.usagePoint.quantityHint', { label: label.trim() || '…', count: quantity })}
                </p>
              )}
            </FormField>
          )}

          <FormField label={t('electricity.usagePoint.notes')} htmlFor="up-notes">
            <Textarea
              id="up-notes"
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
