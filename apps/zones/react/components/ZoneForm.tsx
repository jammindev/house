import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';

import { DEFAULT_FIRST_LEVEL_COLOR, normalizeHexColor } from '../lib/colors';
import { formatZoneOptionLabel } from '../lib/tree';
import type { Zone, ZoneMutationPayload } from '../types/zones';

type Props = {
  setOpen: (v: boolean) => void;
  sortedZones: Zone[];
  zoneDepths: Map<string, number>;
  onCreate: (payload: ZoneMutationPayload) => Promise<void>;
};

export default function ZoneForm({ setOpen, sortedZones, zoneDepths, onCreate }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | ''>('');
  const [surface, setSurface] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState(DEFAULT_FIRST_LEVEL_COLOR);
  const [creating, setCreating] = useState(false);

  const selectedParent = useMemo(
    () => (parentId ? sortedZones.find((zone) => zone.id === parentId) ?? null : null),
    [parentId, sortedZones]
  );
  const requiresColorSelection = !!(selectedParent && !selectedParent.parent_id);

  const reset = () => {
    setName('');
    setParentId('');
    setSurface('');
    setNote('');
    setColor(DEFAULT_FIRST_LEVEL_COLOR);
  };

  const handleCreate = async () => {
    const nameTrim = name.trim();
    if (!nameTrim) return;

    const sTrim = surface.trim();
    let sVal: number | null = null;
    if (sTrim) {
      const parsed = Number(sTrim);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(t('zones.invalidSurface'));
      }
      sVal = parsed;
    }

    const noteVal = note.trim() || null;
    const colorValue = requiresColorSelection ? normalizeHexColor(color) : null;
    if (requiresColorSelection && !colorValue) {
      throw new Error(t('zones.colorRequired'));
    }

    setCreating(true);
    try {
      await onCreate({
        name: nameTrim,
        parent_id: parentId || null,
        note: noteVal,
        surface: sVal,
        color: colorValue,
      });
      setOpen(false);
      reset();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
      <div className="flex flex-col gap-2 md:flex-row">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('zones.placeholder')} className="md:flex-1" />
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm md:w-56">
          <option value="">{t('zones.noParent')}</option>
          {sortedZones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {formatZoneOptionLabel(zone, zoneDepths)}
            </option>
          ))}
        </select>
      </div>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={surface}
        onChange={(e) => setSurface(e.target.value)}
        placeholder={t('zones.surfacePlaceholder')}
        className="md:w-56"
      />
      {requiresColorSelection ? (
        <div className="flex flex-col gap-1 rounded-md border border-indigo-200 bg-background p-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{t('zones.colorLabel')}</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-full rounded-md border border-indigo-200 bg-white p-1 md:w-40"
            aria-label={t('zones.colorLabel')}
          />
          <p className="text-xs text-muted-foreground">{t('zones.colorHelper')}</p>
        </div>
      ) : null}
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('zones.notePlaceholder')} rows={3} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleCreate} disabled={creating || !name.trim()}>
          {creating ? t('zones.createInProgress') : t('common.save')}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={creating}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
