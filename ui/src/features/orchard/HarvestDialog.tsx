import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Input } from '@/design-system/input';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import { DecimalInput } from '@/design-system/decimal-input';
import { todayISO } from '@/lib/format';
import { HARVEST_UNITS, type Harvest, type HarvestUnit } from '@/lib/api/orchard';
import { useCreateHarvest, useUpdateHarvest } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Harvest;
  treeId: string;
}

export default function HarvestDialog({ open, onOpenChange, existing, treeId }: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateHarvest();
  const updateMutation = useUpdateHarvest();
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Canonical state: dot separator, exactly as it goes to the API. The field
  // renders the locale's separator — hence no `.replace(',', '.')` at submit.
  const [quantity, setQuantity] = React.useState('');
  const [unit, setUnit] = React.useState<HarvestUnit>('kg');
  const [harvestedOn, setHarvestedOn] = React.useState(todayISO());
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setQuantity(existing.quantity);
      setUnit(existing.unit);
      setHarvestedOn(existing.harvested_on);
      setNotes(existing.notes);
    } else {
      setQuantity('');
      setUnit('kg');
      setHarvestedOn(todayISO());
      setNotes('');
    }
  }, [open, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity) return;

    try {
      if (existing) {
        await updateMutation.mutateAsync({
          id: existing.id,
          payload: { quantity, unit, harvested_on: harvestedOn, notes: notes.trim() },
        });
      } else {
        await createMutation.mutateAsync({
          tree: treeId,
          quantity,
          unit,
          harvested_on: harvestedOn,
          notes: notes.trim(),
        });
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
      title={isEditing ? t('orchard.harvest.editTitle') : t('orchard.harvest.newTitle')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={`${t('orchard.fields.quantity')} *`} htmlFor="harvest-quantity">
            <DecimalInput
              id="harvest-quantity"
              value={quantity}
              onChange={setQuantity}
              decimals={3}
              required
              autoFocus
            />
          </FormField>
          <FormField label={`${t('orchard.fields.unit')} *`} htmlFor="harvest-unit">
            <Select
              id="harvest-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as HarvestUnit)}
            >
              {HARVEST_UNITS.map((value) => (
                <option key={value} value={value}>
                  {t(`orchard.unit.${value}`)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label={`${t('orchard.fields.harvestedOn')} *`} htmlFor="harvest-date">
          <Input
            id="harvest-date"
            type="date"
            value={harvestedOn}
            onChange={(e) => setHarvestedOn(e.target.value)}
            required
          />
        </FormField>

        <FormField label={t('orchard.fields.notes')} htmlFor="harvest-notes">
          <Textarea
            id="harvest-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </FormField>

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
