import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { cn } from '@/lib/utils';
import type { DocumentItem } from '@/lib/api/documents';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Photos tagged `before` (newest first, as returned by the API). */
  before: DocumentItem[];
  /** Photos tagged `after` (newest first). */
  after: DocumentItem[];
}

function photoSrc(photo: DocumentItem | undefined): string | null {
  if (!photo) return null;
  return photo.medium_url || photo.file_url || photo.thumbnail_url || null;
}

/**
 * Comparateur avant/après : superpose la photo « après » sur l'« avant » et la
 * révèle avec un curseur glissant.
 *
 * Deux corrections structurantes par rapport à la première version :
 *
 * - **`object-cover`, pas `object-contain`.** Le `clip-path` découpe la *boîte*
 *   de l'élément, pas l'image visible. Avec `contain`, deux photos de ratios
 *   différents ne remplissaient pas la même surface : le curseur superposait
 *   deux cadrages distincts et la comparaison mentait. `cover` garantit que les
 *   deux images occupent exactement le même rectangle.
 * - **Le glissement se fait sur l'image.** Le `<input type=range>` sous le cadre
 *   reste (clavier, lecteurs d'écran), mais personne ne pense à le chercher :
 *   le geste attendu est de tirer la séparation elle-même.
 */
export default function BeforeAfterCompare({ open, onOpenChange, before, after }: Props) {
  const { t } = useTranslation();

  // Defaults: oldest `before` (last, since newest-first) vs newest `after` (first).
  const [beforeId, setBeforeId] = React.useState<string | null>(null);
  const [afterId, setAfterId] = React.useState<string | null>(null);
  const [pos, setPos] = React.useState(50);

  // Ne dépend QUE de `open`. Avec `[open, before, after]`, la moindre mutation de
  // phase pendant la comparaison recréait les tableaux et remettait le curseur à
  // 50 % — le réglage de l'utilisateur sautait sans qu'il ait rien touché.
  React.useEffect(() => {
    if (!open) return;
    setBeforeId(null);
    setAfterId(null);
    setPos(50);
  }, [open]);

  const beforePhoto = before.find((p) => p.id === beforeId) ?? before[before.length - 1];
  const afterPhoto = after.find((p) => p.id === afterId) ?? after[0];
  const beforeUrl = photoSrc(beforePhoto);
  const afterUrl = photoSrc(afterPhoto);

  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const dragging = React.useRef(false);

  const setPosFromClientX = React.useCallback((clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, ratio)));
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPosFromClientX(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setPosFromClientX(event.clientX);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('photos.entity.compareTitle')}
      size="l"
      contentClassName="gap-4"
    >
      <div className="space-y-4">
        <div
          ref={frameRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative aspect-video w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-md bg-muted"
        >
          {beforeUrl ? (
            <img
              src={beforeUrl}
              alt={t('photos.phase.before')}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <PlaceholderImage label={t('photos.phase.before')} />
          )}

          {afterUrl ? (
            <img
              src={afterUrl}
              alt={t('photos.phase.after')}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <PlaceholderImage label={t('photos.phase.after')} />
            </div>
          )}

          {/* Poignée de séparation */}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
            style={{ left: `${pos}%` }}
          >
            <span className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background/90 shadow-sm" />
          </div>

          {/* Corner labels */}
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
            {t('photos.phase.before')}
          </span>
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
            {t('photos.phase.after')}
          </span>
        </div>

        {/* Doublon assumé de la poignée : le curseur natif est le seul chemin
            accessible au clavier et aux technologies d'assistance. */}
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(pos)}
          onChange={(e) => setPos(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label={t('photos.entity.compareSlider')}
        />

        <PhotoPicker
          label={t('photos.phase.before')}
          photos={before}
          selectedId={beforePhoto?.id ?? null}
          onSelect={setBeforeId}
        />
        <PhotoPicker
          label={t('photos.phase.after')}
          photos={after}
          selectedId={afterPhoto?.id ?? null}
          onSelect={setAfterId}
        />
      </div>
    </SheetDialog>
  );
}

function PlaceholderImage({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
      <Camera className="h-6 w-6" aria-hidden />
      <span className="text-xs">{label}</span>
    </div>
  );
}

function PhotoPicker({
  label,
  photos,
  selectedId,
  onSelect,
}: {
  label: string;
  photos: DocumentItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (photos.length <= 1) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((photo) => {
          const src = photo.thumbnail_url || photo.file_url;
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => onSelect(photo.id)}
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-muted',
                selectedId === photo.id ? 'border-primary' : 'border-transparent',
              )}
              aria-label={photo.name}
              aria-pressed={selectedId === photo.id}
            >
              {src ? (
                <img
                  src={src}
                  alt={photo.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Camera className="h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
