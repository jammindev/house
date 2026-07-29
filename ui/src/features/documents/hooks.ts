import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchDocuments,
  fetchDocumentDetail,
  uploadDocument,
  updateDocument,
  deleteDocument,
  reprocessDocumentOcr,
  attachEntityDocument,
  detachEntityDocument,
  entityDetailQueryKey,
  type DocumentFilters,
  type PhotoPhase,
  type UploadDocumentInput,
} from '@/lib/api/documents';
import type { QueryClient } from '@tanstack/react-query';

export const documentKeys = {
  all: ['documents'] as const,
  list: (filters?: DocumentFilters) =>
    [...documentKeys.all, 'list', filters as Record<string, unknown>] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
};

/** Refresh the document lists + the linked entity's detail (its tab_counts). */
function invalidateEntityDocuments(qc: QueryClient, entityType: string) {
  void qc.invalidateQueries({ queryKey: documentKeys.all });
  const detailKey = entityDetailQueryKey(entityType);
  if (detailKey) void qc.invalidateQueries({ queryKey: detailKey });
}

/**
 * Attach an existing document to any linkable entity (project, equipment, …).
 *
 * `phase` ne concerne que les photos (avant/après) : le dialogue de rattachement
 * en lot le passe, l'onglet Documents l'omet. C'est le seul paramètre qui
 * justifiait un appel direct à l'API depuis un composant — il vit donc ici.
 */
export function useAttachEntityDocument(entityType: string, objectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, phase }: { documentId: string; phase?: PhotoPhase | '' }) =>
      attachEntityDocument(entityType, objectId, documentId, phase),
    onSuccess: () => invalidateEntityDocuments(qc, entityType),
  });
}

export function useDetachEntityDocument(entityType: string, objectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => detachEntityDocument(entityType, objectId, documentId),
    onSuccess: () => invalidateEntityDocuments(qc, entityType),
  });
}

/**
 * `enabled: false` compte : un filtre d'entité dont l'id est vide est **retiré**
 * de la requête (voir `fetchDocuments`), donc la liste vide qu'on croit demander
 * revient en réalité avec *tous* les documents du foyer.
 */
export function useDocuments(filters: DocumentFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: () => fetchDocuments(filters),
    enabled: options?.enabled ?? true,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => fetchDocumentDetail(id),
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDocumentInput) => uploadDocument(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentKeys.all });
      qc.invalidateQueries({ queryKey: ['photos'] });
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof updateDocument>[1];
    }) => updateDocument(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useReprocessDocumentOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reprocessDocumentOcr(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: documentKeys.detail(String(data.id)) });
      qc.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}
