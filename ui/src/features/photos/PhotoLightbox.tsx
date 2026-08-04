import * as React from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ImageOff,
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
   * Bloc « Zones » du panneau de métadonnées. Injecté plutôt que câblé ici : la
   * visionneuse reste sans données propres — elle reçoit déjà `phaseOf`,
   * `onRemove` et `removeLabel` de son appelant.
   */
  renderZones?: (photo: DocumentItem) => React.ReactNode;
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
}: Props) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);
  const [chromeVisible, setChromeVisible] = React.useState(true);
  const [pointerActive, setPointerActive] = React.useState(false);

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

  // Le retrait du chrome est un geste, pas un réglage : il ne survit pas à la
  // fermeture. Il survit en revanche au passage à la photo suivante — on parcourt
  // une collection sans avoir à re-tapoter à chaque image.
  React.useEffect(() => {
    if (!open) setChromeVisible(true);
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

  const facts = [
    dateFact,
    size || null,
    dimensionsLabel,
    photo.created_by_name || null,
  ].filter(Boolean) as string[];

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

            {/* Barre basse — ce que la photo est, et ce qu'on peut en faire */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <div
                className={cn(
                  GLASS,
                  'pointer-events-auto mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-2xl p-4',
                )}
              >
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="break-words text-base font-semibold leading-snug text-foreground">
                    {label}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">{facts.join(' · ')}</p>
                  {showImportDate ? (
                    <p className="text-xs text-muted-foreground/70">
                      {t('photos.addedOn', { date: formatDate(photo.created_at) })}
                    </p>
                  ) : null}
                </div>

                {photo.notes?.trim() ? (
                  <p className="max-h-24 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {photo.notes}
                  </p>
                ) : null}

                {renderZones?.(photo)}

                <div className="flex flex-wrap items-center gap-2">
                  {photo.file_url ? (
                    <>
                      <a
                        href={photo.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 justify-center sm:flex-none')}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                        {t('photos.view')}
                      </a>
                      <a
                        href={photo.file_url}
                        download
                        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 justify-center sm:flex-none')}
                      >
                        <Download className="mr-2 h-4 w-4" aria-hidden />
                        {t('photos.download')}
                      </a>
                    </>
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
