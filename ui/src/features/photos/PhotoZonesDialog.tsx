import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import type { DocumentItem } from '@/lib/api/documents';
import PhotoZonesEditor from './PhotoZonesEditor';

interface Props {
  /** La photo à ranger. `null` = dialog fermé. */
  photo: DocumentItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Ranger une photo sans l'ouvrir — le pendant, depuis la vignette, du bloc
 * « Zones » de la visionneuse. Les deux partagent `PhotoZonesEditor` : deux
 * formulaires pour la même écriture, c'est deux comportements qui divergeront.
 */
export default function PhotoZonesDialog({ photo, onOpenChange }: Props) {
  const { t } = useTranslation();

  return (
    <SheetDialog
      open={photo !== null}
      onOpenChange={onOpenChange}
      size="m"
      title={
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4" aria-hidden />
          {t('photos.zones.title')}
          {photo?.name ? (
            <span className="truncate text-sm font-normal text-muted-foreground">
              — {photo.name}
            </span>
          ) : null}
        </span>
      }
    >
      {photo ? (
        <PhotoZonesEditor
          photo={photo}
          onSaved={() => onOpenChange(false)}
          className="pb-4"
        />
      ) : null}
    </SheetDialog>
  );
}
