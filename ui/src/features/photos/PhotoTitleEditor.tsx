import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Label } from '@/design-system/label';
import type { DocumentItem } from '@/lib/api/documents';
import { useRenamePhoto } from './hooks';

interface Props {
  photo: DocumentItem;
  className?: string;
}

/**
 * Renommer une photo depuis la photo.
 *
 * Un appareil nomme ses fichiers `IMG_4312.jpg`, et corriger ce nom demandait de
 * quitter la galerie pour la fiche document : personne ne le corrigeait. Or c'est
 * le seul repère qui reste d'une photo dans une recherche ou une citation de
 * l'agent — le nom du fichier n'est pas une information, le titre en est une.
 *
 * Même contrat que {@link PhotoZonesEditor}, et pour les mêmes raisons : brouillon
 * local, enregistrement explicite, réalignement quand la visionneuse change
 * d'image (sans quoi enregistrer donnerait à la photo suivante le nom de la
 * précédente).
 */
export default function PhotoTitleEditor({ photo, className }: Props) {
  const { t } = useTranslation();
  const rename = useRenamePhoto();

  const saved = photo.name ?? '';
  const [draft, setDraft] = React.useState(saved);

  React.useEffect(() => setDraft(photo.name ?? ''), [photo.id, photo.name]);

  const trimmed = draft.trim();
  const dirty = trimmed !== saved.trim();
  // Un nom vide effacerait le seul repère de la photo — et le serveur le refuse.
  const canSave = dirty && trimmed !== '';

  const save = () => {
    if (!canSave) return;
    rename.mutate({ photoId: photo.id, name: trimmed });
  };

  return (
    <div className={className}>
      <Label htmlFor={`photo-name-${photo.id}`} className="text-xs text-muted-foreground">
        {t('photos.name.label')}
      </Label>
      <Input
        id={`photo-name-${photo.id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('photos.untitled')}
        autoComplete="off"
        className="mt-1"
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          save();
        }}
      />
      {dirty ? (
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" onClick={save} disabled={!canSave || rename.isPending}>
            {t('common.save')}
          </Button>
          {/* Jamais désactivé : une mutation qui traîne ne doit pas piéger l'écran. */}
          <Button type="button" size="sm" variant="outline" onClick={() => setDraft(saved)}>
            {t('common.cancel')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
