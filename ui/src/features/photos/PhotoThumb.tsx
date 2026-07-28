import * as React from 'react';
import { Camera, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { DocumentItem, PhotoPhase } from '@/lib/api/documents';

interface Props {
  photo: DocumentItem;
  onOpen: () => void;
  /** Phase à afficher en pastille. `undefined` = pas de pastille. */
  phase?: PhotoPhase | '';
  /** Menu d'actions posé en haut à droite (révélé au survol/focus). */
  actions?: React.ReactNode;
  /** Affiche le nom en bas de la vignette. Défaut : true. */
  showName?: boolean;
  className?: string;
}

/**
 * La vignette de photo de toute l'application.
 *
 * Elle remplace deux implémentations qui avaient divergé (`PhotoGrid` et le
 * `PhotoTile` de l'onglet par entité) et partageaient les mêmes trois défauts :
 *
 * 1. **Le fallback n'existait pas.** `onError` mettait `style.display = 'none'`,
 *    et l'icône de repli vivait dans la branche `else` du même ternaire — donc
 *    jamais atteinte. Une miniature cassée laissait un carré vide muet. Ici
 *    l'échec est un **état** (`failed`), pas une manipulation du DOM.
 * 2. **Le nom n'apparaissait qu'au survol** — soit jamais, au doigt. Le dégradé
 *    est maintenant permanent et lisible partout.
 * 3. Les couleurs étaient codées en dur (`bg-slate-100`, `text-slate-400`), donc
 *    le thème sombre affichait une grille claire.
 */
export default function PhotoThumb({
  photo,
  onOpen,
  phase,
  actions,
  showName = true,
  className,
}: Props) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);

  const src = photo.thumbnail_url || photo.file_url || null;
  const label = photo.name || t('photos.untitled');
  const phaseKey = phase === undefined ? null : phase || 'unclassified';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-muted',
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="block aspect-square w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {src && !failed ? (
          <img
            src={src}
            alt={label}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            {failed ? (
              <>
                <ImageOff className="h-6 w-6" aria-hidden />
                <span className="px-2 text-center text-[10px] leading-tight">
                  {t('photos.thumbFailed')}
                </span>
              </>
            ) : (
              <Camera className="h-6 w-6" aria-hidden />
            )}
          </div>
        )}
      </button>

      {showName ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 pb-1.5 pt-6">
          <p className="truncate text-xs font-medium text-white">{label}</p>
        </div>
      ) : null}

      {phaseKey ? (
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
          {t(`photos.phase.${phaseKey}`)}
        </span>
      ) : null}

      {actions ? (
        <div className="absolute right-1 top-1 rounded-lg bg-background/85 opacity-0 shadow-sm backdrop-blur-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 max-md:opacity-100">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
