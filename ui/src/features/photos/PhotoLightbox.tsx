import * as React from 'react';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ImageOff,
  MapPinOff,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from '@/design-system/dialog';
import { Button, buttonVariants } from '@/design-system/button';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { formatFileSize, type DocumentItem, type PhotoPhase } from '@/lib/api/documents';
import { hasCaptureDate } from './grouping';

interface Props {
  /** La collection parcourue — donne le contexte précédent/suivant. */
  photos: DocumentItem[];
  /** Id de la photo ouverte. `null` = fermée. */
  openId: string | null;
  /** Change la photo ouverte, ou ferme (`null`). */
  onOpenChange: (id: string | null) => void;
  /** Action destructive. Sur la galerie elle supprime, dans un onglet elle détache. */
  onRemove: (photo: DocumentItem) => void;
  /** Libellé de l'action destructive — « Supprimer » ou « Retirer », jamais deviné. */
  removeLabel: string;
  /** Phase de la photo courante, si le contexte en porte une. */
  phaseOf?: (photo: DocumentItem) => PhotoPhase | '' | undefined;
  /**
   * Bloc « Zones » du panneau déplié. Injecté plutôt que câblé ici : la
   * visionneuse reste sans données propres — elle reçoit déjà `phaseOf`,
   * `onRemove` et `removeLabel` de son appelant.
   */
  renderZones?: (photo: DocumentItem) => React.ReactNode;
  /** Bloc « Intention » du panneau déplié — injecté, comme `renderZones`. */
  renderPurpose?: (photo: DocumentItem) => React.ReactNode;
  /** Bloc « Titre » du panneau déplié — injecté, comme `renderZones`. */
  renderTitle?: (photo: DocumentItem) => React.ReactNode;
  /**
   * Signale, sur la card repliée, une photo rangée dans aucune zone.
   *
   * Réservé à la galerie, comme le `flagWithoutSupplier` des dépenses : une
   * pastille n'avertit que là où le manque est **actionnable** — ici, à un pli du
   * sélecteur de zones. Sous l'onglet Photos d'une entité, la question posée est
   * la phase des travaux, et rien ne permettrait d'y ranger la photo.
   */
  flagWithoutZone?: boolean;
}

/** Distance horizontale minimale, en px, pour qu'un glissement compte comme un swipe. */
const SWIPE_THRESHOLD = 50;

/** Style commun des surfaces posées sur la photo : celles de l'app, en verre. */
const GLASS = 'border border-border/60 bg-background/85 shadow-lg backdrop-blur-md';

/** Durée d'immobilité de la souris après laquelle la navigation se retire, en ms. */
const POINTER_IDLE_MS = 2000;

/**
 * Visionneuse plein écran d'une collection de photos.
 *
 * Ce que la version « carte » (`max-w-4xl`, image à gauche, panneau à droite)
 * coûtait, et que le plein écran corrige :
 *
 * - **La photo n'était jamais le sujet.** Sur mobile elle occupait 45 % de la
 *   hauteur, le reste allant à des métadonnées qu'on ne lit qu'une fois ; sur
 *   desktop elle était cernée de blanc, qui fausse les couleurs de ce qu'on
 *   regarde. D'où la toile noire, identique dans les deux thèmes.
 * - **Le chrome ne se retirait pas.** Un tap sur la photo le fait disparaître,
 *   un second le ramène — le geste d'Apple Photos, et rien de plus.
 *
 * Le chrome retiré est `aria-hidden` **et** `inert`, pas seulement transparent :
 * un bouton invisible qu'on atteint encore à la tabulation est un piège, et
 * l'opacité seule n'a jamais retiré personne du calque d'accessibilité.
 *
 * **Deux calques, pas un.** Ce qui *commente* la photo (la card, la phase) et ce
 * qui permet d'en *changer* (chevrons, compteur, fermeture) ne se retirent pas
 * ensemble : tout cacher d'un seul tenant laissait la souris bloquée sur la photo
 * courante, et il fallait rappeler la card qu'on venait d'écarter pour avancer.
 * Le calque de navigation revient donc au mouvement de la souris, seul, et
 * s'efface après {@link POINTER_IDLE_MS} d'immobilité — la photo redevient nue
 * sans avoir à le demander.
 *
 * **Et la card elle-même se replie.** Elle disait tout d'un coup — quatre faits,
 * les notes, l'intention, les zones, trois boutons — devant une photo qu'on ouvre
 * pour la *regarder*. Repliée, elle ne garde que ce qui situe l'image (titre,
 * date) et ce qui appelle un geste (le manque de zone, en icône seule). Le reste
 * est à un clic, et ce clic donne en plus de quoi **corriger** le titre et les
 * zones : ce qui se lit et ce qui s'édite sont au même endroit, jamais dans deux
 * écrans qui pourraient afficher deux noms du même fichier.
 *
 * Trois acquis de la version précédente restent tenus par les tests : une seule
 * croix de fermeture (celle de Radix est masquée), la navigation sans fermer
 * (flèches, clavier, swipe), et un repli explicite quand l'image ne charge pas.
 */
export default function PhotoLightbox({
  photos,
  openId,
  onOpenChange,
  onRemove,
  removeLabel,
  phaseOf,
  renderZones,
  renderPurpose,
  renderTitle,
  flagWithoutZone = false,
}: Props) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);
  const [chromeVisible, setChromeVisible] = React.useState(true);
  const [pointerActive, setPointerActive] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const index = openId === null ? -1 : photos.findIndex((p) => p.id === openId);
  const photo = index >= 0 ? photos[index] : null;
  const open = photo !== null;

  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < photos.length - 1;

  const goPrev = React.useCallback(() => {
    if (index > 0) onOpenChange(photos[index - 1].id);
  }, [index, photos, onOpenChange]);

  const goNext = React.useCallback(() => {
    if (index >= 0 && index < photos.length - 1) onOpenChange(photos[index + 1].id);
  }, [index, photos, onOpenChange]);

  // Une nouvelle photo repart d'un état d'erreur vierge : sans ça, une miniature
  // cassée condamnait toutes les suivantes au message d'échec.
  React.useEffect(() => setFailed(false), [openId]);

  // Le retrait du chrome et le pli de la card sont des gestes, pas des réglages :
  // ils ne survivent pas à la fermeture. Ils survivent en revanche au passage à la
  // photo suivante — on parcourt (ou on range) une collection sans avoir à
  // re-tapoter à chaque image.
  React.useEffect(() => {
    if (!open) {
      setChromeVisible(true);
      setExpanded(false);
    }
  }, [open]);

  // La souris rappelle la navigation, puis le silence la reprend. Le minuteur vit
  // dans une ref : le relancer par un `useState` re-rendrait à chaque pixel parcouru.
  const idleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  const wakeNavigation = (event: React.PointerEvent) => {
    // Un doigt émet lui aussi un `pointermove` en tapant. S'y fier ferait clignoter
    // les chevrons juste après le tap qui vient de les retirer — sur mobile, la
    // navigation est le swipe, pas un survol qui n'existe pas.
    if (event.pointerType !== 'mouse') return;
    setPointerActive(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setPointerActive(false), POINTER_IDLE_MS);
  };

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') goPrev();
      else if (event.key === 'ArrowRight') goNext();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, goPrev, goNext]);

  const touchStartX = React.useRef<number | null>(null);
  const swiped = React.useRef(false);
  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
    swiped.current = false;
  };
  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    // Un swipe change de photo ; le clic que le navigateur émet dans sa foulée ne
    // doit pas, en plus, retirer le chrome.
    swiped.current = true;
    if (delta > 0) goPrev();
    else goNext();
  };

  if (!photo) return null;

  const src = photo.medium_url || photo.file_url || photo.thumbnail_url || null;
  const label = photo.name || t('photos.untitled');
  const size = formatFileSize(photo.metadata?.size as number | undefined);
  const dimensions = photo.metadata?.dimensions;
  const dimensionsLabel = Array.isArray(dimensions) && dimensions.length === 2
    ? `${dimensions[0]} × ${dimensions[1]}`
    : null;
  const phase = phaseOf?.(photo);
  const phaseKey = phase === undefined ? null : phase || 'unclassified';

  // « Prise le » et « ajoutée le » ne sont pas la même information, et le back-end
  // refuse de les confondre (`taken_at` reste `null` quand l'EXIF ne dit rien). Les
  // afficher sous un libellé unique reviendrait à présenter une date d'import comme
  // une date de prise de vue — exactement ce que la colonne nullable évite.
  const dateFact = hasCaptureDate(photo)
    ? t('photos.takenOn', { date: formatDate(photo.taken_at) })
    : t('photos.addedOn', { date: formatDate(photo.created_at) });

  // La date situe la photo : elle reste sur la card repliée. Poids, dimensions et
  // auteur sont des détails de fichier — personne n'ouvre une photo pour eux.
  const details = [size || null, dimensionsLabel, photo.created_by_name || null].filter(
    Boolean,
  ) as string[];

  // `zone_links` vient de la liste, jamais déduit localement : c'est la même source
  // que le filtre « Sans zone » de la galerie, sinon l'icône et le filtre pourraient
  // se contredire sur la même photo.
  const withoutZone = flagWithoutZone && (photo.zone_links ?? []).length === 0;

  // Quand les deux dates s'écartent, l'import est une information à part entière :
  // c'est ce décalage qui explique pourquoi la photo n'est pas là où l'utilisateur
  // l'attendait avant ce changement. Sous un jour d'écart, le redire est du bruit.
  const showImportDate =
    hasCaptureDate(photo) &&
    Math.abs(new Date(photo.created_at).getTime() - new Date(photo.taken_at!).getTime()) >
      24 * 60 * 60 * 1000;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onOpenChange(null); }}>
      <DialogContent variant="fullscreen" aria-describedby={undefined} hideDefaultCloseButton>
        <div className="relative h-full w-full" onPointerMove={wakeNavigation}>
          {/* La photo, et le tap qui commande le chrome. Toute la toile est le
              bouton : au doigt, viser une zone sensible est une exigence de plus. */}
          <button
            type="button"
            aria-label={t('photos.toggleInfo')}
            onClick={() => {
              if (swiped.current) { swiped.current = false; return; }
              setChromeVisible((v) => !v);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="absolute inset-0 flex cursor-default items-center justify-center focus:outline-none"
          >
            {src && !failed ? (
              <img
                src={src}
                alt={label}
                decoding="async"
                onError={() => setFailed(true)}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="flex flex-col items-center gap-2 text-white/70">
                {failed ? <ImageOff className="h-10 w-10" aria-hidden /> : <Camera className="h-10 w-10" aria-hidden />}
                <span className="text-xs">
                  {failed ? t('photos.thumbFailed') : t('photos.noPreview')}
                </span>
              </span>
            )}
          </button>

          {/* Calque de navigation — se situer, changer de photo, sortir. Il revient
              sous la souris même quand la card info est écartée. */}
          <Layer visible={chromeVisible || pointerActive}>
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center p-3 sm:p-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(null)}
                aria-label={t('common.close')}
                className={cn(GLASS, 'pointer-events-auto h-9 w-9 shrink-0 rounded-full hover:bg-background')}
              >
                <X className="h-4 w-4" />
              </Button>

              {photos.length > 1 ? (
                <span
                  className={cn(
                    GLASS,
                    'absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground',
                  )}
                >
                  {t('photos.position', { current: index + 1, total: photos.length })}
                </span>
              ) : null}
            </div>

            {hasPrev ? (
              <NavButton side="left" label={t('photos.previous')} onClick={goPrev} icon={ChevronLeft} />
            ) : null}
            {hasNext ? (
              <NavButton side="right" label={t('photos.next')} onClick={goNext} icon={ChevronRight} />
            ) : null}
          </Layer>

          {/* Calque info — ce que la photo est. Lui seul obéit au tap. */}
          <Layer visible={chromeVisible}>
            {phaseKey ? (
              <span
                className={cn(
                  GLASS,
                  'absolute right-3 top-3 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium text-primary sm:right-4 sm:top-4',
                )}
              >
                {t(`photos.phase.${phaseKey}`)}
              </span>
            ) : null}

            {/* Barre basse — repliée, ce que la photo est ; dépliée, ce qu'on peut
                en faire.

                ⚠️ **Pas de `overflow-y-auto` ici.** Le sélecteur de zones ouvre un
                panneau `absolute`, non portalisé : un conteneur de défilement le
                rognerait, et ranger une photo depuis la visionneuse redeviendrait
                impossible sans qu'un pixel ne le dise — le défaut que garde
                `e2e/photos-lightbox.spec.ts`. Ce qui borne la hauteur, ce sont les
                blocs eux-mêmes (les notes défilent seules). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <div
                className={cn(
                  GLASS,
                  'pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl p-4',
                )}
              >
                {/* Ligne repliée : le titre, la date, le manque de zone, le pli. */}
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <DialogTitle className="truncate text-base font-semibold leading-snug text-foreground">
                      {label}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">{dateFact}</p>
                  </div>

                  {/* Le libellé n'est pas peint : c'est le nom accessible de l'icône,
                      et l'infobulle au survol. Sur une card volontairement réduite,
                      une phrase de plus est du bruit — l'icône barrée dit le manque,
                      et le pli juste à côté donne le sélecteur qui le corrige. */}
                  {withoutZone ? (
                    <span
                      role="img"
                      aria-label={t('photos.withoutZone')}
                      title={t('photos.withoutZone')}
                      // `text-warning` sur une teinte, jamais `text-warning-foreground` :
                      // celui-ci n'est lisible que sur un `bg-warning` plein, et
                      // disparaissait en thème sombre (brun 14 % sur fond sombre).
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning"
                    >
                      <MapPinOff className="h-4 w-4" aria-hidden />
                    </span>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    aria-label={expanded ? t('photos.info.less') : t('photos.info.more')}
                    className="-mr-1 -mt-1 h-8 w-8 shrink-0 rounded-full"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {expanded ? (
                  <>
                    {details.length || showImportDate ? (
                      <div className="space-y-0.5">
                        {details.length ? (
                          <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>
                        ) : null}
                        {showImportDate ? (
                          <p className="text-xs text-muted-foreground/70">
                            {t('photos.addedOn', { date: formatDate(photo.created_at) })}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {photo.notes?.trim() ? (
                      <p className="max-h-24 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-foreground">
                        {photo.notes}
                      </p>
                    ) : null}

                    {renderTitle?.(photo)}

                    {renderPurpose?.(photo)}

                    {renderZones?.(photo)}

                    <div className="flex flex-wrap items-center gap-2">
                      {/* « Voir » a disparu : il ouvrait dans un onglet la photo déjà
                          affichée en plein écran. Un bouton qui promet ce qui est
                          déjà là fait douter de ce qu'on regarde. */}
                      {photo.file_url ? (
                        <a
                          href={photo.file_url}
                          download
                          className={cn(
                            buttonVariants({ variant: 'outline', size: 'sm' }),
                            'flex-1 justify-center sm:flex-none',
                          )}
                        >
                          <Download className="mr-2 h-4 w-4" aria-hidden />
                          {t('photos.download')}
                        </a>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onRemove(photo)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                        {removeLabel}
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </Layer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Un calque de commandes posé sur la photo. Deux choses s'y jouent, et les deux
 * ont été payées :
 *
 * - **`inert` + `aria-hidden`** plutôt qu'un démontage : le retrait devient une
 *   transition et non un clignement, sans laisser derrière lui des boutons
 *   transparents mais tabulables — l'opacité seule n'a jamais retiré personne du
 *   calque d'accessibilité.
 * - **`pointer-events-none` en permanence**, chaque commande rétablissant le sien.
 *   Ces calques couvrent tout l'écran : ne les neutraliser que lorsqu'ils sont
 *   *cachés* revenait à ce qu'ils avalent le tap sur la photo tant qu'ils sont
 *   visibles — donc à ne jamais pouvoir les retirer. Invisible en jsdom, qui ne
 *   fait pas de hit-testing ; vu du premier coup dans un vrai navigateur.
 */
function Layer({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      inert={!visible}
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {children}
    </div>
  );
}

function NavButton({
  side,
  label,
  onClick,
  icon: Icon,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      className={cn(
        GLASS,
        'pointer-events-auto absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full hover:bg-background',
        side === 'left' ? 'left-3 sm:left-4' : 'right-3 sm:right-4',
      )}
    >
      <Icon className="h-5 w-5" />
    </Button>
  );
}
