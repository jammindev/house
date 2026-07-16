import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, Trash2, ArrowRightLeft, GitCompareArrows } from 'lucide-react';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import DocumentUploadDialog from '@/features/documents/DocumentUploadDialog';
import PhotoDetailPanel from './PhotoDetailPanel';
import BeforeAfterCompare from './BeforeAfterCompare';
import {
  photoKeys,
  useEntityPhotos,
  useAttachEntityPhoto,
  useDetachEntityPhoto,
  useSetPhotoPhase,
} from './hooks';
import type { DocumentItem, DocumentDetail, PhotoPhase } from '@/lib/api/documents';

interface Props {
  /** A household entity type that supports document linking (e.g. 'project'). */
  entityType: string;
  /** The entity's id. */
  objectId: string;
}

/** Phase buckets, in display order. '' = unclassified. */
const PHASE_ORDER: (PhotoPhase | '')[] = ['before', 'during', 'after', ''];

function normalizePhase(photo: DocumentItem): PhotoPhase | '' {
  return (photo.phase as PhotoPhase | '' | null) || '';
}

/**
 * Before/after photos tab for any linkable entity. Groups the entity's photos by
 * renovation phase (before / during / after / unclassified), lets the user upload
 * into a phase, re-tag, remove (with undo), and open a side-by-side comparator.
 * Drop into a detail page's TabShell — mirrors EntityDocumentsTab ergonomics.
 */
export default function EntityPhotosTab({ entityType, objectId }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: photos = [], isLoading, error } = useEntityPhotos(entityType, objectId);
  const attachMutation = useAttachEntityPhoto(entityType, objectId);
  const detachMutation = useDetachEntityPhoto(entityType, objectId);
  const setPhaseMutation = useSetPhotoPhase(entityType, objectId);

  const [uploadPhase, setUploadPhase] = React.useState<PhotoPhase | '' | null>(null);
  const [viewing, setViewing] = React.useState<DocumentItem | null>(null);
  const [comparing, setComparing] = React.useState(false);

  const queryKey = React.useMemo(
    () => photoKeys.entity(entityType, objectId),
    [entityType, objectId],
  );

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('photos.entity.removed'),
    onDelete: (id) => detachMutation.mutateAsync(id),
  });

  const handleDetach = React.useCallback(
    (photo: DocumentItem) => {
      setViewing(null);
      deleteWithUndo(photo.id, {
        onRemove: () =>
          qc.setQueryData<DocumentItem[]>(queryKey, (old) =>
            old?.filter((p) => p.id !== photo.id),
          ),
        onRestore: () =>
          qc.setQueryData<DocumentItem[]>(queryKey, (old) =>
            old ? [...old, photo] : [photo],
          ),
      });
    },
    [deleteWithUndo, qc, queryKey],
  );

  const handleUploaded = React.useCallback(
    async (created?: DocumentDetail) => {
      if (created) {
        await attachMutation.mutateAsync({
          documentId: created.id,
          phase: uploadPhase ?? '',
        });
      }
    },
    [attachMutation, uploadPhase],
  );

  const grouped = React.useMemo(() => {
    const map: Record<string, DocumentItem[]> = { before: [], during: [], after: [], '': [] };
    for (const photo of photos) map[normalizePhase(photo)].push(photo);
    return map;
  }, [photos]);

  const hasBefore = grouped.before.length > 0;
  const hasAfter = grouped.after.length > 0;
  const canCompare = hasBefore && hasAfter;

  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{t('common.error_loading')}</p>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-end gap-2">
          {canCompare ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setComparing(true)}
              className="gap-1.5"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              {t('photos.entity.compare')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => setUploadPhase('')}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {t('photos.entity.upload')}
          </Button>
        </div>

        {photos.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t('photos.entity.empty')}</p>
        ) : (
          PHASE_ORDER.map((phase) => {
            const items = grouped[phase];
            if (items.length === 0) return null;
            const phaseKey = phase || 'unclassified';
            return (
              <section key={phaseKey} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">
                    {t(`photos.phase.${phaseKey}`)}{' '}
                    <span className="text-muted-foreground">({items.length})</span>
                  </CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setUploadPhase(phase)}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    <Upload className="h-3 w-3" />
                    {t('photos.entity.addToPhase')}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {items.map((photo) => (
                    <PhotoTile
                      key={photo.id}
                      photo={photo}
                      phase={phase}
                      onOpen={() => setViewing(photo)}
                      onSetPhase={(next) =>
                        setPhaseMutation.mutate({ documentId: photo.id, phase: next })
                      }
                      onDelete={() => handleDetach(photo)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>

      <DocumentUploadDialog
        open={uploadPhase !== null}
        onOpenChange={(open) => {
          if (!open) setUploadPhase(null);
        }}
        onSaved={handleUploaded}
        forcedType="photo"
      />

      <PhotoDetailPanel
        photo={viewing}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        onDelete={() => {
          if (viewing) handleDetach(viewing);
        }}
      />

      <BeforeAfterCompare
        open={comparing}
        onOpenChange={setComparing}
        before={grouped.before}
        after={grouped.after}
      />
    </>
  );
}

// ── Photo tile with phase controls ────────────────────────────────────────

function PhotoTile({
  photo,
  phase,
  onOpen,
  onSetPhase,
  onDelete,
}: {
  photo: DocumentItem;
  phase: PhotoPhase | '';
  onOpen: () => void;
  onSetPhase: (phase: PhotoPhase | '') => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  const actions: CardAction[] = [
    ...PHASE_ORDER.filter((p) => p !== phase).map((p) => ({
      label: t('photos.entity.moveTo', { phase: t(`photos.phase.${p || 'unclassified'}`) }),
      icon: ArrowRightLeft,
      onClick: () => onSetPhase(p),
    })),
    {
      label: t('photos.entity.remove'),
      icon: Trash2,
      onClick: onDelete,
      variant: 'danger' as const,
    },
  ];

  return (
    <Card className="group relative overflow-hidden p-0">
      <button
        type="button"
        className="block aspect-square w-full cursor-pointer bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={onOpen}
        aria-label={photo.name}
      >
        {photo.thumbnail_url || photo.file_url ? (
          <img
            src={photo.thumbnail_url || photo.file_url || ''}
            alt={photo.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Camera className="h-6 w-6" aria-hidden />
          </div>
        )}
      </button>
      <div className="absolute right-1 top-1 rounded-md bg-background/80 backdrop-blur-sm">
        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
