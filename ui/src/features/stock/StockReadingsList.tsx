import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { DecimalInput } from '@/design-system/decimal-input';
import { Input } from '@/design-system/input';
import { FormField } from '@/design-system/form-field';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatDate, toLocalISODate } from '@/lib/format';
import type { StockLevelReading } from '@/lib/api/stock';
import { useDeleteStockReading, useStockReadings, useUpdateStockReading } from './hooks';

interface StockReadingsListProps {
  itemId: string;
  unit: string;
}

/**
 * Les relevés de niveau, enfin visibles — et corrigeables.
 *
 * Un relevé était une écriture sans retour : refaire un inventaire *ajoutait*
 * une lecture au lieu d'en corriger une, et une descente saisie par erreur
 * restait comptée comme de la vraie consommation dans le rythme et dans la date
 * de rupture, pour toujours.
 *
 * La confirmation de suppression **annonce la quantité qui en résultera** : la
 * quantité de l'article suit sa dernière lecture, donc supprimer la plus récente
 * déplace le stock. Le faire sans le dire serait le même silence qu'on répare.
 */
export default function StockReadingsList({ itemId, unit }: StockReadingsListProps) {
  const { t } = useTranslation();
  const { data: readings = [], isLoading } = useStockReadings(itemId);
  const updateMutation = useUpdateStockReading();
  const deleteMutation = useDeleteStockReading();

  const [editing, setEditing] = React.useState<StockLevelReading | null>(null);
  const [deleting, setDeleting] = React.useState<StockLevelReading | null>(null);
  const [quantity, setQuantity] = React.useState('');
  const [readAt, setReadAt] = React.useState('');

  React.useEffect(() => {
    if (!editing) return;
    setQuantity(editing.quantity);
    setReadAt(toLocalISODate(new Date(editing.reading_at)));
  }, [editing]);

  // Ce que la suppression laissera derrière elle : le serveur réaligne l'article
  // sur la lecture restante la plus récente, et 0 quand il n'en reste aucune.
  const quantityAfterDelete = React.useMemo(() => {
    if (!deleting) return null;
    const remaining = readings.filter((r) => r.id !== deleting.id);
    return remaining.length > 0 ? remaining[0].quantity : '0';
  }, [deleting, readings]);

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    updateMutation.mutate(
      {
        id: editing.id,
        // Midi : à minuit, la date reculerait d'un jour au passage en UTC.
        payload: { quantity: parsed, reading_at: new Date(`${readAt}T12:00:00`).toISOString() },
      },
      { onSuccess: () => setEditing(null) },
    );
  }

  if (isLoading || readings.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t('stock.readings.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('stock.readings.hint')}</p>

      <div className="space-y-2">
        {readings.map((reading) => (
          <Card key={reading.id} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {reading.quantity} {unit}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(reading.reading_at)} · {t(`stock.readings.kind.${reading.kind}`)}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-8 p-0"
                aria-label={t('common.edit')}
                onClick={() => setEditing(reading)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive"
                aria-label={t('common.delete')}
                onClick={() => setDeleting(reading)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <SheetDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={t('stock.readings.edit_title')}
      >
        <form onSubmit={submitEdit} className="mt-4 space-y-4">
          <FormField label={t('stock.readings.fields.quantity', { unit })} htmlFor="reading-quantity">
            <DecimalInput id="reading-quantity" decimals={3} value={quantity} onChange={setQuantity} required />
          </FormField>
          <FormField label={t('stock.readings.fields.reading_at')} htmlFor="reading-date">
            <Input id="reading-date" type="date" value={readAt} onChange={(e) => setReadAt(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </SheetDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('common.confirmDelete')}
        description={t('stock.readings.delete_confirm', {
          quantity: quantityAfterDelete ?? '',
          unit,
        })}
        onConfirm={() =>
          deleting &&
          deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
        loading={deleteMutation.isPending}
      />
    </section>
  );
}
