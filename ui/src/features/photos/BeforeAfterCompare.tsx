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
 * Before/after comparator. Overlays the "after" photo on top of the "before" one
 * and reveals it with a draggable slider (works with mouse and touch via a range
 * input). Thumbnails let the user pick which pair to compare. Pure presentation —
 * consumes the phase tags set in the Photos tab.
 */
export default function BeforeAfterCompare({ open, onOpenChange, before, after }: Props) {
  const { t } = useTranslation();

  // Defaults: oldest `before` (last, since newest-first) vs newest `after` (first).
  const [beforeId, setBeforeId] = React.useState<string | null>(null);
  const [afterId, setAfterId] = React.useState<string | null>(null);
  const [pos, setPos] = React.useState(50);

  React.useEffect(() => {
    if (!open) return;
    setBeforeId(before.length ? before[before.length - 1].id : null);
    setAfterId(after.length ? after[0].id : null);
    setPos(50);
  }, [open, before, after]);

  const beforePhoto = before.find((p) => p.id === beforeId) ?? before[before.length - 1];
  const afterPhoto = after.find((p) => p.id === afterId) ?? after[0];
  const beforeUrl = photoSrc(beforePhoto);
  const afterUrl = photoSrc(afterPhoto);

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('photos.entity.compareTitle')}
      size="l"
      contentClassName="gap-4"
    >
      <div className="space-y-4">
        <div className="relative aspect-video w-full select-none overflow-hidden rounded-md bg-muted">
          {beforeUrl ? (
            <img
              src={beforeUrl}
              alt={t('photos.phase.before')}
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <PlaceholderImage label={t('photos.phase.before')} />
          )}

          {afterUrl ? (
            <img
              src={afterUrl}
              alt={t('photos.phase.after')}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <PlaceholderImage label={t('photos.phase.after')} />
            </div>
          )}

          {/* Divider line */}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
            style={{ left: `${pos}%` }}
          />

          {/* Corner labels */}
          <span className="absolute left-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
            {t('photos.phase.before')}
          </span>
          <span className="absolute right-2 top-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
            {t('photos.phase.after')}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
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
                'h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-muted',
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
                <Camera className="m-auto h-4 w-4 text-muted-foreground" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
