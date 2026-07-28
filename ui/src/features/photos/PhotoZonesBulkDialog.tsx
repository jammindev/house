import * as React from 'react';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Button } from '@/design-system/button';
import { Label } from '@/design-system/label';
import ZonePicker from '@/features/zones/ZonePicker';
import { useAddPhotosZones } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Photos cochées, dans l'ordre de l'écran. */
  photoIds: string[];
  /** Appelé après un enregistrement réussi — la page vide sa sélection. */
  onSaved: () => void;
}

/**
 * Attribuer des zones à un lot de photos.
 *
 * Le dialog dit **« s'ajoutent »**, parce que c'est ce que fait l'endpoint : sur un
 * lot, les zones choisies viennent compléter celles déjà présentes. Un lot qui
 * remplacerait effacerait le rangement de photos qu'on n'a pas regardées une par
 * une, et cet effacement ne se verrait nulle part. Le prix à payer est dit ici
 * aussi : retirer une zone reste un geste photo par photo.
 */
export default function PhotoZonesBulkDialog({ open, onOpenChange, photoIds, onSaved }: Props) {
  const { t } = useTranslation();
  const addZones = useAddPhotosZones();
  const [zoneIds, setZoneIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setZoneIds([]);
  }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (zoneIds.length === 0) return;
    addZones.mutate(
      { photoIds, zoneIds },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSaved();
        },
      },
    );
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      size="m"
      title={
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4" aria-hidden />
          {t('photos.zones.bulkTitle', { count: photoIds.length })}
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4 pb-4">
        <div>
          <Label htmlFor="photos-bulk-zones">{t('photos.zones.label')}</Label>
          <ZonePicker
            id="photos-bulk-zones"
            mode="multiple"
            value={zoneIds}
            onChange={setZoneIds}
            placeholder={t('photos.zones.placeholder')}
            className="mt-1"
          />
        </div>

        <p className="text-xs text-muted-foreground">{t('photos.zones.bulkHint')}</p>

        <div className="flex justify-end gap-2">
          {/* « Annuler » ne se désactive jamais : une mutation qui traîne ne doit
              pas retenir l'utilisateur dans le dialog. */}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={zoneIds.length === 0 || addZones.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
