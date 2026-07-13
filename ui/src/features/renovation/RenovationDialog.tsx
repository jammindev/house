import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Select } from '@/design-system/select';
import { CheckboxField } from '@/design-system/checkbox-field';
import { Button } from '@/design-system/button';
import { useZones, buildZoneTree } from '@/features/zones/hooks';
import type { InteractionListItem } from '@/lib/api/interactions';
import {
  RENOVATION_ELEMENTS,
  RENOVATION_TYPES,
  type RenovationCreateInput,
  type RenovationElement,
  type RenovationType,
} from '@/lib/api/renovation';
import { useCreateRenovation, useUpdateRenovation } from './hooks';

interface RenovationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zone the dialog was opened from — pre-checked on create. */
  zoneId: string;
  /** Defined = edit, undefined = create. */
  existing?: InteractionListItem;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RenovationDialog({
  open,
  onOpenChange,
  zoneId,
  existing,
}: RenovationDialogProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const { data: allZones = [] } = useZones();
  const createMutation = useCreateRenovation();
  const updateMutation = useUpdateRenovation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [element, setElement] = React.useState<RenovationElement>('paint');
  const [type, setType] = React.useState<RenovationType>('installation');
  const [product, setProduct] = React.useState('');
  const [brand, setBrand] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState(todayIso());
  const [notes, setNotes] = React.useState('');
  const [selectedZones, setSelectedZones] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  // Init / reset on open.
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (existing) {
      const md = (existing.metadata ?? {}) as Record<string, unknown>;
      setElement((md.element as RenovationElement) || 'other');
      setType((existing.type as RenovationType) || 'installation');
      setProduct((md.product as string) || '');
      setBrand((md.brand as string) || '');
      setReference((md.reference as string) || '');
      setSubject(existing.subject || '');
      setOccurredAt(existing.occurred_at ? existing.occurred_at.slice(0, 10) : todayIso());
      setNotes(existing.content || '');
      setSelectedZones(new Set(existing.zone_id_list ?? [zoneId]));
    } else {
      setElement('paint');
      setType('installation');
      setProduct('');
      setBrand('');
      setReference('');
      setSubject('');
      setOccurredAt(todayIso());
      setNotes('');
      setSelectedZones(new Set([zoneId]));
    }
  }, [open, existing, zoneId]);

  const { sortedZones, depthMap } = React.useMemo(() => buildZoneTree(allZones), [allZones]);
  const allSelected = allZones.length > 0 && selectedZones.size === allZones.length;

  function toggleZone(id: string) {
    setSelectedZones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleWholeHouse() {
    setSelectedZones((prev) =>
      prev.size === allZones.length ? new Set([zoneId]) : new Set(allZones.map((z) => z.id)),
    );
  }

  const elementOptions = RENOVATION_ELEMENTS.map((key) => ({
    value: key,
    label: t(`renovation.elements.${key}`),
  }));
  const typeOptions = RENOVATION_TYPES.map((key) => ({
    value: key,
    label: t(`renovation.types.${key}`),
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedZones.size === 0) {
      setError(t('renovation.form.zonesRequired'));
      return;
    }

    const payload: RenovationCreateInput = {
      element,
      interaction_type: type,
      product: product.trim(),
      brand: brand.trim(),
      reference: reference.trim(),
      subject: subject.trim() || undefined,
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
      notes: notes.trim(),
      zone_ids: Array.from(selectedZones),
    };

    try {
      if (existing) {
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
      title={isEditing ? t('renovation.form.editTitle') : t('renovation.form.createTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('renovation.form.element')} htmlFor="reno-element">
              <Select
                id="reno-element"
                options={elementOptions}
                value={element}
                onChange={(e) => setElement(e.target.value as RenovationElement)}
              />
            </FormField>
            <FormField label={t('renovation.form.type')} htmlFor="reno-type">
              <Select
                id="reno-type"
                options={typeOptions}
                value={type}
                onChange={(e) => setType(e.target.value as RenovationType)}
              />
            </FormField>
          </div>

          <FormField label={t('renovation.form.product')} htmlFor="reno-product">
            <Input
              id="reno-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder={t('renovation.form.productPlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('renovation.form.brand')} htmlFor="reno-brand">
              <Input id="reno-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </FormField>
            <FormField label={t('renovation.form.reference')} htmlFor="reno-reference">
              <Input
                id="reno-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label={t('renovation.form.date')} htmlFor="reno-date">
            <Input
              id="reno-date"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </FormField>

          <FormField label={t('renovation.form.subject')} htmlFor="reno-subject">
            <Input
              id="reno-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('renovation.form.subjectPlaceholder')}
            />
          </FormField>

          <FormField label={t('renovation.form.notes')} htmlFor="reno-notes">
            <Textarea id="reno-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>

          {/* Multi-zone selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {t('renovation.form.zones')}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={toggleWholeHouse}>
                {allSelected ? t('renovation.form.clearZones') : t('renovation.form.wholeHouse')}
              </Button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {sortedZones.map((zone) => (
                <div
                  key={zone.id}
                  style={{ paddingLeft: (depthMap.get(zone.id) ?? 0) * 12 }}
                >
                  <CheckboxField
                    id={`reno-zone-${zone.id}`}
                    label={zone.name}
                    checked={selectedZones.has(zone.id)}
                    onChange={() => toggleZone(zone.id)}
                    className="rounded px-1 py-0.5 hover:bg-muted"
                  />
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isEditing ? t('common.save') : t('renovation.form.submit')}
            </Button>
          </div>
      </form>
    </SheetDialog>
  );
}
