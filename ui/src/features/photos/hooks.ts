import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/lib/toast';
import {
  fetchPhotoDocuments,
  deleteDocument,
  attachEntityDocument,
  detachEntityDocument,
  setDocumentPhase,
  setDocumentZones,
  entityDetailQueryKey,
  type PhotoPhase,
} from '@/lib/api/documents';
import { documentKeys } from '@/features/documents/hooks';
import { zoneKeys } from '@/features/zones/hooks';

export interface PhotoFilters {
  search?: string;
  zone?: string;
  /** `'1'` = seulement les photos rangées dans aucune zone. */
  without_zone?: string;
  [key: string]: string | undefined;
}

export const photoKeys = {
  all: ['photos'] as const,
  list: (filters?: PhotoFilters) => [...photoKeys.all, 'list', filters ?? {}] as const,
  /** Photos linked to one entity (project, equipment…) — the detail Photos tab. */
  entity: (entityType: string, objectId: string) =>
    [...photoKeys.all, 'entity', entityType, objectId] as const,
};

export function usePhotos(filters?: PhotoFilters) {
  return useQuery({
    queryKey: photoKeys.list(filters),
    queryFn: () => fetchPhotoDocuments(filters),
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      // Les photos sont des `Document` : la liste documents doit bouger aussi,
      // sinon la corbeille d'un écran contredit l'autre.
      void qc.invalidateQueries({ queryKey: photoKeys.all });
      void qc.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: () => toast({ description: t('common.deleteFailed'), variant: 'destructive' }),
  });
}

/**
 * Range une photo : remplace ses zones.
 *
 * Invalide large — galerie, documents, **et** zones. Ranger une photo change le
 * `tab_counts.photos` de la zone d'arrivée comme celui de la zone de départ, et
 * l'onglet Photos d'une zone lit la même liste : n'invalider que les photos
 * laisserait deux écrans se contredire sur la même donnée.
 */
export function useSetPhotoZones() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ photoId, zoneIds }: { photoId: string; zoneIds: string[] }) =>
      setDocumentZones(photoId, zoneIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: photoKeys.all });
      void qc.invalidateQueries({ queryKey: documentKeys.all });
      void qc.invalidateQueries({ queryKey: zoneKeys.all });
      toast({ description: t('photos.zones.saved'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// ── Entity-scoped photos (detail page « Photos » tab) ──────────────────────

/** Photos linked to a single entity, with their phase in that context. */
export function useEntityPhotos(entityType: string, objectId: string) {
  return useQuery({
    queryKey: photoKeys.entity(entityType, objectId),
    queryFn: () => fetchPhotoDocuments({ [entityType]: objectId }),
    enabled: !!objectId,
  });
}

/** Invalidate the entity photos list + the entity detail (its photos tab count). */
function useEntityPhotoInvalidation(entityType: string, objectId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: photoKeys.entity(entityType, objectId) });
    void qc.invalidateQueries({ queryKey: photoKeys.all });
    // Une photo EST un `Document` : attacher/détacher change aussi ses backlinks.
    void qc.invalidateQueries({ queryKey: documentKeys.all });
    // tab_counts.photos lives on the linked entity's detail (project, chicken…).
    const detailKey = entityDetailQueryKey(entityType);
    if (detailKey) void qc.invalidateQueries({ queryKey: detailKey });
  };
}

export function useAttachEntityPhoto(entityType: string, objectId: string) {
  const invalidate = useEntityPhotoInvalidation(entityType, objectId);
  return useMutation({
    mutationFn: ({ documentId, phase }: { documentId: string; phase?: PhotoPhase | '' }) =>
      attachEntityDocument(entityType, objectId, documentId, phase),
    onSuccess: invalidate,
  });
}

export function useDetachEntityPhoto(entityType: string, objectId: string) {
  const invalidate = useEntityPhotoInvalidation(entityType, objectId);
  return useMutation({
    mutationFn: (documentId: string) => detachEntityDocument(entityType, objectId, documentId),
    onSuccess: invalidate,
  });
}

export function useSetPhotoPhase(entityType: string, objectId: string) {
  const invalidate = useEntityPhotoInvalidation(entityType, objectId);
  return useMutation({
    mutationFn: ({ documentId, phase }: { documentId: string; phase: PhotoPhase | '' }) =>
      setDocumentPhase(entityType, objectId, documentId, phase),
    onSuccess: invalidate,
  });
}
