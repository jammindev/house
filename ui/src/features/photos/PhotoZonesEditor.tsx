import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
import { Label } from '@/design-system/label';
import ZonePicker from '@/features/zones/ZonePicker';
import type { DocumentItem } from '@/lib/api/documents';
import { useSetPhotoZones } from './hooks';

interface Props {
  photo: DocumentItem;
  /** Appelé après un enregistrement réussi — un dialog s'en sert pour se fermer. */
  onSaved?: () => void;
  className?: string;
}

/** Zones actuellement assignées à la photo, telles que le serveur les donne. */
function assignedIds(photo: DocumentItem): string[] {
  return (photo.zone_links ?? []).map((link) => link.zone_id);
}

/**
 * Ranger une photo — depuis la photo, et non depuis la zone.
 *
 * `attach_document` ne se pose que sur une zone : corriger une photo mal rangée
 * demandait de deviner où elle était, d'aller dans cette zone, de l'en détacher,
 * puis d'aller dans la bonne. L'écriture passe ici par un **remplacement** en un
 * seul appel (`set_zones`), donc il n'existe pas d'instant où la photo n'est
 * rangée nulle part.
 *
 * Le brouillon est local et l'enregistrement explicite : en mode multiple, chaque
 * clic de la liste déclencherait sinon sa propre requête, et une photo passerait
 * visiblement par des états que personne n'a demandés. Il ne se réaligne sur le
 * serveur que quand le **contenu** des zones change (pas à chaque refetch), sinon
 * un rafraîchissement de fond effacerait une sélection en cours.
 */
export default function PhotoZonesEditor({ photo, onSaved, className }: Props) {
  const { t } = useTranslation();
  const setZones = useSetPhotoZones();

  const assignedKey = assignedIds(photo).slice().sort().join(',');
  const [draft, setDraft] = React.useState<string[]>(() => assignedIds(photo));

  React.useEffect(() => {
    setDraft(assignedKey ? assignedKey.split(',') : []);
  }, [photo.id, assignedKey]);

  const dirty = draft.slice().sort().join(',') !== assignedKey;

  const save = () => {
    setZones.mutate(
      { photoId: photo.id, zoneIds: draft },
      { onSuccess: () => onSaved?.() },
    );
  };

  return (
    <div className={className}>
      <Label htmlFor={`photo-zones-${photo.id}`} className="text-xs text-muted-foreground">
        {t('photos.zones.label')}
      </Label>
      <ZonePicker
        id={`photo-zones-${photo.id}`}
        mode="multiple"
        value={draft}
        onChange={setDraft}
        placeholder={t('photos.zones.placeholder')}
        className="mt-1"
      />
      {dirty ? (
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" onClick={save} disabled={setZones.isPending}>
            {t('common.save')}
          </Button>
          {/* Jamais désactivé : une mutation qui traîne ne doit pas piéger l'écran. */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDraft(assignedIds(photo))}
          >
            {t('common.cancel')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
