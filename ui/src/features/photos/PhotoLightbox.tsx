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
}

/** Distance horizontale minimale, en px, pour qu'un glissement compte comme un swipe. */
const SWIPE_THRESHOLD = 50;

/**
 * Visionneuse plein cadre d'une collection de photos.
 *
 * Remplace `PhotoDetailPanel`, qui souffrait de trois défauts visibles :
 *
 * - **Deux croix de fermeture** : `DialogContent` rend la sienne en `absolute
 *   right-4 top-4`, et le panneau en ajoutait une seconde dans l'en-tête. Sur
 *   mobile (image en haut) celle de Radix tombait *sur* l'image sombre en
 *   `text-foreground` — invisible. D'où `hideDefaultCloseButton` ici : une seule
 *   croix, posée là où on la voit, sur un fond qui la porte.
 * - **Aucune navigation** : parcourir dix photos demandait dix fermetures. Flèches,
 *   clavier ← →, et swipe tactile.
 * - Couleurs `slate`/`black` codées en dur → thème sombre cassé.
 */
export default function PhotoLightbox({
  photos,
  openId,
  onOpenChange,
  onRemove,
  removeLabel,
  phaseOf,
}: Props) {
  const { t } = useTranslation();
  const [failed, setFailed] = React.useState(false);

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
  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
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
      <DialogContent
        className="max-w-4xl overflow-hidden p-0"
        aria-describedby={undefined}
        hideDefaultCloseButton
      >
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          {/* Image + navigation */}
          <div
            className="relative flex min-h-[45vh] w-full items-center justify-center bg-foreground/[0.06] lg:min-h-[70vh] lg:flex-1 dark:bg-background/60"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {src && !failed ? (
              <img
                src={src}
                alt={label}
                decoding="async"
                onError={() => setFailed(true)}
                className="max-h-[45vh] w-full object-contain lg:max-h-[70vh]"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                {failed ? <ImageOff className="h-10 w-10" aria-hidden /> : <Camera className="h-10 w-10" aria-hidden />}
                <span className="text-xs">
                  {failed ? t('photos.thumbFailed') : t('photos.noPreview')}
                </span>
              </div>
            )}

            {hasPrev ? (
              <NavButton side="left" label={t('photos.previous')} onClick={goPrev} icon={ChevronLeft} />
            ) : null}
            {hasNext ? (
              <NavButton side="right" label={t('photos.next')} onClick={goNext} icon={ChevronRight} />
            ) : null}

            {photos.length > 1 ? (
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                {t('photos.position', { current: index + 1, total: photos.length })}
              </span>
            ) : null}
          </div>

          {/* Métadonnées */}
          <div className="flex w-full flex-col gap-4 border-border p-5 lg:w-80 lg:border-l">
            <div className="flex items-start justify-between gap-2">
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(null)}
                aria-label={t('common.close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {phaseKey ? (
              <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {t(`photos.phase.${phaseKey}`)}
              </span>
            ) : null}

            {photo.notes?.trim() ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{photo.notes}</p>
            ) : null}

            <div className="mt-auto flex flex-col gap-2 pt-4">
              {photo.file_url ? (
                <>
                  <a
                    href={photo.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-center')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                    {t('photos.view')}
                  </a>
                  <a
                    href={photo.file_url}
                    download
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full justify-center')}
                  >
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                    {t('photos.download')}
                  </a>
                </>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => onRemove(photo)}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                {removeLabel}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
