import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPhotoDocuments,
  deleteDocument,
  attachEntityDocument,
  detachEntityDocument,
  setDocumentPhase,
  entityDetailQueryKey,
  type PhotoPhase,
} from '@/lib/api/documents';

export interface PhotoFilters {
  search?: string;
  zone?: string;
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
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: photoKeys.all }),
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
