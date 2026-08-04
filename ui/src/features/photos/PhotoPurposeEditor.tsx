import { useTranslation } from 'react-i18next';
import { FilterPill } from '@/design-system/filter-pill';
import type { DocumentItem, PhotoPurpose } from '@/lib/api/documents';
import { useSetPhotoPurpose } from './hooks';
import { PURPOSES } from './purposes';

/**
 * Le choix d'intention d'**une** photo, dans le panneau de la visionneuse.
 *
 * Recliquer sur l'intention posée la retire : détrier une photo qu'on a sous les yeux
 * est un geste unitaire légitime, contrairement au lot — qui, lui, refuse le vide,
 * parce que « détrier trente photos » serait une destruction déguisée en raccourci.
 */
export default function PhotoPurposeEditor({ photo }: { photo: DocumentItem }) {
  const { t } = useTranslation();
  const setPurpose = useSetPhotoPurpose();

  const current = photo.purpose || '';

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t('photos.purpose.label')}</p>
      <div className="flex flex-wrap gap-1.5">
        {PURPOSES.map((spec) => {
          const Icon = spec.icon;
          const active = current === spec.key;
          return (
            <FilterPill
              key={spec.key}
              active={active}
              disabled={setPurpose.isPending}
              title={t(spec.hintKey)}
              onClick={() =>
                setPurpose.mutate({
                  photoId: photo.id,
                  purpose: (active ? '' : spec.key) as PhotoPurpose | '',
                })
              }
            >
              <Icon className="h-3 w-3" aria-hidden />
              {t(spec.labelKey)}
            </FilterPill>
          );
        })}
      </div>
      {/* Une photo non triée le dit. Sans cette ligne, « aucune pastille allumée » se
          lirait comme un défaut d'affichage plutôt que comme un état — c'est la même
          raison qui interdit d'afficher « conforme » sans avoir vérifié. */}
      {current === '' ? (
        <p className="text-xs text-muted-foreground">{t('photos.purpose.none')}</p>
      ) : null}
    </div>
  );
}
