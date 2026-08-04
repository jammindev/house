import * as React from 'react';
import { Camera, Check, ImageOff } from 'lucide-react';
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
  /**
   * Fourni = **mode sélection** : la vignette coche au lieu d'ouvrir. C'est la
   * présence du callback qui porte le mode, pas un booléen de plus — les deux
   * pourraient se contredire.
   */
  onToggleSelected?: () => void;
  selected?: boolean;
  className?: string;
}

/**
 * La vignette de photo de toute l'application.
 *
 * Elle remplace deux implémentations qui avaient divergé (`PhotoGrid` et le
 * `PhotoTile` de l'onglet par entité) et partageaient les mêmes défauts :
 *
 * 1. **Le fallback n'existait pas.** `onError` mettait `style.display = 'none'`,
 *    et l'icône de repli vivait dans la branche `else` du même ternaire — donc
 *    jamais atteinte. Une miniature cassée laissait un carré vide muet. Ici
 *    l'échec est un **état** (`failed`), pas une manipulation du DOM.
 * 2. Les couleurs étaient codées en dur (`bg-slate-100`, `text-slate-400`), donc
 *    le thème sombre affichait une grille claire.
 *
 * **La vignette est la photo.** Elle a porté un temps le nom du fichier sur un
 * dégradé, et une pastille « Sans zone » : deux surcharges sur *toutes* les cases,
 * pour un `IMG_4312.jpg` qui n'apprend rien et un manque qu'on ne pouvait pas
 * corriger de là. Les deux ont déménagé dans la visionneuse — le nom y est
 * éditable, le manque de zone à un pli du sélecteur qui le règle. Ne rien y
 * réintroduire sans ce test : la grille se lit d'un coup d'œil ou pas du tout.
 *
 * Le nom reste le **nom accessible** du bouton : retiré de l'écran, pas du calque
 * d'accessibilité, où il est le seul moyen de désigner une vignette.
 */
export default function PhotoThumb({
  photo,
  onOpen,
  phase,
  actions,
  onToggleSelected,
  selected = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);

  const src = photo.thumbnail_url || photo.file_url || null;
  const label = photo.name || t('photos.untitled');
  const phaseKey = phase === undefined ? null : phase || 'unclassified';

  const selecting = onToggleSelected !== undefined;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-muted',
        selected ? 'border-primary ring-2 ring-primary' : 'border-border',
        className,
      )}
    >
      <button
        type="button"
        onClick={selecting ? onToggleSelected : onOpen}
        aria-label={label}
        aria-pressed={selecting ? selected : undefined}
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

      {phaseKey ? (
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm">
          {t(`photos.phase.${phaseKey}`)}
        </span>
      ) : null}

      {/* La coche est toujours visible en mode sélection, cochée ou non : une case à
          cocher qui n'apparaît qu'au survol laisse croire, au doigt, qu'il n'y a
          rien à cocher. */}
      {selecting ? (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background/85 backdrop-blur-sm',
          )}
        >
          {selected ? <Check className="h-3.5 w-3.5" /> : null}
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
