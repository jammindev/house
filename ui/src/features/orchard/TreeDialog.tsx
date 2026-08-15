import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import ZonePicker from '@/features/zones/ZonePicker';
import {
  TREE_KINDS,
  TREE_STATUSES,
  type Tree,
  type TreeKind,
  type TreeStatus,
} from '@/lib/api/orchard';
import { useCreateTree, useUpdateTree } from './hooks';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Tree;
  /** Pre-selected zone when the dialog is opened from a zone context. */
  defaultZoneId?: string;
}

export default function TreeDialog({ open, onOpenChange, existing, defaultZoneId }: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateTree();
  const updateMutation = useUpdateTree();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<TreeKind>('fruit_tree');
  const [species, setSpecies] = React.useState('');
  const [rootstock, setRootstock] = React.useState('');
  const [plantedOn, setPlantedOn] = React.useState('');
  const [floweringStart, setFloweringStart] = React.useState('');
  const [floweringEnd, setFloweringEnd] = React.useState('');
  const [status, setStatus] = React.useState<TreeStatus>('alive');
  const [notes, setNotes] = React.useState('');
  const [zoneId, setZoneId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setError('');
    if (existing) {
      setName(existing.name);
      setKind(existing.kind);
      setSpecies(existing.species);
      setRootstock(existing.rootstock);
      setPlantedOn(existing.planted_on ?? '');
      setFloweringStart(existing.flowering_start_month?.toString() ?? '');
      setFloweringEnd(existing.flowering_end_month?.toString() ?? '');
      setStatus(existing.status);
      setNotes(existing.notes);
      setZoneId(existing.zone);
    } else {
      setName('');
      setKind('fruit_tree');
      setSpecies('');
      setRootstock('');
      setPlantedOn('');
      setFloweringStart('');
      setFloweringEnd('');
      setStatus('alive');
      setNotes('');
      setZoneId(defaultZoneId ?? null);
    }
  }, [open, existing, defaultZoneId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!zoneId) {
      // Said here rather than left to a 400: a subject with no place is a
      // subject nobody finds again, and the form must say so before the network.
      setError(t('orchard.errors.zoneRequired'));
      return;
    }
    // Both bounds or neither — a half-declared window means nothing, and the
    // frost alert would have to guess the missing half.
    if (Boolean(floweringStart) !== Boolean(floweringEnd)) {
      setError(t('orchard.errors.floweringIncomplete'));
      return;
    }

    const payload = {
      name: name.trim(),
      zone_id: zoneId,
      kind,
      species: species.trim(),
      rootstock: rootstock.trim(),
      planted_on: plantedOn || null,
      flowering_start_month: floweringStart ? Number(floweringStart) : null,
      flowering_end_month: floweringEnd ? Number(floweringEnd) : null,
      status,
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
      title={isEditing ? t('orchard.dialog.editTitle') : t('orchard.dialog.newTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={`${t('orchard.fields.name')} *`} htmlFor="tree-name">
          <Input
            id="tree-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </FormField>

        <FormField label={`${t('orchard.fields.zone')} *`} htmlFor="tree-zone">
          <ZonePicker id="tree-zone" value={zoneId} onChange={setZoneId} />
        </FormField>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={t('orchard.fields.kind')} htmlFor="tree-kind">
            <Select
              id="tree-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as TreeKind)}
            >
              {TREE_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`orchard.kind.${value}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('orchard.fields.species')} htmlFor="tree-species">
            <Input
              id="tree-species"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={t('orchard.fields.rootstock')} htmlFor="tree-rootstock">
            <Input
              id="tree-rootstock"
              value={rootstock}
              onChange={(e) => setRootstock(e.target.value)}
            />
          </FormField>
          <FormField label={t('orchard.fields.plantedOn')} htmlFor="tree-planted">
            <Input
              id="tree-planted"
              type="date"
              value={plantedOn}
              onChange={(e) => setPlantedOn(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t('orchard.fields.plantedOnHint')}
            </p>
          </FormField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={t('orchard.fields.floweringStart')} htmlFor="tree-flowering-start">
            <Select
              id="tree-flowering-start"
              value={floweringStart}
              onChange={(e) => setFloweringStart(e.target.value)}
            >
              <option value="">{t('orchard.fields.notSet')}</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {t(`orchard.months.${m}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('orchard.fields.floweringEnd')} htmlFor="tree-flowering-end">
            <Select
              id="tree-flowering-end"
              value={floweringEnd}
              onChange={(e) => setFloweringEnd(e.target.value)}
            >
              <option value="">{t('orchard.fields.notSet')}</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {t(`orchard.months.${m}`)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {isEditing ? (
          <FormField label={t('orchard.fields.status')} htmlFor="tree-status">
            <Select
              id="tree-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TreeStatus)}
            >
              {TREE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`orchard.status.${value}`)}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}

        <FormField label={t('orchard.fields.notes')} htmlFor="tree-notes">
          <Textarea
            id="tree-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </FormField>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
