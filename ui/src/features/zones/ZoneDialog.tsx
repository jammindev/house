import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { FormField } from '@/design-system/form-field';
import type { Zone, ZonePayload } from '@/lib/api/zones';
import { useCreateZone, useUpdateZone, useZones, buildZoneTree, getDescendantIds } from './hooks';

// Default color for first-level zones
const DEFAULT_COLOR = '#60A5FA';

interface ZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Zone;
}

export default function ZoneDialog({ open, onOpenChange, existing }: ZoneDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);

  const [name, setName] = React.useState('');
  const [parentId, setParentId] = React.useState<string>('');
  const [color, setColor] = React.useState(DEFAULT_COLOR);
  const [colorTouched, setColorTouched] = React.useState(false);
  const [surface, setSurface] = React.useState('');
  const [note, setNote] = React.useState('');
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
    if (!existing) return sortedZones;
    const excluded = getDescendantIds(existing.id, allZones);
    return sortedZones.filter((z) => !excluded.has(z.id));
  }, [sortedZones, existing, allZones]);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setSurface(existing?.surface != null ? String(existing.surface) : '');
    setNote(existing?.note ?? '');
    const initialParent = existing?.parentId ?? existing?.parent ?? '';
    setParentId(initialParent);
    if (existing) {
      setColor(existing.color ?? DEFAULT_COLOR);
    } else {
      const parent = initialParent ? allZones.find((z) => z.id === initialParent) : null;
      setColor(parent?.color ?? DEFAULT_COLOR);
    }
    setColorTouched(false);
    setError(null);
  }, [open, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  // In create mode, mirror the parent's color until the user picks one manually
  React.useEffect(() => {
    if (!open || existing || colorTouched) return;
    const parent = parentId ? allZones.find((z) => z.id === parentId) : null;
    setColor(parent?.color ?? DEFAULT_COLOR);
  }, [parentId, allZones, open, existing, colorTouched]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('zones.nameRequired'));
      return;
    }

    // Surface vide ≠ surface à zéro : « pas renseignée » se dit `null`, sinon
    // toute zone non mesurée pèserait 0 m² dans le total de la liste.
    const trimmedSurface = surface.trim();
    let parsedSurface: number | null = null;
    if (trimmedSurface !== '') {
      parsedSurface = Number(trimmedSurface.replace(',', '.'));
      if (!Number.isFinite(parsedSurface) || parsedSurface < 0) {
        setError(t('zones.invalidSurface'));
        return;
      }
    }

    const payload: ZonePayload = {
      name: trimmedName,
      parent: parentId || null,
      color,
      surface: parsedSurface,
      note: note.trim(),
    };

    try {
      if (isEditing && existing) {
        await updateMutation.mutateAsync({ id: existing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('zones.editTitle') : t('zones.newTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          ) : null}

          {/* Name */}
          <FormField label={t('zones.fieldName')} htmlFor="zone-name">
            <Input
              id="zone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('zones.placeholder')}
              required
              autoComplete="off"
            />
          </FormField>

          {/* Parent zone */}
          <FormField label={t('zones.fieldParent')} htmlFor="zone-parent">
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
          </FormField>

          {/* Color */}
          <FormField label={t('zones.colorLabel')} htmlFor="zone-color">
            <div className="flex items-center gap-2">
              <input
                id="zone-color"
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setColorTouched(true);
                }}
                className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                aria-label={t('zones.colorLabel')}
              />
              <Input
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setColorTouched(true);
                }}
                placeholder="#60A5FA"
                className="font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('zones.colorHelper')}</p>
          </FormField>

          {/* Surface — affichée dans la liste des zones et sommée en tête de
              page : sans ce champ, la colonne resterait vide pour tout le monde. */}
          <FormField label={t('zones.surfaceLabel')} htmlFor="zone-surface">
            <Input
              id="zone-surface"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              placeholder={t('zones.surfacePlaceholder')}
            />
          </FormField>

          {/* Note */}
          <FormField label={t('zones.detail.notesLabel')} htmlFor="zone-note">
            <Textarea
              id="zone-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('zones.notePlaceholder')}
              rows={3}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
      </form>
    </SheetDialog>
  );
}
