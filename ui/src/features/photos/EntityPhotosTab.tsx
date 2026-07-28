import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, Trash2, ArrowRightLeft, GitCompareArrows, Plus } from 'lucide-react';
import { Button } from '@/design-system/button';
import CardActions, { type CardAction } from '@/components/CardActions';
import EmptyState from '@/components/EmptyState';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import DocumentUploadDialog from '@/features/documents/DocumentUploadDialog';
import EntityAttachDocumentDialog from '@/features/documents/EntityAttachDocumentDialog';
import PhotoGrid, { PhotoGridSkeleton } from './PhotoGrid';
import PhotoLightbox from './PhotoLightbox';
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
  const [attachOpen, setAttachOpen] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [comparing, setComparing] = React.useState(false);

  // Le dialog d'upload appelle `onOpenChange(false)` **avant** `onSaved` : la
  // phase choisie était donc lue dans une closure que le rendu suivant allait
  // remettre à `null`. Ça ne tenait que par le batching React. Une ref garde la
  // valeur au moment de l'ouverture, indépendamment de l'ordre des callbacks.
  const uploadPhaseRef = React.useRef<PhotoPhase | ''>('');
  const openUpload = React.useCallback((phase: PhotoPhase | '') => {
    uploadPhaseRef.current = phase;
    setUploadPhase(phase);
  }, []);

  const queryKey = React.useMemo(
    () => photoKeys.entity(entityType, objectId),
    [entityType, objectId],
  );

  const attachedIds = React.useMemo(() => new Set(photos.map((p) => p.id)), [photos]);

  const invalidatePhotos = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey });
    void qc.invalidateQueries({ queryKey: photoKeys.all });
  }, [qc, queryKey]);

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('photos.entity.removed'),
    onDelete: (id) => detachMutation.mutateAsync(id),
  });

  const handleDetach = React.useCallback(
    (photo: DocumentItem) => {
      setOpenId(null);
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
          phase: uploadPhaseRef.current,
        });
      }
    },
    [attachMutation],
  );

  const grouped = React.useMemo(() => {
    const map: Record<string, DocumentItem[]> = { before: [], during: [], after: [], '': [] };
    for (const photo of photos) map[normalizePhase(photo)].push(photo);
    return map;
  }, [photos]);

  const canCompare = grouped.before.length > 0 && grouped.after.length > 0;

  // La visionneuse parcourt les photos dans l'ordre **affiché** (par phase), pas
  // dans celui de l'API : sinon « suivant » sautait d'un « Avant » à un « Après »
  // sans raison lisible à l'écran.
  const orderedPhotos = React.useMemo(
    () => PHASE_ORDER.flatMap((phase) => grouped[phase]),
    [grouped],
  );

  const renderActions = React.useCallback(
    (photo: DocumentItem) => {
      const phase = normalizePhase(photo);
      const actions: CardAction[] = [
        ...PHASE_ORDER.filter((p) => p !== phase).map((p) => ({
          label: t('photos.entity.moveTo', { phase: t(`photos.phase.${p || 'unclassified'}`) }),
          icon: ArrowRightLeft,
          onClick: () => setPhaseMutation.mutate({ documentId: photo.id, phase: p }),
        })),
        {
          label: t('photos.entity.remove'),
          icon: Trash2,
          onClick: () => handleDetach(photo),
          variant: 'danger' as const,
        },
      ];
      return <CardActions actions={actions} />;
    },
    [t, setPhaseMutation, handleDetach],
  );

  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) return <PhotoGridSkeleton count={4} />;
  if (error) return <p className="text-sm text-destructive">{t('common.error_loading')}</p>;

  return (
    <>
      <div className="space-y-6">
        {/* Quand il n'y a rien, l'`EmptyState` porte le seul appel à l'action :
            une barre de boutons au-dessus d'un encart qui redit « Ajouter une
            photo » proposait deux fois la même chose. */}
        {photos.length > 0 ? (
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
              variant="outline"
              onClick={() => setAttachOpen(true)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('photos.entity.attach_existing')}
            </Button>
            <Button type="button" size="sm" onClick={() => openUpload('')} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {t('photos.entity.upload')}
            </Button>
          </div>
        ) : null}

        {photos.length === 0 ? (
          <EmptyState
            icon={Camera}
            title={t('photos.entity.empty')}
            description={t('photos.entity.empty_hint')}
            action={{ label: t('photos.entity.upload'), onClick: () => openUpload('') }}
          />
        ) : (
          PHASE_ORDER.map((phase) => {
            const items = grouped[phase];
            if (items.length === 0) return null;
            const phaseKey = phase || 'unclassified';
            return (
              <section key={phaseKey} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {t(`photos.phase.${phaseKey}`)}{' '}
                    <span className="tabular-nums text-muted-foreground">({items.length})</span>
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => openUpload(phase)}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    <Upload className="h-3 w-3" />
                    {t('photos.entity.addToPhase')}
                  </Button>
                </div>
                <PhotoGrid
                  photos={items}
                  onPhotoClick={(photo) => setOpenId(photo.id)}
                  renderActions={renderActions}
                />
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
        // Sans cette précision, ouvrir l'upload depuis la section « Après »
        // donnait le même dialog que depuis le bouton global : rien n'indiquait
        // où la photo allait atterrir.
        titleSuffix={uploadPhase ? t(`photos.phase.${uploadPhase}`) : undefined}
      />

      <EntityAttachDocumentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        entityType={entityType}
        objectId={objectId}
        attachedIds={attachedIds}
        documentType="photo"
        phase=""
        onAttached={invalidatePhotos}
        title={t('photos.entity.attach_existing')}
      />

      <PhotoLightbox
        photos={orderedPhotos}
        openId={openId}
        onOpenChange={setOpenId}
        onRemove={handleDetach}
        // « Supprimer » était un mensonge : l'action détache la photo de l'entité,
        // le fichier reste dans la galerie du foyer.
        removeLabel={t('photos.entity.remove')}
        phaseOf={normalizePhase}
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
