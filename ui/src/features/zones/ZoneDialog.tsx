import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/design-system/dialog';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import type { Zone, ZonePayload } from '@/lib/api/zones';
import { useCreateZone, useUpdateZone, useZones, buildZoneTree, getDescendantIds } from './hooks';

// Default color for first-level zones
const DEFAULT_COLOR = '#60A5FA';

interface ZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  existingZone?: Zone;
}

export default function ZoneDialog({
  open,
  onOpenChange,
  onSaved,
  existingZone,
}: ZoneDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existingZone);

  const [name, setName] = React.useState('');
  const [parentId, setParentId] = React.useState<string>('');
  const [color, setColor] = React.useState(DEFAULT_COLOR);
  const [error, setError] = React.useState<string | null>(null);

  const { data: allZones = [] } = useZones();
  const createMutation = useCreateZone();
  const updateMutation = useUpdateZone();

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Build sorted tree for the parent selector
  const { sortedZones, depthMap } = React.useMemo(
    () => buildZoneTree(allZones),
    [allZones]
  );

  // When editing, exclude self and all descendants from parent options
  const parentOptions = React.useMemo(() => {
    if (!existingZone) return sortedZones;
    const excluded = getDescendantIds(existingZone.id, allZones);
    return sortedZones.filter((z) => !excluded.has(z.id));
  }, [sortedZones, existingZone, allZones]);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (!open) return;
    setName(existingZone?.name ?? '');
    setParentId(existingZone?.parentId ?? existingZone?.parent ?? '');
    setColor(existingZone?.color ?? DEFAULT_COLOR);
    setError(null);
  }, [open, existingZone]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('zones.nameRequired'));
      return;
    }

    const payload: ZonePayload = {
      name: trimmedName,
      parent: parentId || null,
      color,
    };

    try {
      if (isEditing && existingZone) {
        await updateMutation.mutateAsync({ id: existingZone.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('zones.editTitle') : t('zones.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {error ? (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="zone-name">
              {t('zones.fieldName')}
            </label>
            <Input
              id="zone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('zones.placeholder')}
              required
              autoComplete="off"
            />
          </div>

          {/* Parent zone */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="zone-parent">
              {t('zones.fieldParent')}
            </label>
            <select
              id="zone-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('zones.noParent')}</option>
              {parentOptions.map((zone) => {
                const depth = depthMap.get(zone.id) ?? 0;
                const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
                return (
                  <option key={zone.id} value={zone.id}>
                    {prefix}{zone.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="zone-color">
              {t('zones.colorLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="zone-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                aria-label={t('zones.colorLabel')}
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#60A5FA"
                className="font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('zones.colorHelper')}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
